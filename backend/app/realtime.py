"""GTFS-realtime poller: pulls tripUpdates.pb and keeps live per-stop
predictions for GVB metro trips.

The RT feed identifies trips by GTFS trip_id (matching the national static
feed), with entity ids like "2026-07-21:GVB:54:79827".
"""
import asyncio
import logging
import time
from typing import Dict, Optional

import httpx
from google.transit import gtfs_realtime_pb2

from .config import RT_POLL_SECONDS, TRIP_UPDATES_URL

logger = logging.getLogger(__name__)


class RealtimeState:
    def __init__(self) -> None:
        # trip_id -> {stop_seq -> {"arr": epoch|None, "dep": epoch|None, "delay": s}}
        self.trip_updates: Dict[str, dict] = {}
        self.last_success_ts: Optional[int] = None
        self.last_error: Optional[str] = None

    @property
    def is_live(self) -> bool:
        return self.last_success_ts is not None and time.time() - self.last_success_ts < 180


state = RealtimeState()


def _parse(feed_bytes: bytes, metro_trip_ids: set) -> Dict[str, dict]:
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(feed_bytes)
    updates: Dict[str, dict] = {}
    for entity in feed.entity:
        if not entity.HasField("trip_update"):
            continue
        tu = entity.trip_update
        trip_id = tu.trip.trip_id
        if trip_id not in metro_trip_ids:
            continue
        stops: Dict[int, dict] = {}
        for stu in tu.stop_time_update:
            rec: dict = {"arr": None, "dep": None, "delay": 0}
            if stu.HasField("arrival"):
                if stu.arrival.HasField("time") and stu.arrival.time:
                    rec["arr"] = stu.arrival.time
                if stu.arrival.HasField("delay"):
                    rec["delay"] = stu.arrival.delay
            if stu.HasField("departure"):
                if stu.departure.HasField("time") and stu.departure.time:
                    rec["dep"] = stu.departure.time
                if stu.departure.HasField("delay"):
                    rec["delay"] = stu.departure.delay
            stops[stu.stop_sequence] = rec
        if stops:
            updates[trip_id] = {
                "stops": stops,
                "ts": tu.timestamp or feed.header.timestamp,
            }
    return updates


async def poll_forever(get_metro_trip_ids) -> None:
    async with httpx.AsyncClient(timeout=60) as client:
        while True:
            try:
                resp = await client.get(TRIP_UPDATES_URL)
                resp.raise_for_status()
                trip_ids = get_metro_trip_ids()
                updates = await asyncio.to_thread(_parse, resp.content, trip_ids)
                state.trip_updates = updates
                state.last_success_ts = int(time.time())
                state.last_error = None
                logger.info("RT poll ok: %d metro trip updates", len(updates))
            except Exception as e:  # keep polling through transient failures
                state.last_error = str(e)
                logger.warning("RT poll failed: %s", e)
            await asyncio.sleep(RT_POLL_SECONDS)
