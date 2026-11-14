"""Messages next to GVB's own: lines the timetable has not running today, and
notices set by hand in app/notices.json (docs/service-notices.md)."""
import json
from datetime import datetime

from app.config import METRO_LINES
from app.gtfs_static import TZ
from app.positions import MetroData
from app.realtime import RealtimeState
from app.travel import NOTICES_FILE, alerts, lines_not_running, load_notices, site_notices
from tests.conftest import NOW


def _with_line_52_tomorrow_only(subset: dict) -> MetroData:
    """Line 52 runs the next day but not today, like line 53 on a test weekend."""
    subset["service_dates"]["svc_next"] = ["20261023"]
    for t in subset["trips"].values():
        if t["line"] == "52":
            t["service_id"] = "svc_next"
    return MetroData(subset)


def test_a_line_running_on_another_day_but_not_today_is_named(subset):
    out = lines_not_running(_with_line_52_tomorrow_only(subset), NOW)
    assert [a["lines"] for a in out] == [["52"]]
    a = out[0]
    assert a["source"] == "timetable" and a["whole_line"] and a["stations"] == []
    assert a["header"]["nl"] == "Metro 52 rijdt vandaag niet."
    assert a["id"] == "timetable:no-service:52:20261022"


def test_lines_that_run_today_or_never_say_nothing(metro):
    # 50 and 52 run today; 51, 53 and 54 have no trips on any day in the
    # subset (gone for good, as after a renumbering), so nothing is said.
    assert lines_not_running(metro, NOW) == []


def test_a_subset_without_today_guesses_nothing(subset):
    subset["service_dates"] = {"svc": ["20261020"]}
    assert lines_not_running(MetroData(subset), NOW) == []


def test_before_four_the_service_day_is_still_yesterday(subset):
    # 02:00 on the 23rd belongs to the 22nd's service day, when 50 ran.
    metro = _with_line_52_tomorrow_only(subset)
    two_am = NOW + 14 * 3600
    assert [a["lines"] for a in lines_not_running(metro, two_am)] == [["52"]]


def _notice(**kw):
    n = {
        "id": "works",
        "start": "2026-10-22T04:00",
        "end": "2026-10-23T04:00",
        "lines": ["50"],
        "stations": [],
        "header": {"nl": "Werkzaamheden.", "en": "Engineering works."},
    }
    n.update(kw)
    return n


def test_a_hand_notice_shows_only_while_in_force():
    assert [a["id"] for a in site_notices([_notice()], NOW)] == ["site:works"]
    assert site_notices([_notice(start="2026-10-22T13:00")], NOW) == []
    assert site_notices([_notice(end="2026-10-22T11:00")], NOW) == []


def test_a_hand_notice_is_marked_as_ours_and_keeps_its_times():
    a = site_notices([_notice(stations=["B"])], NOW)[0]
    assert a["source"] == "site" and a["lines"] == ["50"] and a["stations"] == ["B"]
    assert a["whole_line"] is False
    assert a["end_ts"] == int(datetime(2026, 10, 23, 4, 0, tzinfo=TZ).timestamp())


def test_all_three_kinds_come_out_together(subset):
    metro = _with_line_52_tomorrow_only(subset)
    out = alerts(metro, RealtimeState(), now=NOW, notices=[_notice()])
    assert sorted(a["source"] for a in out) == ["site", "timetable"]


def test_a_broken_notices_file_hides_only_the_notices(tmp_path):
    bad = tmp_path / "notices.json"
    bad.write_text("{ not json", encoding="utf-8")
    assert load_notices(bad) == []
    assert load_notices(tmp_path / "missing.json") == []


def test_the_real_notices_file_is_valid():
    raw = json.loads(NOTICES_FILE.read_text(encoding="utf-8"))
    ids = [n["id"] for n in raw["notices"]]
    assert len(ids) == len(set(ids)), "notice ids must be unique"
    for n in raw["notices"]:
        start = datetime.fromisoformat(n["start"])
        end = datetime.fromisoformat(n["end"])
        assert start < end, n["id"]
        assert start.tzinfo is None and end.tzinfo is None, "write times in Amsterdam time, without an offset"
        assert n["header"]["nl"].strip() and n["header"]["en"].strip(), n["id"]
        assert set(n.get("lines", [])) <= set(METRO_LINES), n["id"]
        assert n.get("source_url", "").startswith("https://"), "say where the notice comes from"


def _gvb(line_route: str, effect: str = "UNKNOWN_EFFECT") -> dict:
    """One alert as _parse_alerts gives it, in force now."""
    return {
        "id": f"KV15:{line_route}", "header": {"nl": "M52 rijdt niet. Stap over.", "en": None},
        "description": {}, "route_ids": [line_route], "stop_ids": [], "periods": [],
        "cause": "UNKNOWN_CAUSE", "effect": effect,
    }


def test_gvb_reporting_the_line_hides_the_timetable_message(subset):
    rt = RealtimeState()
    rt.alerts = [_gvb("r52")]
    out = alerts(_with_line_52_tomorrow_only(subset), rt, now=NOW, notices=[])
    assert [a["source"] for a in out] == ["gvb"]


def test_a_gvb_lift_message_does_not_hide_it(subset):
    rt = RealtimeState()
    rt.alerts = [_gvb("r52", effect="ACCESSIBILITY_ISSUE")]
    out = alerts(_with_line_52_tomorrow_only(subset), rt, now=NOW, notices=[])
    assert sorted(a["source"] for a in out) == ["gvb", "timetable"]


def test_gvb_on_another_line_leaves_it(subset):
    rt = RealtimeState()
    rt.alerts = [_gvb("r50")]
    out = alerts(_with_line_52_tomorrow_only(subset), rt, now=NOW, notices=[])
    assert sorted(a["source"] for a in out) == ["gvb", "timetable"]
