"""Security headers on API responses, and no public API docs (audit M1, M2)."""
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main
from app.limits import ClientCounter, RateLimiter
from app.security import API_SECURITY_HEADERS
from tests.conftest import NOW


@pytest.fixture
def client(subset, monkeypatch):
    monkeypatch.setattr(main, "static", main._prepare(subset))
    monkeypatch.setattr(main, "time", SimpleNamespace(time=lambda: NOW))
    monkeypatch.setattr(main, "rate_limiter", RateLimiter(main.RATE_PER_SECOND, main.RATE_BURST))
    return TestClient(main.app)


def _has_security_headers(headers) -> None:
    for name, value in API_SECURITY_HEADERS.items():
        assert headers[name.decode()] == value.decode()


def test_json_answers_carry_security_headers(client):
    r = client.get("/api/lines")
    assert r.status_code == 200
    _has_security_headers(r.headers)


def test_errors_carry_them_too(client):
    r = client.get("/api/station", params={"station": "Nowhere"})
    assert r.status_code == 404
    _has_security_headers(r.headers)


def test_refused_stream_carries_them(client, monkeypatch):
    # The middleware sits on the stream route as well. A refused stream is
    # the cheap way to reach it without holding a stream open in a test.
    full = ClientCounter(max_per_client=0)
    monkeypatch.setattr(main, "stream_clients", full)
    r = client.get("/api/trains/stream")
    assert r.status_code == 429
    _has_security_headers(r.headers)


def test_handler_headers_are_not_overwritten(client):
    # Cache-Control and the like stay as the endpoint set them.
    r = client.get("/api/lines")
    assert "max-age" in r.headers["cache-control"]


def test_api_docs_are_off_by_default(client):
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404
    assert main.app.docs_url is None and main.app.openapi_url is None
