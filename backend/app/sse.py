"""Server-Sent Events response for long-lived, broadcast-fed streams.

Not FastAPI's EventSourceResponse: that one runs its keepalive pings in a
separate task joined by memory streams, and when a client with a backed-up
socket disconnects, that task dies with BrokenResourceError. The error is
logged, and the producer dies with it before the endpoint's cleanup runs, so
the client's broadcast queue leaked. Here the heartbeat is just a timeout in
the endpoint's own generator, and cleanup is tied to the response, not to
generator finalisation.
"""
from typing import AsyncIterator, Callable

import anyio
from starlette.requests import ClientDisconnect
from starlette.responses import StreamingResponse
from starlette.types import Receive, Scope, Send

# no-cache: never store or revalidate a live stream. X-Accel-Buffering: nginx
# (and proxies that honour it) must pass each event through as it is written.
STREAM_HEADERS = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
HEARTBEAT = b": ping\n\n"


class EventStream(StreamingResponse):
    media_type = "text/event-stream"

    def __init__(self, content: AsyncIterator[bytes], on_close: Callable[[], None]) -> None:
        super().__init__(content, headers=STREAM_HEADERS)
        self._on_close = on_close

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        try:
            await super().__call__(scope, receive, send)
        except (anyio.BrokenResourceError, anyio.ClosedResourceError, ClientDisconnect):
            pass  # client went away mid-write (heartbeat or event): a normal end
        finally:
            self._on_close()
            await self.body_iterator.aclose()  # type: ignore[attr-defined]
