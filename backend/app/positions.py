"""Position solver: place each active trip along its track shape at time t.

For every active trip we know (schedule ⊕ realtime) when it left the previous
station and when it reaches the next one; linear progress between the two,
mapped through distance-along-shape, gives a smooth position on real track
geometry. Trains dwelling at a platform sit still at the station.
"""
import logging
import math
import time
from bisect import bisect_right
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from .config import METRO_LINES
from .gtfs_static import TZ, service_date_epoch
from .models import Line, StationOut, TrainOut
from .realtime import RealtimeState

logger = logging.getLogger(__name__)

EARTH_R = 6371000.0
# Ignore RT absolute times that are still far from schedule after day-alignment.
MAX_RT_DRIFT_S = 6 * 3600


def _align_rt_epoch(rt_epoch: float, sched_epoch: float) -> float:
    """Snap RT absolute epochs onto the service-date schedule.

    OVapi tripUpdates often carry times from a previous service day while
    static GTFS uses today's calendar date — without correction the trip
    window shifts off ``now`` and the train disappears from the map.

    Shifted by local *calendar days*, not fixed 86400s multiples: Europe/
    Amsterdam DST transitions make some local days 82800s or 90000s long, and
    a fixed-86400s shift misaligns trips whose RT and scheduled times fall on
    opposite sides of one of those two nights a year.
    """
    rt_dt = datetime.fromtimestamp(rt_epoch, TZ)
    sched_dt = datetime.fromtimestamp(sched_epoch, TZ)
    day_shift = (sched_dt.date() - rt_dt.date()).days
    aligned = (rt_dt + timedelta(days=day_shift)).timestamp() if day_shift else rt_epoch
    if abs(aligned - sched_epoch) > MAX_RT_DRIFT_S:
        return sched_epoch
    return aligned


def _dist_m(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    """Equirectangular approximation — plenty accurate at city scale."""
    x = math.radians(lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2))
    y = math.radians(lat2 - lat1)
    return EARTH_R * math.hypot(x, y)


class Shape:
    def __init__(self, coords: List[List[float]], dists: List[Optional[float]]):
        self.coords = coords
        if dists and all(d is not None for d in dists):
            self.cum = [float(d) for d in dists]
        else:
            self.cum = [0.0]
            for i in range(1, len(coords)):
                a, b = coords[i - 1], coords[i]
                self.cum.append(self.cum[-1] + _dist_m(a[0], a[1], b[0], b[1]))
        self.length = self.cum[-1] if self.cum else 0.0

    def point_at(self, d: float) -> Tuple[float, float, float]:
        """(lon, lat, bearing_deg) at distance d along the shape."""
        cum, coords = self.cum, self.coords
        if d <= 0:
            i = 1
        elif d >= self.length:
            i = len(cum) - 1
        else:
            i = bisect_right(cum, d)
            i = min(max(i, 1), len(cum) - 1)
        a, b = coords[i - 1], coords[i]
        seg = cum[i] - cum[i - 1]
        t = 0.0 if seg <= 0 else (d - cum[i - 1]) / seg
        t = min(max(t, 0.0), 1.0)
        lon = a[0] + (b[0] - a[0]) * t
        lat = a[1] + (b[1] - a[1]) * t
        bearing = math.degrees(math.atan2(
            math.radians(b[0] - a[0]) * math.cos(math.radians(lat)),
            math.radians(b[1] - a[1]),
        )) % 360
        return lon, lat, bearing

    def _closest(self, lon: float, lat: float, stop_below: float = 0.0) -> Tuple[float, float]:
        """(squared metres to the closest point, distance along shape of it).

        `stop_below` short-circuits the scan once a point that close has been
        found — callers that only need a within-tolerance yes/no (the track
        dedup) skip most of the polyline that way.
        """
        best_d, best_cum = float("inf"), 0.0
        coords, cum = self.coords, self.cum
        cos_lat = math.cos(math.radians(lat))
        limit = stop_below * stop_below
        for i in range(1, len(coords)):
            ax, ay = coords[i - 1]
            bx, by = coords[i]
            # local planar coords in meters
            ax_m = math.radians(ax - lon) * cos_lat * EARTH_R
            ay_m = math.radians(ay - lat) * EARTH_R
            bx_m = math.radians(bx - lon) * cos_lat * EARTH_R
            by_m = math.radians(by - lat) * EARTH_R
            dx, dy = bx_m - ax_m, by_m - ay_m
            seg2 = dx * dx + dy * dy
            t = 0.0 if seg2 == 0 else min(max(-(ax_m * dx + ay_m * dy) / seg2, 0.0), 1.0)
            px, py = ax_m + dx * t, ay_m + dy * t
            d2 = px * px + py * py
            if d2 < best_d:
                best_d = d2
                best_cum = cum[i - 1] + (cum[i] - cum[i - 1]) * t
                if best_d <= limit:
                    break
        return best_d, best_cum

    def project(self, lon: float, lat: float) -> float:
        """Distance along shape of the closest point to (lon, lat)."""
        return self._closest(lon, lat)[1]

    def deviation(self, lon: float, lat: float, stop_below: float = 0.0) -> float:
        """Perpendicular distance in metres from (lon, lat) to this polyline."""
        return math.sqrt(self._closest(lon, lat, stop_below)[0])


"""Two stretches of rail closer than this are treated as the same track.

Deliberately tight, and measured rather than guessed. The gap between shapes
that genuinely share a rail is GTFS vertex jitter, well under a metre; the gap
between the two Noord/Zuidlijn bores at Noorderpark is ~17m. Nothing in the
feed falls in between, so the tolerance only has to land in that gap — and the
low end of it is strictly better. Swept over line 52: at 2m the union is 4
paths with 99.7% of rail drawn exactly once and every shape sitting on drawn
track to within 0.00m, while at 8m it is 9 paths, 94.1%, and up to 7.9m off.
Loosening it fragments shapes into partial runs and starts pulling trains off
the rail again; past ~15m the bores merge and the artifact returns outright.
"""
TRACK_DEDUP_M = 2.0

# A newly-exposed stretch shorter than this is vertex jitter where two shapes
# wobble across the tolerance, not real divergent track. Drawing those leaves
# speckles of stray rail alongside the line.
MIN_RUN_M = 30.0

# Planar grid origin. Amsterdam is small enough that one tangent plane over the
# whole network costs well under a metre of error, far inside TRACK_DEDUP_M.
_GRID_LAT0 = 52.37
_GRID_LON0 = 4.90


class _TrackIndex:
    """Every rail segment kept so far, bucketed into a grid, answering "is this
    point already on drawn track?".

    Deduplication has to be per-segment, not per-shape: a shape that retraces
    an existing rail for 9km and then diverges for the last 100m has to
    contribute only that 100m. Measured on the real feed, 52% of line 52 is
    covered by all four of its shapes and 47% by two, so keeping whole shapes
    would stack the line alpha 2-4x across the entire network.

    The grid is what makes that affordable — the naive form is a quadratic
    polyline-vs-polyline scan over every pair of shapes.
    """

    def __init__(self, cell_m: float):
        self.cell = cell_m
        self.cells: Dict[Tuple[int, int], List[Tuple[float, float, float, float]]] = {}

    def _xy(self, lon: float, lat: float) -> Tuple[float, float]:
        cos_lat = math.cos(math.radians(_GRID_LAT0))
        return (
            math.radians(lon - _GRID_LON0) * cos_lat * EARTH_R,
            math.radians(lat - _GRID_LAT0) * EARTH_R,
        )

    def add(self, path: List[List[float]]) -> None:
        pts = [self._xy(x, y) for x, y in path]
        for i in range(1, len(pts)):
            (ax, ay), (bx, by) = pts[i - 1], pts[i]
            seg = (ax, ay, bx, by)
            # bucket by bounding box grown a cell, so a lookup only ever has to
            # consult the point's own cell and its 8 neighbours
            lo_x, hi_x = sorted((ax, bx))
            lo_y, hi_y = sorted((ay, by))
            for cx in range(int((lo_x - self.cell) // self.cell),
                            int((hi_x + self.cell) // self.cell) + 1):
                for cy in range(int((lo_y - self.cell) // self.cell),
                                int((hi_y + self.cell) // self.cell) + 1):
                    self.cells.setdefault((cx, cy), []).append(seg)

    def covered(self, lon: float, lat: float, tol: float) -> bool:
        px, py = self._xy(lon, lat)
        cx, cy = int(px // self.cell), int(py // self.cell)
        tol2 = tol * tol
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for ax, ay, bx, by in self.cells.get((cx + dx, cy + dy), ()):
                    ux, uy = bx - ax, by - ay
                    seg2 = ux * ux + uy * uy
                    t = 0.0 if seg2 == 0 else min(
                        max(((px - ax) * ux + (py - ay) * uy) / seg2, 0.0), 1.0)
                    qx, qy = px - (ax + t * ux), py - (ay + t * uy)
                    if qx * qx + qy * qy <= tol2:
                        return True
        return False


def _path_len_m(path: List[List[float]]) -> float:
    return sum(
        _dist_m(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1])
        for i in range(1, len(path))
    )


def _novel_runs(
    coords: List[List[float]], index: _TrackIndex, tol: float
) -> List[List[List[float]]]:
    """Split `coords` into the stretches that are not already on drawn track."""
    covered = [index.covered(x, y, tol) for x, y in coords]
    runs: List[List[List[float]]] = []
    cur: List[List[float]] = []
    for i, pt in enumerate(coords):
        if covered[i]:
            if cur:
                # carry one covered point into the run at each end, so a
                # divergent bore meets the rail it branches from instead of
                # starting in mid-air with a visible gap
                cur.append(pt)
                runs.append(cur)
                cur = []
        else:
            if not cur and i > 0:
                cur.append(coords[i - 1])
            cur.append(pt)
    if cur:
        runs.append(cur)
    return [r for r in runs if len(r) > 1 and _path_len_m(r) >= MIN_RUN_M]


class MetroData:
    """Preprocessed static data ready for fast per-request solving."""

    def __init__(self, subset: dict):
        self.subset = subset
        self.shapes: Dict[str, Shape] = {
            sid: Shape(s["coords"], s["dists"]) for sid, s in subset["shapes"].items()
        }
        self.stops = subset["stops"]
        self.service_dates: Dict[str, List[str]] = subset["service_dates"]
        self._stop_dist_cache: Dict[Tuple[str, str], float] = {}
        self._lines_cache: Optional[List[Line]] = None

        self.trips: Dict[str, dict] = {}
        for trip_id, t in subset["trips"].items():
            shape = self.shapes.get(t["shape_id"])
            if not shape or len(t["stops"]) < 2:
                continue
            stops = []
            for seq, stop_id, arr_s, dep_s, dist in t["stops"]:
                if dist is None:
                    dist = self._stop_dist(t["shape_id"], stop_id, shape)
                stops.append((seq, stop_id, arr_s, dep_s, float(dist)))
            self.trips[trip_id] = {
                "line": t["line"],
                "shape_id": t["shape_id"],
                "headsign": t["headsign"],
                "service_id": t["service_id"],
                "stops": stops,
            }
        logger.info("MetroData ready: %d usable trips, %d shapes", len(self.trips), len(self.shapes))

    def _stop_dist(self, shape_id: str, stop_id: str, shape: Shape) -> float:
        key = (shape_id, stop_id)
        if key not in self._stop_dist_cache:
            st = self.stops[stop_id]
            self._stop_dist_cache[key] = shape.project(st["lon"], st["lat"])
        return self._stop_dist_cache[key]

    def trip_ids(self) -> set:
        return set(self.trips)

    def lines(self) -> List[Line]:
        """Per line: the representative (longest) shape, plus every track that
        is not just a retracing of one already kept. Cached — the dedup is a
        polyline-vs-polyline scan, far too slow to redo per request."""
        if self._lines_cache is None:
            self._lines_cache = self._build_lines()
        return self._lines_cache

    def _build_lines(self) -> List[Line]:
        by_line: Dict[str, Dict[int, Shape]] = {}
        for t in self.trips.values():
            shape = self.shapes[t["shape_id"]]
            # keyed by identity: one Shape object is shared by all its trips
            by_line.setdefault(t["line"], {})[id(shape)] = shape

        out = []
        for line_id, meta in METRO_LINES.items():
            candidates = by_line.get(line_id)
            if not candidates:
                continue
            # Longest first, so the representative goes down whole and the
            # short-turn patterns contribute only what they add to it — the
            # reverse order would draw the line as a set of stubs.
            ordered = sorted(candidates.values(), key=lambda s: s.length, reverse=True)
            index = _TrackIndex(TRACK_DEDUP_M)
            tracks: List[List[List[float]]] = []
            for shape in ordered:
                for run in _novel_runs(shape.coords, index, TRACK_DEDUP_M):
                    tracks.append(run)
                    index.add(run)
            out.append(Line(
                id=line_id, name=meta["name"], color=meta["color"],
                shape=ordered[0].coords,
                tracks=tracks,
            ))
        return out

    def stations(self) -> List[StationOut]:
        """Platform stops grouped by station name."""
        grouped: Dict[str, dict] = {}
        stop_lines: Dict[str, set] = {}
        for t in self.trips.values():
            for _, stop_id, *_ in t["stops"]:
                stop_lines.setdefault(stop_id, set()).add(t["line"])
        for stop_id, st in self.stops.items():
            g = grouped.setdefault(st["name"], {
                "lats": [], "lons": [], "lines": set(), "id": stop_id,
            })
            g["lats"].append(st["lat"])
            g["lons"].append(st["lon"])
            g["lines"] |= stop_lines.get(stop_id, set())
        return [
            StationOut(
                id=g["id"], name=name,
                latitude=sum(g["lats"]) / len(g["lats"]),
                longitude=sum(g["lons"]) / len(g["lons"]),
                lines=sorted(g["lines"]),
            )
            for name, g in grouped.items()
        ]

    def departures(
        self, station_name: str, rt: RealtimeState,
        now: Optional[float] = None, limit: int = 8,
    ) -> List[dict]:
        """Upcoming departures at a station (all platforms), soonest first."""
        now = now or time.time()
        target_stops = {
            sid for sid, st in self.stops.items() if st["name"] == station_name
        }
        if not target_stops:
            return []
        horizon = now + 45 * 60
        out: List[dict] = []
        # RT overrides carry absolute times, so the same trip can produce
        # identical entries for each of its service dates — dedupe on the run.
        seen: set = set()
        for trip_id, t in self.trips.items():
            stop_ids = {s[1] for s in t["stops"]}
            if not (stop_ids & target_stops):
                continue
            rt_trip = rt.trip_updates.get(trip_id)
            for date in self.service_dates.get(t["service_id"], []):
                times = self._effective_times(t, date, rt_trip)
                for i, (seq, stop_id, *_rest) in enumerate(t["stops"]):
                    if stop_id in target_stops:
                        arr, dep, _dist, delay = times[i]
                        if now - 30 <= dep <= horizon and i < len(t["stops"]) - 1:
                            key = (t["line"], t["headsign"], int(dep))
                            if key in seen:
                                continue
                            seen.add(key)
                            out.append({
                                "trip_id": trip_id,
                                "line": t["line"],
                                "headsign": t["headsign"],
                                "departure_ts": int(dep),
                                "delay_s": delay,
                                "realtime": rt_trip is not None,
                            })
        out.sort(key=lambda d: d["departure_ts"])
        return out[:limit]

    def trains(self, rt: RealtimeState, now: Optional[float] = None) -> List[TrainOut]:
        now = now or time.time()
        out: List[TrainOut] = []
        for trip_id, t in self.trips.items():
            dates = sorted(
                self.service_dates.get(t["service_id"], []),
                reverse=True,
            )
            rt_trip = rt.trip_updates.get(trip_id)
            for date in dates:
                train = self._solve(trip_id, t, date, rt_trip, now)
                if train:
                    out.append(train)
                    break
        return out

    def _effective_times(
        self, t: dict, date: str, rt_trip: Optional[dict],
    ) -> List[Tuple[float, float, float, int]]:
        """Per-stop (arr, dep, dist, delay): schedule overridden by RT where
        present; a known delay propagates to later stops without updates."""
        base = service_date_epoch(date)
        times: List[Tuple[float, float, float, int]] = []
        delay = 0
        rt_stops = rt_trip["stops"] if rt_trip else {}
        for seq, _stop_id, arr_s, dep_s, dist in t["stops"]:
            sched_arr = base + arr_s
            sched_dep = base + dep_s
            arr, dep = sched_arr, sched_dep
            rec = rt_stops.get(seq)
            if rec:
                delay = rec.get("delay", delay)
                if rec.get("arr"):
                    arr = _align_rt_epoch(rec["arr"], sched_arr)
                else:
                    arr = sched_arr + delay
                if rec.get("dep"):
                    dep = _align_rt_epoch(rec["dep"], sched_dep)
                else:
                    dep = sched_dep + delay
            else:
                arr = sched_arr + delay
                dep = sched_dep + delay
            times.append((arr, dep, dist, delay))
        return times

    def _solve(self, trip_id: str, t: dict, date: str, rt_trip: Optional[dict],
               now: float) -> Optional[TrainOut]:
        stops = t["stops"]
        times = self._effective_times(t, date, rt_trip)

        first_dep = times[0][1]
        last_arr = times[-1][0]
        if not (first_dep <= now <= last_arr):
            return None

        shape = self.shapes[t["shape_id"]]
        for i in range(len(times)):
            arr, dep, dist, delay = times[i]
            if now < arr:
                _p_arr, p_dep, p_dist, _p_delay = times[i - 1]
                span = arr - p_dep
                progress = 0.0 if span <= 0 else (now - p_dep) / span
                progress = min(max(progress, 0.0), 1.0)
                d = p_dist + (dist - p_dist) * progress
                speed = 0.0 if span <= 0 else abs(dist - p_dist) / span
                lon, lat, bearing = shape.point_at(d)
                return TrainOut(
                    id=trip_id, line=t["line"], latitude=lat, longitude=lon,
                    bearing=bearing, distance_m=d, speed_m_s=speed,
                    shape_id=t["shape_id"], headsign=t["headsign"],
                    delay_s=delay, status="moving",
                    prev_station=self.stops[stops[i - 1][1]]["name"],
                    next_station=self.stops[stops[i][1]]["name"],
                    next_arrival_ts=int(arr), realtime=rt_trip is not None,
                )
            if arr <= now <= dep:
                lon, lat, bearing = shape.point_at(dist)
                return TrainOut(
                    id=trip_id, line=t["line"], latitude=lat, longitude=lon,
                    bearing=bearing, distance_m=dist, speed_m_s=0.0,
                    shape_id=t["shape_id"], headsign=t["headsign"],
                    delay_s=delay, status="dwelling",
                    prev_station=self.stops[stops[i][1]]["name"],
                    next_station=self.stops[stops[i + 1][1]]["name"] if i + 1 < len(stops) else None,
                    next_arrival_ts=int(times[i + 1][0]) if i + 1 < len(times) else None,
                    realtime=rt_trip is not None,
                )
        return None

