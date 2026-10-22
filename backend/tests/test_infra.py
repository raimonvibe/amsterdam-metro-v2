"""The SSE broadcaster and the static-download error from earlier work."""
import asyncio
import pickle
import time
from email.utils import formatdate

from app.broadcast import DROPPED, Broadcaster
from app.gtfs_static import StaticDownloadError, _retry_after_seconds


def test_broadcast_reaches_every_subscriber():
    async def run():
        b = Broadcaster(max_queued=3)
        q1, q2 = b.subscribe(), b.subscribe()
        b.publish("snap")
        return await q1.get(), await q2.get(), len(b)
    assert asyncio.run(run()) == ("snap", "snap", 2)


def test_slow_subscriber_is_dropped_not_waited_for():
    async def run():
        b = Broadcaster(max_queued=2)
        slow, fast = b.subscribe(), b.subscribe()
        for n in range(3):
            b.publish(n)
            await fast.get()
        items = [slow.get_nowait() for _ in range(slow.qsize())]
        return items, len(b)
    items, remaining = asyncio.run(run())
    assert items == [DROPPED]  # backlog discarded, only the end-of-stream marker left
    assert remaining == 1


def test_unsubscribe_is_idempotent():
    async def run():
        b = Broadcaster(max_queued=1)
        q = b.subscribe()
        b.unsubscribe(q)
        b.unsubscribe(q)
        return len(b)
    assert asyncio.run(run()) == 0


def test_static_download_error_survives_pickling():
    e = pickle.loads(pickle.dumps(StaticDownloadError("HTTP 429", 120.0)))
    assert str(e) == "HTTP 429" and e.retry_after == 120.0


def test_retry_after_parsing():
    assert _retry_after_seconds("120") == 120.0
    assert _retry_after_seconds(None) is None
    assert _retry_after_seconds("soon") is None
    assert 290 < _retry_after_seconds(formatdate(time.time() + 300, usegmt=True)) <= 300
