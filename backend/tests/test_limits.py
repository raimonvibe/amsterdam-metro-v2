"""Bounds that keep one visitor (or a script) from exhausting the instance."""
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main
from app.limits import ClientCounter, RateLimiter, TTLCache, client_ip, snap_up
from tests.conftest import NOW


# --- building blocks ---------------------------------------------------------

def test_ttl_cache_evicts_least_recently_used_and_expired():
    c: TTLCache[str] = TTLCache(max_entries=2)
    c.set("a", "A", expires=100)
    c.set("b", "B", expires=100)
    assert c.get("a", now=50) == "A"  # a is now the most recently used
    c.set("c", "C", expires=100)  # over the cap: b goes, not a
    assert c.get("b", now=50) is None and c.get("a", now=50) == "A"
    assert c.get("c", now=150) is None  # expired: gone on lookup
    assert len(c) == 1


def test_ttl_cache_never_grows_past_its_cap():
    c: TTLCache[int] = TTLCache(max_entries=100)
    for i in range(10_000):
        c.set(("station", i), i, expires=1e12)
    assert len(c) == 100


def test_snap_up():
    steps = (15, 30, 45, 60, 120, 180)
    assert [snap_up(v, steps) for v in (5, 15, 16, 50, 121, 180, 999)] == [15, 15, 30, 60, 180, 180, 180]


def test_client_counter_caps_and_releases():
    c = ClientCounter(max_per_client=2)
    assert c.acquire("1.2.3.4") and c.acquire("1.2.3.4")
    assert not c.acquire("1.2.3.4")
    assert c.acquire("5.6.7.8")  # someone else is not affected
    c.release("1.2.3.4")
    assert c.acquire("1.2.3.4")
    c.release("1.2.3.4"), c.release("1.2.3.4")
    assert c.count("1.2.3.4") == 0


def test_rate_limiter_allows_a_burst_then_paces():
    t = [0.0]
    r = RateLimiter(rate=2.0, burst=3, clock=lambda: t[0])
    assert [r.check("x") for _ in range(3)] == [None, None, None]
    wait = r.check("x")
    assert wait is not None and wait >= 1
    assert r.check("y") is None  # per visitor
    t[0] += 0.5  # one token back at 2 per second
    assert r.check("x") is None


def test_rate_limiter_table_stays_small():
    t = [0.0]
    r = RateLimiter(rate=1.0, burst=5, max_clients=50, clock=lambda: t[0])
    for i in range(1000):
        r.check(f"10.0.{i // 256}.{i % 256}")
    assert len(r._buckets) <= 51


def test_client_ip_prefers_the_cdn_header(monkeypatch):
    req = SimpleNamespace(headers={"cf-connecting-ip": "203.0.113.7"}, client=SimpleNamespace(host="10.0.0.1"))
    assert client_ip(req) == "203.0.113.7"
    # No CDN header: the first forwarded address, never the proxy (which
    # would put every visitor in one bucket).
    req = SimpleNamespace(headers={"x-forwarded-for": "198.51.100.4, 10.0.0.1"}, client=SimpleNamespace(host="10.0.0.1"))
    assert client_ip(req) == "198.51.100.4"
    req = SimpleNamespace(headers={}, client=SimpleNamespace(host="10.0.0.1"))
    assert client_ip(req) == "10.0.0.1"


# --- endpoints -----------------------------------------------------------------

@pytest.fixture
def client(subset, monkeypatch):
    monkeypatch.setattr(main, "static", main._prepare(subset))
    monkeypatch.setattr(main, "time", SimpleNamespace(time=lambda: NOW))
    monkeypatch.setattr(main, "rate_limiter", RateLimiter(main.RATE_PER_SECOND, main.RATE_BURST))
    for cache in (main._departures_cache, main._station_info_cache, main._journey_cache):
        cache.clear()
    return TestClient(main.app)


def test_departures_cache_is_bounded_by_the_steps(client, monkeypatch):
    # A sweep over every limit and window lands on a handful of keys. (The
    # sweep is 72 requests: more than one visitor's burst, so lift the rate.)
    monkeypatch.setattr(main, "rate_limiter", RateLimiter(rate=1000, burst=1000))
    for limit in range(1, 61, 7):
        for minutes in range(5, 181, 25):
            assert client.get("/api/departures", params={"station": "B", "limit": limit, "minutes": minutes}).status_code == 200
    assert len(main._departures_cache) <= len(main.DEPARTURE_LIMIT_STEPS) * len(main.DEPARTURE_MINUTES_STEPS)


def test_snapped_departures_still_honour_the_request(client):
    wide = client.get("/api/departures", params={"station": "B", "limit": 60, "minutes": 60}).json()
    narrow = client.get("/api/departures", params={"station": "B", "limit": 3, "minutes": 50}).json()
    assert len(narrow) <= 3
    assert all(d["departure_ts"] <= NOW + 50 * 60 for d in narrow)
    assert narrow == [d for d in wide if d["departure_ts"] <= NOW + 50 * 60][:3]


def test_journey_limit_is_honoured_from_a_larger_cached_answer(client):
    six = client.get("/api/journey", params={"from": "A", "to": "E", "limit": 6}).json()
    two = client.get("/api/journey", params={"from": "A", "to": "E", "limit": 2}).json()
    assert two == six[:2]


def test_rate_limit_returns_429_with_retry_after(client, monkeypatch):
    monkeypatch.setattr(main, "rate_limiter", RateLimiter(rate=0.01, burst=2))
    codes = [client.get("/api/station", params={"station": "B"}).status_code for _ in range(3)]
    assert codes == [200, 200, 429]
    r = client.get("/api/station", params={"station": "B"})
    assert r.status_code == 429 and int(r.headers["retry-after"]) >= 1


def test_stream_refuses_a_visitor_over_the_cap(client, monkeypatch):
    full = ClientCounter(max_per_client=1)
    full.acquire("testclient")  # TestClient's address: one stream already open
    monkeypatch.setattr(main, "stream_clients", full)
    r = client.get("/api/trains/stream")
    assert r.status_code == 429 and r.headers["retry-after"] == "30"
