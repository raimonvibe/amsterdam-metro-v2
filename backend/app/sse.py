"""Server-Sent Events response for long-lived, broadcast-fed streams.

Not FastAPI's EventSourceResponse: that one runs its keepalive pings in a
separate task joined by memory streams, and when a client with a backed-up
socket disconnects, that task dies with BrokenResourceError. The error is
logged, and the producer dies with it before the endpoint's cleanup runs, so
the client's broadcast queue leaked. Here the heartbeat is just a timeout in
the endpoint's own generator, and cleanup is tied to the response, not to
generator finalisation.
"""
import zlib
from typing import AsyncIterator, Callable

import anyio
from starlette.requests import ClientDisconnect
from starlette.responses import StreamingResponse
from starlette.types import Receive, Scope, Send

# no-cache: never store or revalidate a live stream. no-transform: proxies
# must not re-encode it (recompressing a stream is a classic way to buffer
# it). X-Accel-Buffering: nginx (and proxies that honour it) must pass each
# event through as it is written.
STREAM_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
    "Vary": "Accept-Encoding",
}
HEARTBEAT = b": ping\n\n"

# Per-client gzip. Consecutive snapshots are nearly identical, so with the
# previous event still in the window an update compresses to ~1 KB (measured:
# 13 KB raw, 2.6 KB gzipped on its own). 16 KB window + memLevel 4 is ~72 KB
# of zlib state per stream; if events outgrow the window, compression falls
# back to roughly per-event gzip rather than failing.
GZIP_WBITS = 16 + 14  # 16+: gzip wrapper; 14: 16 KB window
GZIP_MEM_LEVEL = 4
GZIP_LEVEL = 6


async def _gzipped(events: AsyncIterator[bytes]) -> AsyncIterator[bytes]:
    z = zlib.compressobj(GZIP_LEVEL, zlib.DEFLATED, GZIP_WBITS, GZIP_MEM_LEVEL)
    try:
        async for chunk in events:
            # Sync flush after every event, heartbeats included: without it
            # zlib holds bytes back and the browser sees nothing until its
            # buffer fills, which defeats the point of a stream.
            yield z.compress(chunk) + z.flush(zlib.Z_SYNC_FLUSH)
        yield z.flush()  # stream ended by the server: write the gzip trailer
    finally:
        await events.aclose()  # type: ignore[attr-defined]


class EventStream(StreamingResponse):
    media_type = "text/event-stream"

    def __init__(
        self, content: AsyncIterator[bytes], on_close: Callable[[], None], gzip: bool = False,
    ) -> None:
        headers = dict(STREAM_HEADERS)
        if gzip:
            headers["Content-Encoding"] = "gzip"
            content = _gzipped(content)
        super().__init__(content, headers=headers)
        self._on_close = on_close

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            await super().__call__(scope, receive, send)
        except (anyio.BrokenResourceError, anyio.ClosedResourceError, ClientDisconnect):
            pass  # client went away mid-write (heartbeat or event): a normal end
        finally:
            self._on_close()
            await self.body_iterator.aclose()  # type: ignore[attr-defined]
