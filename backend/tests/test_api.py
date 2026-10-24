"""Endpoint tests. The TestClient is used without `with`, so the app's
lifespan (GTFS download, realtime poller) never starts: static data is
injected directly instead."""
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main
from app.limits import RateLimiter
from tests.conftest import NOW


@pytest.fixture
def client(subset, monkeypatch):
    monkeypatch.setattr(main, "static", main._prepare(subset))
    # The synthetic timetable runs 12:00-13:00 on one date; pin the clock there.
    monkeypatch.setattr(main, "time", SimpleNamespace(time=lambda: NOW))
    monkeypatch.setattr(main, "rate_limiter", RateLimiter(main.RATE_PER_SECOND, main.RATE_BURST))
    for cache in (main._departures_cache, main._station_info_cache, main._journey_cache):
        cache.clear()
    return TestClient(main.app)


def test_network_endpoint(client):
    r = client.get("/api/network")
    assert r.status_code == 200
    assert [line["id"] for line in r.json()] == ["50", "52"]
    assert "max-age" in r.headers["cache-control"]


def test_departures_validates_parameters(client):
    assert client.get("/api/departures", params={"station": "B", "minutes": 500}).status_code == 422
    assert client.get("/api/departures", params={"station": "B", "limit": 0}).status_code == 422


def test_departures_unknown_station_is_empty_list(client):
    r = client.get("/api/departures", params={"station": "Nowhere"})
    assert r.status_code == 200 and r.json() == []


def test_departures_cache_key_includes_new_params(client):
    a = client.get("/api/departures", params={"station": "B", "limit": 60, "minutes": 15}).json()
    b = client.get("/api/departures", params={"station": "B", "limit": 60, "minutes": 180}).json()
    assert len(b) >= len(a)
    assert {"scheduled_ts", "stops_remaining", "cancelled"} <= set(b[0])


def test_station_endpoint(client):
    assert client.get("/api/station", params={"station": "Nowhere"}).status_code == 404
    r = client.get("/api/station", params={"station": "B"})
    assert r.status_code == 200 and r.json()["station"] == "B"


def test_journey_endpoint_validation(client):
    assert client.get("/api/journey", params={"from": "B", "to": "B"}).status_code == 422
    assert client.get("/api/journey", params={"from": "B", "to": "Nowhere"}).status_code == 404
    assert client.get("/api/journey", params={"from": "A", "to": "E", "limit": 11}).status_code == 422
    r = client.get("/api/journey", params={"from": "A", "to": "C"})
    assert r.status_code == 200 and isinstance(r.json(), list)


def test_endpoints_503_while_static_loads(monkeypatch):
    monkeypatch.setattr(main, "static", None)
    c = TestClient(main.app)
    for path, params in (("/api/network", {}), ("/api/station", {"station": "B"}),
                         ("/api/journey", {"from": "A", "to": "C"})):
        assert c.get(path, params=params).status_code == 503


def test_gzip_negotiation(client):
    r = client.get("/api/network", headers={"Accept-Encoding": "gzip"})
    assert r.headers.get("content-encoding") == "gzip"
    assert json.loads(r.content)  # httpx decodes it transparently
