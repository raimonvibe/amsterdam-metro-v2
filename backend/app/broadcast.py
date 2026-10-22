"""In-process pub/sub for the SSE train stream.

One bounded asyncio.Queue per connected client. publish() never awaits: a
client that stops reading (stalled socket, suspended laptop) fills its own
queue and is dropped, so one slow viewer can never hold up the others.
Everything runs on the event loop thread, so the subscriber set needs no lock.
"""
import asyncio
import logging
from typing import Any, Set

logger = logging.getLogger(__name__)

# Sentinel telling a dropped client's generator to end its stream. The browser
# then reconnects on its own and starts again from the current snapshot.
DROPPED = None


class Broadcaster:
    def __init__(self, max_queued: int) -> None:
        self.max_queued = max_queued
        self._subscribers: Set[asyncio.Queue] = set()

    def __len__(self) -> int:
        return len(self._subscribers)

    def subscribe(self) -> asyncio.Queue:
        # One slot above the threshold so the DROPPED sentinel always fits.
        queue: asyncio.Queue = asyncio.Queue(maxsize=self.max_queued + 1)
        self._subscribers.add(queue)
        return queue

    def unsubscribe(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)

    def publish(self, item: Any) -> None:
        for queue in list(self._subscribers):
            if queue.qsize() >= self.max_queued:
                self._drop(queue)
            else:
                queue.put_nowait(item)

    def _drop(self, queue: asyncio.Queue) -> None:
        self._subscribers.discard(queue)
        # Nothing queued is worth sending any more: only the newest snapshot
        # matters, and the client gets that on reconnect.
        while not queue.empty():
            queue.get_nowait()
        queue.put_nowait(DROPPED)
        logger.warning("Dropped a slow SSE client (%d queued); %d still connected",
                       self.max_queued, len(self._subscribers))
