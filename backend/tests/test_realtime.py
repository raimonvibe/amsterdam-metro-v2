"""Stop reports from vehiclePositions.pb and KV15 alerts from alerts.pb.

Trip 50f0 in the synthetic network: at A 12:00, B 12:03-12:03:30, C 12:06:30,
1000m apart. NOW is 12:00.
"""
from types import SimpleNamespace

from fastapi.testclient import TestClient
from google.transit import gtfs_realtime_pb2 as g

from app import main
from app.positions import MetroData
from app.realtime import _parse_alerts, _parse_vehicles, _split_languages
from app.travel import alerts
from tests.conftest import NOW


def _train(metro, rt, at, trip_id="50f0"):
    return next(t for t in metro.trains(rt, now=at) if t.id == trip_id)


def _seen(rt, stop, status, ts, trip_id="50f0"):
    rt.vehicle_stops[trip_id] = {"stop_id": stop, "status": status, "ts": ts}


# --- parsing -------------------------------------------------------------------

def _vehicle_feed():
    feed = g.FeedMessage()
    feed.header.gtfs_realtime_version = "2.0"
    feed.header.timestamp = int(NOW)
    for eid, trip, stop, status, ts in (
        ("2026-10-22:GVB:50:1", "50f0", "B50f", g.VehiclePosition.STOPPED_AT, NOW - 5),
        ("2026-10-22:GVB:50:2", "50f1", "A50f", g.VehiclePosition.IN_TRANSIT_TO, NOW - 9),
        ("2026-10-22:GVB:17:3", "tram", "X", g.VehiclePosition.STOPPED_AT, NOW),
        ("2026-10-22:GVB:50:4", "50f2", "", g.VehiclePosition.STOPPED_AT, NOW),
    ):
        v = feed.entity.add(id=eid).vehicle
        v.trip.trip_id = trip
        if stop:
            v.stop_id = stop
        v.current_status = status
        v.timestamp = int(ts)
    return feed.SerializeToString()


def test_vehicle_parse_keeps_metro_trips_with_a_stop():
    out = _parse_vehicles(_vehicle_feed(), {"50f0", "50f1", "50f2"})
    assert out == {
        "50f0": {"stop_id": "B50f", "status": "at", "ts": int(NOW - 5)},
        "50f1": {"stop_id": "A50f", "status": "to", "ts": int(NOW - 9)},
    }


def test_split_languages():
    assert _split_languages("Metro 52 rijdt niet. -- Metro 52 is not running.") == {
        "nl": "Metro 52 rijdt niet.", "en": "Metro 52 is not running."}
    assert _split_languages("Alleen Nederlands") == {"nl": "Alleen Nederlands", "en": None}
    # As GVB actually sends it: "|" line breaks, "--|" between the languages.
    assert _split_languages(
        "Rituitval M52| door technisch defect.| Details: gvb.nl --| Gap in M52 service|due to technical defect.| Details: gvb.nl"
    ) == {
        "nl": "Rituitval M52 door technisch defect. Details: gvb.nl",
        "en": "Gap in M52 service due to technical defect. Details: gvb.nl",
    }


def test_the_same_message_in_kv15_and_siri_is_shown_once(metro, rt):
    text = {"nl": "Rituitval M52.", "en": "Gap in M52 service."}
    base = {"header": text, "description": text, "periods": [], "cause": "", "effect": ""}
    rt.alerts = [
        {**base, "id": "SIRIGM:1006", "route_ids": [], "stop_ids": ["D52f"]},
        {**base, "id": "KV15:GVB:1006", "route_ids": ["r52"], "stop_ids": ["E52f"]},
    ]
    out = alerts(metro, rt, now=NOW)
    assert len(out) == 1
    assert out[0]["lines"] == ["52"] and out[0]["stations"] == ["D", "E"]
    # Line 52 also calls at B, so this is not the whole line yet.
    assert out[0]["whole_line"] is False
    rt.alerts[1]["stop_ids"] = ["B52f", "E52f"]
    assert alerts(metro, rt, now=NOW)[0]["whole_line"] is True


def _alert_feed():
    feed = g.FeedMessage()
    feed.header.gtfs_realtime_version = "2.0"
    for eid, route, stop, text in (
        ("KV15:GVB:1", "r52", "", "Metro 52 rijdt niet. -- Metro 52 is not running."),
        ("KV15:GVB:2", "r50", "B50f", "Lift buiten gebruik. -- Lift out of service."),
        ("KV15:GVB:3", "bus36", "X", "Bus 36 stopt hier niet. -- Not served by bus 36."),
    ):
        a = feed.entity.add(id=eid).alert
        ie = a.informed_entity.add(route_id=route)
        if stop:
            ie.stop_id = stop
        a.header_text.translation.add(text=text, language="nl")
        a.description_text.translation.add(text=text + "\n", language="nl")
        a.active_period.add(start=int(NOW) - 60, end=0)
    return feed.SerializeToString()


def test_alert_parse_keeps_only_metro_routes_and_stops():
    out = _parse_alerts(_alert_feed(), (frozenset({"r50", "r52"}), frozenset({"B50f"})))
    assert [a["id"] for a in out] == ["KV15:GVB:1", "KV15:GVB:2"]
    assert out[1]["stop_ids"] == ["B50f"] and out[1]["header"]["en"] == "Lift out of service."


def test_alerts_map_to_lines_and_stations_and_drop_expired(metro, rt):
    rt.alerts = _parse_alerts(_alert_feed(), (frozenset({"r50", "r52"}), frozenset({"B50f"})))
    rt.alerts[0]["periods"] = [(int(NOW) - 600, int(NOW) - 60)]  # already over
    out = alerts(metro, rt, now=NOW)
    assert len(out) == 1
    a = out[0]
    assert a["lines"] == ["50"] and a["stations"] == ["B"]
    # Description repeats the header, so it is not sent twice.
    assert a["description"] is None and a["end_ts"] is None


def test_alerts_endpoint(subset, monkeypatch, rt):
    monkeypatch.setattr(main, "static", main._prepare(subset))
    rt.alerts = _parse_alerts(_alert_feed(), (frozenset({"r50", "r52"}), frozenset({"B50f"})))
    monkeypatch.setattr(main.realtime, "state", rt)
    monkeypatch.setattr("app.travel.time", SimpleNamespace(time=lambda: NOW))
    r = TestClient(main.app).get("/api/alerts")
    assert r.status_code == 200
    # The line-wide alert leads.
    assert [a["lines"] for a in r.json()] == [["52"], ["50"]]


# --- confirmed stops in the solver --------------------------------------------

def test_without_a_report_the_position_is_a_schedule_estimate(metro, rt):
    tr = _train(metro, rt, NOW + 230)
    assert tr.confidence == "schedule" and tr.status == "moving" and tr.seen_station is None


def test_report_consistent_with_the_clock_leaves_it_alone(metro, rt):
    # Seen at B 40s ago (feed lag); the clock has it 20s out of B. Both agree.
    _seen(rt, "B50f", "at", NOW + 190)
    tr = _train(metro, rt, NOW + 230)
    assert tr.status == "moving" and tr.next_station == "C" and tr.distance_m > 1000
    assert tr.confidence == "confirmed" and tr.seen_station == "B" and tr.seen_status == "at"


def test_train_seen_ahead_of_the_clock_is_moved_up(metro, rt):
    # The clock has it a third of the way to B; it is already standing at B.
    _seen(rt, "B50f", "at", NOW + 25)
    tr = _train(metro, rt, NOW + 60)
    assert tr.status == "dwelling" and tr.prev_station == "B"


def test_train_not_yet_at_its_stop_is_held_short_of_it(metro, rt):
    # The clock has it past B; signalling says it is still heading to B.
    _seen(rt, "B50f", "to", NOW + 290)
    tr = _train(metro, rt, NOW + 300)
    assert tr.status == "moving" and tr.next_station == "B"
    assert tr.distance_m == 1000 and tr.speed_m_s == 0


def test_older_heading_report_no_longer_holds_it_back(metro, rt):
    # 90s on, it may have reached B and left again: the clock decides.
    _seen(rt, "B50f", "to", NOW + 210)
    tr = _train(metro, rt, NOW + 300)
    assert tr.next_station == "C" and tr.distance_m > 1000


def test_train_reported_under_way_leaves_the_platform(metro, rt):
    # The clock still has it dwelling at B; it has already left for C.
    _seen(rt, "C50f", "to", NOW + 185)
    tr = _train(metro, rt, NOW + 190)
    assert tr.status == "moving" and tr.prev_station == "B" and tr.next_station == "C"
    assert tr.distance_m == 1000 and tr.speed_m_s > 0


def test_stale_report_is_shown_but_not_steered_by(metro, rt):
    _seen(rt, "B50f", "at", NOW + 30)
    tr = _train(metro, rt, NOW + 60 + 200)
    assert tr.confidence == "schedule" and tr.seen_station == "B"


def test_report_for_a_stop_off_the_trip_is_ignored(metro, rt):
    _seen(rt, "D52f", "at", NOW + 225)
    tr = _train(metro, rt, NOW + 230)
    assert tr.confidence == "schedule" and tr.status == "moving"


def test_estimate_never_wraps_to_the_far_terminus():
    # RT can make arr[0] later than dep[0]; times[-1] must not be used.
    times = [(100.0, 50.0, 0.0, 0), (200.0, 200.0, 1000.0, 0), (300.0, 300.0, 2000.0, 0)]
    assert MetroData._estimate(times, 75.0) == ("dwelling", 0, 0.0, 0.0)
