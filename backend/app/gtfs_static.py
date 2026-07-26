"""GTFS static ingest: extract the GVB metro subset from the national feed.

The national gtfs-nl.zip is ~240MB (stop_times.txt alone has millions of rows),
so everything is stream-parsed from the zip without extracting to disk, and the
resulting metro-only subset (a few MB) is cached as JSON for fast startups.
"""
import csv
import io
import json
import logging
import time
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Iterator, List, Optional, Tuple
from zoneinfo import ZoneInfo

import httpx

from .config import (
    CACHE_DIR,
    GTFS_CACHE_FILE,
    GTFS_MAX_AGE_HOURS,
    GTFS_STATIC_URL,
    GTFS_STATIC_ZIP,
    HTTP_HEADERS,
    METRO_LINES,
)

logger = logging.getLogger(__name__)

TZ = ZoneInfo("Europe/Amsterdam")

# Bump when the cached subset schema/semantics change so long-lived caches
# rebuild instead of serving a stale shape (e.g. a metro line dropped because
# GTFS had no nearby service dates).
SUBSET_VERSION = 4


def _line_termini(line: str) -> List[str]:
    return [p.strip().lower() for p in METRO_LINES[line]["name"].split(" - ")]


def _name_has_terminus(stop_name: str, terminus: str) -> bool:
    n = (stop_name or "").lower()
    return terminus in n


def _trip_endpoints_match_line(trip: dict, stops: Dict[str, dict], line: str) -> bool:
    """True when trip first/last stops are the two termini from METRO_LINES."""
    termini = _line_termini(line)
    if len(termini) != 2 or len(trip.get("stops") or []) < 2:
        return False
    first = stops.get(trip["stops"][0][1], {}).get("name", "")
    last = stops.get(trip["stops"][-1][1], {}).get("name", "")
    a, b = termini
    return (
        (_name_has_terminus(first, a) and _name_has_terminus(last, b))
        or (_name_has_terminus(first, b) and _name_has_terminus(last, a))
    )


def _trip_stop_names(trip: dict, stops: Dict[str, dict]) -> set:
    return {
        stops[s[1]]["name"]
        for s in trip.get("stops") or []
        if s[1] in stops
    }


def _geometry_trips_for_line(
    tids: List[str], trips: Dict[str, dict], stops: Dict[str, dict], line: str,
) -> List[str]:
    """Keep every corridor shape the track-union needs; drop foreign branches.

    Same idea as live lines in positions._build_lines: short-turns and both
    directions contribute distinct rail (separate bores / parallel track). Only
    using full terminus-to-terminus trips leaves those stretches undrawn —
    measured up to ~13m off for line 50. Foreign patterns (e.g. 50→Gaasperplas)
    are excluded by requiring stops ⊆ the terminus-to-terminus station set.
    """
    full = [
        tid for tid in tids
        if _trip_endpoints_match_line(trips[tid], stops, line)
    ]
    if not full:
        return tids
    corridor = set()
    for tid in full:
        corridor |= _trip_stop_names(trips[tid], stops)
    return [
        tid for tid in tids
        if _trip_stop_names(trips[tid], stops) <= corridor
    ]


def _rows(zf: zipfile.ZipFile, name: str) -> Iterator[dict]:
    with zf.open(name) as raw:
        text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
        yield from csv.DictReader(text)


def _hms_to_seconds(hms: str) -> int:
    h, m, s = hms.split(":")
    return int(h) * 3600 + int(m) * 60 + int(s)


def _service_dates_of_interest() -> List[str]:
    """Service dates that can have trips running right now: yesterday (late
    night trips run past midnight), today, and tomorrow."""
    now = datetime.now(TZ)
    return [(now + timedelta(days=d)).strftime("%Y%m%d") for d in (-1, 0, 1)]


def download_static(force: bool = False) -> Path:
    if GTFS_STATIC_ZIP.exists() and not force:
        age_h = (time.time() - GTFS_STATIC_ZIP.stat().st_mtime) / 3600
        if age_h < GTFS_MAX_AGE_HOURS:
            logger.info("GTFS zip is %.1fh old, reusing", age_h)
            return GTFS_STATIC_ZIP
    logger.info("Downloading %s ...", GTFS_STATIC_URL)
    GTFS_STATIC_ZIP.parent.mkdir(parents=True, exist_ok=True)
    tmp = GTFS_STATIC_ZIP.with_suffix(".part")
    with httpx.stream(
        "GET",
        GTFS_STATIC_URL,
        headers=HTTP_HEADERS,
        timeout=600,
        follow_redirects=True,
    ) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_bytes(1 << 20):
                f.write(chunk)
    tmp.replace(GTFS_STATIC_ZIP)
    logger.info("Downloaded %.1f MB", GTFS_STATIC_ZIP.stat().st_size / 1e6)
    return GTFS_STATIC_ZIP


def build_subset(zip_path: Path) -> dict:
    """Extract routes 50-54 (GVB metro), their trips for nearby service dates,
    stop_times, stops and shapes.

    Live trains/departures only use trips whose service runs on a nearby date.
    Track geometry also pulls stand-in trips when the nearby window is empty
    for a line, or only covers a short-turn (e.g. summer 51 Isolatorweg↔Zuid
    while METRO_LINES says Centraal Station – Isolatorweg).
    """
    t0 = time.time()
    with zipfile.ZipFile(zip_path) as zf:
        gvb_agency_ids = {
            row["agency_id"]
            for row in _rows(zf, "agency.txt")
            if "GVB" in row.get("agency_name", "").upper()
        }
        logger.info("GVB agency ids: %s", gvb_agency_ids)

        route_to_line: Dict[str, str] = {}
        for row in _rows(zf, "routes.txt"):
            if row.get("route_type") == "1" and row.get("agency_id") in gvb_agency_ids:
                short = row.get("route_short_name", "")
                if short in METRO_LINES:
                    route_to_line[row["route_id"]] = short
        logger.info("Metro routes: %s", route_to_line)

        dates = set(_service_dates_of_interest())
        active_services: set = set()
        for row in _rows(zf, "calendar_dates.txt"):
            if row["date"] in dates and row.get("exception_type", "1") == "1":
                active_services.add(row["service_id"])

        service_dates: Dict[str, List[str]] = {}
        for row in _rows(zf, "calendar_dates.txt"):
            if row["service_id"] in active_services and row["date"] in dates:
                service_dates.setdefault(row["service_id"], []).append(row["date"])

        trips: Dict[str, dict] = {}
        # One stand-in trip per (line, shape) from inactive services. Kept when
        # a line has no nearby trips, or nearby trips do not reach both
        # configured termini — pruned after stop_times are known.
        geom_by_shape: Dict[Tuple[str, str], tuple] = {}
        for row in _rows(zf, "trips.txt"):
            route_id = row["route_id"]
            if route_id not in route_to_line:
                continue
            line = route_to_line[route_id]
            shape_id = row.get("shape_id", "")
            trip = {
                "line": line,
                "shape_id": shape_id,
                "headsign": row.get("trip_headsign", ""),
                "service_id": row["service_id"],
                "stops": [],
            }
            if row["service_id"] in active_services:
                trips[row["trip_id"]] = trip
            elif shape_id and (line, shape_id) not in geom_by_shape:
                geom_by_shape[(line, shape_id)] = (row["trip_id"], trip)
        logger.info("Metro trips (nearby dates): %d", len(trips))

        # Load stand-in shapes for every line up front (cheap: one trip each).
        # After stops are known we drop them if active service already covers
        # the configured termini.
        geom_trips = {tid: trip for (_line, _shape), (tid, trip) in geom_by_shape.items()}
        trips.update(geom_trips)
        if geom_trips:
            logger.info(
                "Geometry candidates: %d trip(s) across lines %s",
                len(geom_trips),
                sorted({t["line"] for t in geom_trips.values()}),
            )

        # stop_times.txt is huge: prefilter on the raw trip_id column value
        trip_ids = set(trips)
        with zf.open("stop_times.txt") as raw:
            text = io.TextIOWrapper(raw, encoding="utf-8-sig", newline="")
            reader = csv.reader(text)
            header = next(reader)
            col = {name: i for i, name in enumerate(header)}
            i_trip, i_arr, i_dep = col["trip_id"], col["arrival_time"], col["departure_time"]
            i_stop, i_seq = col["stop_id"], col["stop_sequence"]
            i_dist = col.get("shape_dist_traveled")
            for r in reader:
                if r[i_trip] in trip_ids:
                    dist = None
                    if i_dist is not None and r[i_dist]:
                        try:
                            dist = float(r[i_dist])
                        except ValueError:
                            dist = None
                    trips[r[i_trip]]["stops"].append([
                        int(r[i_seq]),
                        r[i_stop],
                        _hms_to_seconds(r[i_arr]),
                        _hms_to_seconds(r[i_dep]),
                        dist,
                    ])
        for t in trips.values():
            t["stops"].sort(key=lambda s: s[0])

        used_stops = {s[1] for t in trips.values() for s in t["stops"]}
        stops: Dict[str, dict] = {}
        for row in _rows(zf, "stops.txt"):
            if row["stop_id"] in used_stops:
                stops[row["stop_id"]] = {
                    "name": row.get("stop_name", ""),
                    "lat": float(row["stop_lat"]),
                    "lon": float(row["stop_lon"]),
                }

        # Drop geometry stand-ins that are not needed, or that leave the
        # configured corridor (keeps 50/51 full termini, not foreign branches).
        for line in METRO_LINES:
            active_ids = [
                tid for tid, t in trips.items()
                if t["line"] == line and t["service_id"] in service_dates
            ]
            geom_ids = [
                tid for tid, t in trips.items()
                if t["line"] == line and t["service_id"] not in service_dates
            ]
            if not geom_ids:
                continue
            active_covers = any(
                _trip_endpoints_match_line(trips[tid], stops, line)
                for tid in active_ids
            )
            if active_covers:
                for tid in geom_ids:
                    del trips[tid]
                continue
            chosen = set(_geometry_trips_for_line(geom_ids, trips, stops, line))
            for tid in geom_ids:
                if tid not in chosen:
                    del trips[tid]
            logger.info(
                "Geometry fallback line %s: kept %d/%d corridor trip(s) "
                "(active trips miss configured termini)",
                line, len(chosen), len(geom_ids),
            )

        used_shapes = {t["shape_id"] for t in trips.values() if t["shape_id"]}
        shape_pts: Dict[str, List[List[float]]] = {s: [] for s in used_shapes}
        for row in _rows(zf, "shapes.txt"):
            sid = row["shape_id"]
            if sid in shape_pts:
                dist = row.get("shape_dist_traveled") or ""
                shape_pts[sid].append([
                    int(row["shape_pt_sequence"]),
                    float(row["shape_pt_lon"]),
                    float(row["shape_pt_lat"]),
                    float(dist) if dist else None,
                ])
        shapes: Dict[str, dict] = {}
        for sid, pts in shape_pts.items():
            pts.sort(key=lambda p: p[0])
            shapes[sid] = {
                "coords": [[p[1], p[2]] for p in pts],
                "dists": [p[3] for p in pts],
            }

    subset = {
        "subset_version": SUBSET_VERSION,
        "generated_ts": int(time.time()),
        "route_to_line": route_to_line,
        "trips": trips,
        "stops": stops,
        "shapes": shapes,
        "service_dates": service_dates,
    }
    logger.info(
        "Subset built in %.1fs: %d trips, %d stops, %d shapes",
        time.time() - t0, len(trips), len(stops), len(shapes),
    )
    return subset


def load_subset(force_refresh: bool = False) -> dict:
    if GTFS_CACHE_FILE.exists() and not force_refresh:
        age_h = (time.time() - GTFS_CACHE_FILE.stat().st_mtime) / 3600
        if age_h < GTFS_MAX_AGE_HOURS:
            with open(GTFS_CACHE_FILE, encoding="utf-8") as f:
                subset = json.load(f)
            # Cache must cover today's service dates (guards midnight rollover)
            today = datetime.now(TZ).strftime("%Y%m%d")
            version_ok = subset.get("subset_version") == SUBSET_VERSION
            dates_ok = any(
                today in d for d in subset.get("service_dates", {}).values()
            )
            if version_ok and dates_ok:
                logger.info("Loaded cached subset (%.1fh old)", age_h)
                return subset
    zip_path = download_static()
    subset = build_subset(zip_path)
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(GTFS_CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(subset, f)
    return subset


def service_date_epoch(date_yyyymmdd: str) -> int:
    """Epoch of midnight (local) for a GTFS service date; GTFS times are
    seconds relative to this (and can exceed 24h)."""
    d = datetime.strptime(date_yyyymmdd, "%Y%m%d").replace(tzinfo=TZ)
    return int(d.timestamp())
