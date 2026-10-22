from app import travel
from tests.conftest import BASE, NOW, hhmm


# --- departures (extended board fields) -------------------------------------

def test_departures_respects_horizon(metro, rt):
    short = metro.departures("B", rt, now=NOW, limit=100, horizon_s=15 * 60)
    long = metro.departures("B", rt, now=NOW, limit=100, horizon_s=90 * 60)
    assert 0 < len(short) < len(long)
    assert all(d["departure_ts"] <= NOW + 15 * 60 for d in short)


def test_departures_board_fields(metro, rt):
    d = metro.departures("A", rt, now=NOW, limit=1)[0]
    assert hhmm(d["departure_ts"]) == "12:00"
    assert d["scheduled_ts"] == d["departure_ts"]
    assert d["stops_remaining"] == 2
    assert d["terminus_ts"] > d["departure_ts"]
    assert d["cancelled"] is False and d["realtime"] is False
    assert d["platform"] == "1"


def test_departures_platform_is_none_where_the_feed_has_none(metro, rt):
    deps = metro.departures("B", rt, now=NOW, limit=10)
    assert deps and all(d["platform"] is None for d in deps)


def test_departures_never_list_a_terminus_arrival(metro, rt):
    # C is the end of line 50 eastbound: only the westbound run leaves from it.
    assert {d["headsign"] for d in metro.departures("C", rt, now=NOW, limit=50)} == {"A"}


def test_cancelled_runs_hidden_by_default_and_flagged_on_request(metro, rt):
    rt.cancelled["50f0"] = {"20261022"}
    default = metro.departures("A", rt, now=NOW, limit=50)
    assert all(d["trip_id"] != "50f0" for d in default)
    flagged = [d for d in metro.departures("A", rt, now=NOW, limit=50, include_cancelled=True)
               if d["trip_id"] == "50f0"]
    assert len(flagged) == 1 and flagged[0]["cancelled"] is True
    assert flagged[0]["realtime"] is False


def test_realtime_delay_moves_the_departure(metro, rt):
    rt.trip_updates["50f0"] = {"stops": {1: {"arr": None, "dep": None, "delay": 120, "skipped": False}}, "ts": NOW}
    d = next(d for d in metro.departures("A", rt, now=NOW, limit=50) if d["trip_id"] == "50f0")
    assert d["departure_ts"] - d["scheduled_ts"] == 120
    assert d["delay_s"] == 120 and d["realtime"] is True


# --- network ----------------------------------------------------------------

def test_network_orders_stations_per_direction(metro):
    net = {line["id"]: line for line in travel.network(metro)}
    assert set(net) == {"50", "52"}
    dirs = {d["headsign"]: d for d in net["50"]["directions"]}
    assert dirs["C"]["stations"] == ["A", "B", "C"]
    assert dirs["A"]["stations"] == ["C", "B", "A"]
    assert dirs["C"]["runtimes_s"] == [180.0, 180.0]
    assert net["50"]["color"].startswith("#")


# --- station info -----------------------------------------------------------

def test_station_info_first_last_headway_and_stops_ahead(metro, rt):
    info = travel.station_info(metro, "B", rt, now=NOW)
    assert info["lines"] == ["50", "52"]
    by_dir = {(d["line"], d["headsign"]): d for d in info["directions"]}
    to_c = by_dir[("50", "C")]
    assert hhmm(to_c["first_ts"]) == "12:03"
    assert hhmm(to_c["last_ts"]) == "12:53"
    assert to_c["headway_min"] == 10.0
    assert to_c["next_stops"] == ["C"]
    assert by_dir[("52", "E")]["next_stops"] == ["D", "E"]


def test_service_day_rolls_over_at_four_not_midnight():
    assert travel._service_day(BASE + 24 * 3600 + 2 * 3600) == "20261022"  # 02:00 next day
    assert travel._service_day(BASE + 24 * 3600 + 5 * 3600) == "20261023"


# --- journeys ---------------------------------------------------------------

def test_direct_journey(metro, rt):
    js = travel.journeys(metro, rt, "A", "C", now=NOW)
    assert js, "expected direct options"
    first = js[0]
    assert first["transfers"] == 0
    assert hhmm(first["departure_ts"]) == "12:00"
    assert first["duration_s"] == 2 * 180 + 30
    assert [leg["line"] for leg in first["legs"]] == ["50"]


def test_one_transfer_journey_respects_minimum_change_time(metro, rt):
    js = travel.journeys(metro, rt, "A", "E", now=NOW)
    assert js and all(j["transfers"] == 1 for j in js)
    leg1, leg2 = js[0]["legs"]
    assert (leg1["from"], leg1["to"], leg2["from"], leg2["to"]) == ("A", "B", "B", "E")
    assert leg2["departure_ts"] - leg1["arrival_ts"] >= travel.MIN_TRANSFER_S


def test_journeys_drop_dominated_options(metro, rt):
    js = travel.journeys(metro, rt, "A", "E", now=NOW, limit=10)
    for o in js:
        for p in js:
            if p is not o:
                assert not (p["departure_ts"] >= o["departure_ts"] and p["arrival_ts"] < o["arrival_ts"]
                            and p["transfers"] <= o["transfers"])


def test_journeys_skip_cancelled_runs(metro, rt):
    rt.cancelled["50f0"] = {"20261022"}
    js = travel.journeys(metro, rt, "A", "C", now=NOW)
    assert all(leg["trip_id"] != "50f0" for j in js for leg in j["legs"])
    assert hhmm(js[0]["departure_ts"]) == "12:10"


def test_journeys_same_station_is_empty(metro, rt):
    assert travel.journeys(metro, rt, "B", "B", now=NOW) == []


def test_journeys_against_direction_of_line_use_reverse_runs(metro, rt):
    js = travel.journeys(metro, rt, "E", "A", now=NOW)
    assert js and js[0]["legs"][0]["line"] == "52" and js[0]["legs"][-1]["to"] == "A"


# --- trains: platform for the map popup --------------------------------------

def _train(metro, rt, trip_id, at):
    return next(t for t in metro.trains(rt, now=at) if t.id == trip_id)


def test_train_platform_is_where_it_stands_or_arrives_next(metro, rt):
    standing = _train(metro, rt, "50f0", NOW)  # dwelling at A, its first stop
    assert standing.status == "dwelling" and standing.prev_station == "A" and standing.platform == "1"
    to_b = _train(metro, rt, "50f0", NOW + 60)  # B has no platform in the feed
    assert to_b.next_station == "B" and to_b.platform is None
    to_c = _train(metro, rt, "50f0", NOW + 5 * 60)
    assert to_c.status == "moving" and to_c.next_station == "C" and to_c.platform == "1"
