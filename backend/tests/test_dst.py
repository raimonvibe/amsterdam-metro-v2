"""Timetable times on the days the clocks change.

GTFS counts a service day's times from "noon minus 12h" local time. Counting
from local midnight put every time on the last Sunday of October an hour
early (and on the last Sunday of March an hour late).
"""
from datetime import datetime

import pytest

from app import main
from app.gtfs_static import TZ, service_date_epoch


def local(date: str, seconds: int) -> str:
    """Local wall-clock time of a GTFS time on a service date."""
    return datetime.fromtimestamp(service_date_epoch(date) + seconds, TZ).strftime("%Y-%m-%d %H:%M")


@pytest.mark.parametrize("date, label", [
    ("20261025", "clocks back, 2026"),
    ("20270328", "clocks forward, 2027"),
    ("20271031", "clocks back, 2027"),
    ("20280326", "clocks forward, 2028"),
    ("20261024", "ordinary Saturday"),
    ("20261026", "ordinary Monday"),
])
def test_timetable_times_are_wall_clock_times_every_day(date, label):
    day = f"{date[:4]}-{date[4:6]}-{date[6:]}"
    # Well after the change (it happens at 02:00/03:00): exactly as timetabled.
    assert local(date, 6 * 3600) == f"{day} 06:00", label
    assert local(date, 12 * 3600) == f"{day} 12:00", label
    assert local(date, 23 * 3600 + 30 * 60) == f"{day} 23:30", label


def test_first_train_on_the_autumn_change_day_is_not_an_hour_early():
    # The bug this replaces: 06:00 came out as 05:00 on 25 Oct 2026.
    assert local("20261025", 6 * 3600).endswith("06:00")


def test_after_midnight_runs_on_the_eve_of_the_change():
    # Saturday's last metros run past midnight (24:30 = 00:30 Sunday),
    # before the 03:00 change: still read as 00:30.
    assert local("20261024", 24 * 3600 + 30 * 60) == "2026-10-25 00:30"


def test_noon_is_noon_on_every_day_of_a_year():
    # Every day of 2027, both changes included.
    for month in range(1, 13):
        for d in range(1, 29):
            date = f"2027{month:02d}{d:02d}"
            assert local(date, 12 * 3600).endswith("12:00"), date


def test_stream_cap_allows_a_shared_address():
    # A school, office or mobile network shares one address; 100 per address
    # still leaves one client unable to take all 500 slots.
    assert main.STREAM_MAX_PER_CLIENT == 100 < main.STREAM_MAX_CLIENTS
