"""A tiny synthetic network, so tests never depend on the real GTFS feed:

    line 50:  A — B — C        (every 10 min from 12:00, 3 min per hop)
    line 52:      B — D — E    (every 10 min, leaving B at :04, :14, ...)

B is the transfer station. All runs are on one service date, 2026-10-22,
and NOW is 12:00 Amsterdam time on that day.
"""
import logging
from datetime import datetime

import pytest

from app.gtfs_static import SUBSET_VERSION, TZ, service_date_epoch
from app.positions import MetroData
from app.realtime import RealtimeState

logging.disable(logging.INFO)

DATE = "20261022"
BASE = service_date_epoch(DATE)
NOW = BASE + 12 * 3600
NOON = 12 * 3600

STATIONS = {"A": 0.00, "B": 0.01, "C": 0.02, "D": 0.03, "E": 0.04}


def _stop_id(station: str, line: str, direction: str) -> str:
    return f"{station}{line}{direction}"


def _trips(line, names, first_dep, count, hop_s=180, dwell_s=30):
    trips = {}
    for direction, seq_names in (("f", names), ("r", list(reversed(names)))):
        for n in range(count):
            dep = first_dep + n * 600
            stops = []
            t = dep
            for k, name in enumerate(seq_names):
                arr = t
                d = arr if k == 0 else arr + dwell_s
                stops.append([k + 1, _stop_id(name, line, direction), arr, d, float(k * 1000)])
                t = d + hop_s
            trips[f"{line}{direction}{n}"] = {
                "line": line,
                "shape_id": f"sh{line}{direction}",
                "headsign": seq_names[-1],
                "service_id": "svc",
                "stops": stops,
            }
    return trips


@pytest.fixture
def subset():
    trips = {}
    trips.update(_trips("50", ["A", "B", "C"], NOON, 6))
    trips.update(_trips("52", ["B", "D", "E"], NOON + 4 * 60, 6))
    stops = {}
    shapes = {}
    for line, names in (("50", ["A", "B", "C"]), ("52", ["B", "D", "E"])):
        for direction, seq in (("f", names), ("r", list(reversed(names)))):
            for name in seq:
                stops[_stop_id(name, line, direction)] = {"name": name, "lat": 52.37, "lon": 4.9 + STATIONS[name]}
                # Platforms 1/2 by direction; the transfer station B has none,
                # like the big interchanges in the real feed.
                if name != "B":
                    stops[_stop_id(name, line, direction)]["platform"] = "1" if direction == "f" else "2"
            shapes[f"sh{line}{direction}"] = {
                "coords": [[4.9 + STATIONS[n], 52.37] for n in seq],
                "dists": [float(k * 1000) for k in range(len(seq))],
            }
    return {
        "subset_version": SUBSET_VERSION,
        "generated_ts": int(NOW) - 3600,
        "route_to_line": {"r50": "50", "r52": "52"},
        "trips": trips,
        "stops": stops,
        "shapes": shapes,
        "service_dates": {"svc": [DATE]},
    }


@pytest.fixture
def metro(subset):
    return MetroData(subset)


@pytest.fixture
def rt():
    return RealtimeState()


def hhmm(ts: float) -> str:
    return datetime.fromtimestamp(ts, TZ).strftime("%H:%M")
