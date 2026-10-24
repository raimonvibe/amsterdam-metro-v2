"""Bounds on what one visitor, or the sum of all of them, can make the API hold.

The instance has 512 MB and half a CPU. Before these, a script could fill
memory through the departures cache (823,680 possible keys, never evicted),
take every SSE slot so other visitors got 503, or keep the journey planner
recomputing. Everything here is in-process: one instance, no Redis.
"""
import logging
import math
import os
import time
from collections import OrderedDict
from typing import Callable, Dict, Generic, Hashable, Optional, Tuple, TypeVar

from starlette.requests import Request

V = TypeVar("V")
logger = logging.getLogger(__name__)


class TTLCache(Generic[V]):
    """Entries with an expiry, at most `max_entries` of them.

    Least recently used goes first when full, and an expired entry is dropped
    when it is next looked up. Replaces a dict that only ever grew, and the
    journey cache's clear-everything-when-full, which let a sweep of station
    pairs keep the planner recomputing from scratch.
    """

    def __init__(self, max_entries: int) -> None:
        self.max_entries = max_entries
        self._data: "OrderedDict[Hashable, Tuple[float, V]]" = OrderedDict()

    def __len__(self) -> int:
        return len(self._data)

    def get(self, key: Hashable, now: float) -> Optional[V]:
        hit = self._data.get(key)
        if hit is None:
            return None
        expires, value = hit
        if expires < now:
            del self._data[key]
            return None
        self._data.move_to_end(key)
        return value

    def set(self, key: Hashable, value: V, expires: float) -> None:
        self._data[key] = (expires, value)
        self._data.move_to_end(key)
        while len(self._data) > self.max_entries:
            self._data.popitem(last=False)

    def clear(self) -> None:
        self._data.clear()


def snap_up(value: int, steps: Tuple[int, ...]) -> int:
    """The smallest step at least `value`, or the largest step. Requests that
    differ only by a little share one cache entry."""
    for step in steps:
        if value <= step:
            return step
    return steps[-1]


# Header carrying the visitor's address. Render runs behind Cloudflare, which
# sets CF-Connecting-IP and overwrites any value a client sends. Set
# CLIENT_IP_HEADER empty to use the socket peer (local development, tests).
CLIENT_IP_HEADER = os.getenv("CLIENT_IP_HEADER", "cf-connecting-ip").strip().lower()


_source_logged = False


def _note_source(source: str) -> None:
    """Log once which source identifies visitors, so a deploy shows whether
    the CDN header arrives. Never the address itself."""
    global _source_logged
    if not _source_logged:
        _source_logged = True
        logger.info("Per-visitor limits keyed by: %s", source)


def client_ip(request: Request) -> str:
    """Who is asking, for per-visitor limits. Only used to count, never logged
    or stored beyond a few minutes of counters.

    Order: the CDN's header, then the first X-Forwarded-For entry, then the
    socket peer. Behind a proxy the peer is the proxy itself, and keying on it
    would put every visitor in one bucket: real users throttled together. A
    forged X-Forwarded-For can only dodge the limits, never block anyone else,
    so it is the safer fallback.
    """
    if CLIENT_IP_HEADER:
        value = request.headers.get(CLIENT_IP_HEADER, "").strip()
        if value:
            _note_source(CLIENT_IP_HEADER)
            return value[:64]  # header is client-reachable on direct hits: keep it bounded
        forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if forwarded:
            _note_source("x-forwarded-for")
            return forwarded[:64]
    _note_source("socket peer")
    return request.client.host if request.client else "unknown"


class ClientCounter:
    """Open connections per visitor, e.g. SSE streams."""

    def __init__(self, max_per_client: int) -> None:
        self.max_per_client = max_per_client
        self._open: Dict[str, int] = {}

    def acquire(self, client: str) -> bool:
        n = self._open.get(client, 0)
        if n >= self.max_per_client:
            return False
        self._open[client] = n + 1
        return True

    def release(self, client: str) -> None:
        n = self._open.get(client, 0) - 1
        if n > 0:
            self._open[client] = n
        else:
            self._open.pop(client, None)

    def count(self, client: str) -> int:
        return self._open.get(client, 0)


class RateLimiter:
    """Token bucket per visitor: `burst` requests at once, refilled at `rate`
    per second. Idle buckets are swept, so the table stays small."""

    def __init__(self, rate: float, burst: int, max_clients: int = 20000,
                 clock: Callable[[], float] = time.monotonic) -> None:
        self.rate = rate
        self.burst = burst
        self.max_clients = max_clients
        self._clock = clock
        self._buckets: Dict[str, Tuple[float, float]] = {}  # client -> (tokens, at)

    def check(self, client: str) -> Optional[int]:
        """None if the request may go ahead, else seconds to wait."""
        now = self._clock()
        tokens, at = self._buckets.get(client, (float(self.burst), now))
        tokens = min(float(self.burst), tokens + (now - at) * self.rate)
        if tokens < 1:
            self._buckets[client] = (tokens, now)
            return max(1, math.ceil((1 - tokens) / self.rate))
        self._buckets[client] = (tokens - 1, now)
        if len(self._buckets) > self.max_clients:
            self._sweep(now)
        return None

    def _sweep(self, now: float) -> None:
        # A bucket that has refilled completely carries no state: drop it.
        full_after = self.burst / self.rate
        for client, (_tokens, at) in list(self._buckets.items()):
            if now - at >= full_after:
                del self._buckets[client]
        # Still too many (a flood of distinct addresses): drop the oldest.
        if len(self._buckets) > self.max_clients:
            for client, _ in sorted(self._buckets.items(), key=lambda kv: kv[1][1])[: len(self._buckets) - self.max_clients]:
                del self._buckets[client]
