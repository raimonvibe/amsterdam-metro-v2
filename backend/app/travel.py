"""Travel information derived from the same static subset and realtime state
as the map: per-station service info, a journey planner (direct and one
transfer) and the line network. Read-only over MetroData; nothing here changes
the cached subset, so adding features never forces a GTFS re-download.
"""
import statistics
import time
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from .config import METRO_LINES
from .gtfs_static import TZ, service_date_epoch
from .positions import MetroData
from .realtime import RealtimeState

# A service day runs past midnight (last metros leave around 00:30); before
# this local hour, "today" for first/last-train purposes is still yesterday.
SERVICE_DAY_START_HOUR = 4
# Time to change trains at the same station (stairs between platforms).
MIN_TRANSFER_S = 120
JOURNEY_HORIZON_S = 90 * 60
# Transfer legs may leave a while after the first leg's window ends.
TRANSFER_SLACK_S = 45 * 60


def _service_day(now: float) -> str:
    local = datetime.fromtimestamp(now, TZ)
    if local.hour < SERVICE_DAY_START_HOUR:
        local -= timedelta(days=1)
    return local.strftime("%Y%m%d")


def _names(metro: MetroData, t: dict) -> List[str]:
    return [metro.stops[s[1]]["name"] for s in t["stops"]]


def _patterns(metro: MetroData) -> Dict[Tuple[str, str], Tuple[List[str], List[float]]]:
    """(line, headsign) -> (most common station sequence, median run time in
    seconds from each station to the next along it). Computed once per
    MetroData: it scans every trip."""
    cached = getattr(metro, "_travel_patterns", None)
    if cached is not None:
        return cached
    counts: Dict[Tuple[str, str], Counter] = defaultdict(Counter)
    runs: Dict[Tuple[str, str, tuple], List[List[float]]] = defaultdict(list)
    for t in metro.trips.values():
        names = tuple(_names(metro, t))
        key = (t["line"], t["headsign"])
        counts[key][names] += 1
        runs[(*key, names)].append(
            [t["stops"][k + 1][2] - t["stops"][k][3] for k in range(len(t["stops"]) - 1)]
        )
    out = {}
    for key, c in counts.items():
        names = c.most_common(1)[0][0]
        segs = runs[(*key, names)]
        medians = [float(statistics.median(col)) for col in zip(*segs)] if segs else []
        out[key] = (list(names), medians)
    metro._travel_patterns = out  # type: ignore[attr-defined]
    return out


def network(metro: MetroData) -> List[dict]:
    """Per line, each direction's ordered stations and typical run times."""
    pats = _patterns(metro)
    lines = []
    for line_id in sorted({line for line, _ in pats}):
        meta = METRO_LINES.get(line_id, {})
        directions = [
            {"headsign": hs, "stations": names, "runtimes_s": runtimes}
            for (line, hs), (names, runtimes) in sorted(pats.items())
            if line == line_id
        ]
        lines.append({
            "id": line_id,
            "name": meta.get("name", line_id),
            "color": meta.get("color", "#999999"),
            "directions": directions,
        })
    return lines


def station_info(metro: MetroData, station: str, rt: RealtimeState,
                 now: Optional[float] = None) -> dict:
    """First and last scheduled departure of the current service day, the
    current frequency and the stops ahead, per direction serving a station."""
    now = now or time.time()
    day = _service_day(now)
    base = service_date_epoch(day)
    pats = _patterns(metro)
    first_last: Dict[Tuple[str, str], List[int]] = {}
    for trip_id in metro._trips_by_station.get(station, ()):
        t = metro.trips[trip_id]
        if day not in metro.service_dates.get(t["service_id"], []):
            continue
        for i, (_seq, stop_id, _arr, dep_s, _d) in enumerate(t["stops"][:-1]):
            if metro.stops[stop_id]["name"] == station:
                key = (t["line"], t["headsign"])
                ts = int(base + dep_s)
                fl = first_last.setdefault(key, [ts, ts])
                fl[0], fl[1] = min(fl[0], ts), max(fl[1], ts)
    # Frequency from what actually runs in the next hour (realtime included).
    upcoming: Dict[Tuple[str, str], List[int]] = defaultdict(list)
    for d in metro.departures(station, rt, now=now, limit=500, horizon_s=3600):
        upcoming[(d["line"], d["headsign"])].append(d["departure_ts"])
    directions = []
    for key in sorted(set(first_last) | set(upcoming)):
        line, headsign = key
        deps = sorted(upcoming.get(key, []))
        gaps = [b - a for a, b in zip(deps, deps[1:]) if b > a]
        names = pats.get(key, ([], []))[0]
        ahead = names[names.index(station) + 1:] if station in names else []
        fl = first_last.get(key)
        directions.append({
            "line": line,
            "headsign": headsign,
            "first_ts": fl[0] if fl else None,
            "last_ts": fl[1] if fl else None,
            "headway_min": round(statistics.median(gaps) / 60, 1) if gaps else None,
            "departures_next_hour": len(deps),
            "next_stops": ahead,
        })
    lines = sorted({d["line"] for d in directions})
    return {"station": station, "lines": lines, "service_day": day, "directions": directions}


def _runs_from(metro: MetroData, rt: RealtimeState, station: str, trip_ids,
               start: float, end: float):
    """Runs leaving `station` between start and end: (dep, index, trip_id, t,
    times). Cancelled runs and skipped calls are left out."""
    for trip_id in trip_ids:
        t = metro.trips[trip_id]
        rt_trip = rt.trip_updates.get(trip_id)
        rt_stops = rt_trip["stops"] if rt_trip else {}
        for date in metro.service_dates.get(t["service_id"], []):
            if rt.is_cancelled(trip_id, date) or not metro._may_run(t, date, start, end):
                continue
            times = None
            for i, (seq, stop_id, *_r) in enumerate(t["stops"][:-1]):
                if metro.stops[stop_id]["name"] != station or rt_stops.get(seq, {}).get("skipped"):
                    continue
                times = times or metro._effective_times(t, date, rt_trip)
                dep = times[i][1]
                if start <= dep <= end:
                    yield dep, i, trip_id, t, times, rt_trip is not None
                break


def _arrival_at(metro: MetroData, t: dict, times, after: int, station: str) -> Optional[int]:
    for j in range(after + 1, len(t["stops"])):
        if metro.stops[t["stops"][j][1]]["name"] == station:
            return j
    return None


def _leg(metro, t, trip_id, times, i, j, live) -> dict:
    return {
        "trip_id": trip_id,
        "line": t["line"],
        "headsign": t["headsign"],
        "from": metro.stops[t["stops"][i][1]]["name"],
        "to": metro.stops[t["stops"][j][1]]["name"],
        "departure_ts": int(times[i][1]),
        "arrival_ts": int(times[j][0]),
        "stops": j - i,
        "delay_s": times[i][3],
        "realtime": live,
    }


def journeys(metro: MetroData, rt: RealtimeState, origin: str, dest: str,
             now: Optional[float] = None, limit: int = 5) -> List[dict]:
    """Direct and one-transfer journeys from origin to dest, leaving within
    JOURNEY_HORIZON_S. An option is dropped when another leaves no earlier,
    arrives no later and transfers no more often."""
    now = now or time.time()
    if origin == dest:
        return []
    by_station = metro._trips_by_station
    options: List[dict] = []
    # Per transfer station: runs from there that later reach dest, by departure.
    onward: Dict[str, list] = {}

    def onward_from(station: str) -> list:
        if station not in onward:
            ids = set(by_station.get(station, ())) & set(by_station.get(dest, ()))
            rows = []
            for dep, i, trip_id, t, times, live in _runs_from(
                metro, rt, station, ids, now, now + JOURNEY_HORIZON_S + TRANSFER_SLACK_S,
            ):
                j = _arrival_at(metro, t, times, i, dest)
                if j is not None:
                    rows.append((dep, _leg(metro, t, trip_id, times, i, j, live)))
            rows.sort(key=lambda r: r[0])
            onward[station] = rows
        return onward[station]

    for dep, i, trip_id, t, times, live in _runs_from(
        metro, rt, origin, by_station.get(origin, ()), now - 30, now + JOURNEY_HORIZON_S,
    ):
        j = _arrival_at(metro, t, times, i, dest)
        if j is not None:
            leg = _leg(metro, t, trip_id, times, i, j, live)
            options.append({"legs": [leg]})
            continue
        best = None
        for k in range(i + 1, len(t["stops"])):
            transfer = metro.stops[t["stops"][k][1]]["name"]
            if transfer == origin:
                continue
            arrive = times[k][0]
            for dep2, leg2 in onward_from(transfer):
                if dep2 >= arrive + MIN_TRANSFER_S and leg2["trip_id"] != trip_id:
                    if best is None or leg2["arrival_ts"] < best[1]["arrival_ts"]:
                        best = (_leg(metro, t, trip_id, times, i, k, live), leg2)
                    break
        if best:
            options.append({"legs": list(best)})

    for o in options:
        o["departure_ts"] = o["legs"][0]["departure_ts"]
        o["arrival_ts"] = o["legs"][-1]["arrival_ts"]
        o["duration_s"] = o["arrival_ts"] - o["departure_ts"]
        o["transfers"] = len(o["legs"]) - 1

    def dominated(o: dict) -> bool:
        return any(
            p is not o
            and p["departure_ts"] >= o["departure_ts"]
            and p["arrival_ts"] <= o["arrival_ts"]
            and p["transfers"] <= o["transfers"]
            and (p["departure_ts"], p["arrival_ts"], p["transfers"])
            != (o["departure_ts"], o["arrival_ts"], o["transfers"])
            for p in options
        )

    seen = set()
    kept = []
    for o in sorted(options, key=lambda o: (o["departure_ts"], o["arrival_ts"], o["transfers"])):
        sig = (o["departure_ts"], o["arrival_ts"], o["transfers"])
        if sig in seen or dominated(o):
            continue
        seen.add(sig)
        kept.append(o)
    return kept[:limit]
