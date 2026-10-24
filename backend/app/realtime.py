"""GTFS-realtime pollers for GVB metro.

Three OVapi feeds, each filtered down to the metro:

- tripUpdates.pb: live per-stop predictions. Trips are identified by GTFS
  trip_id (matching the national static feed), with entity ids like
  "2026-07-21:GVB:54:79827".
- vehiclePositions.pb: metro entries have no GPS (latitude/longitude 0), but
  name the stop a train is at or heading to, timestamped by the signalling
  system. That is a confirmation of where a train is, not an estimate.
- alerts.pb: KV15 service messages, Dutch and English in one text.
"""
import asyncio
import logging
import time
from typing import Callable, Dict, List, Optional, Set, Tuple

import httpx
from google.transit import gtfs_realtime_pb2

from .config import (
    ALERTS_POLL_SECONDS, ALERTS_URL, HTTP_HEADERS, RT_POLL_SECONDS,
    TRIP_UPDATES_URL, VEHICLE_POLL_SECONDS, VEHICLE_POSITIONS_URL,
)

logger = logging.getLogger(__name__)


class RealtimeState:
    def __init__(self) -> None:
        # trip_id -> {"stops": {stop_seq -> {"arr", "dep", "delay", "skipped"}}, "ts"}
        self.trip_updates: Dict[str, dict] = {}
        # trip_id -> service dates (YYYYMMDD) it is cancelled on; "" = every date
        # (no start_date in the update). Kept apart from trip_updates so a
        # cancelled trip never counts as live and never falls back to schedule.
        self.cancelled: Dict[str, Set[str]] = {}
        # trip_id -> {"stop_id", "status": "at" | "to", "ts"}: the latest stop
        # the signalling system reported the train at, or heading to.
        self.vehicle_stops: Dict[str, dict] = {}
        # Metro-relevant KV15 alerts, as parsed by _parse_alerts.
        self.alerts: List[dict] = []
        self.last_success_ts: Optional[int] = None
        self.last_error: Optional[str] = None

    def is_cancelled(self, trip_id: str, date: str) -> bool:
        dates = self.cancelled.get(trip_id)
        return dates is not None and ("" in dates or date in dates)

    @property
    def is_live(self) -> bool:
        return self.last_success_ts is not None and time.time() - self.last_success_ts < 180


state = RealtimeState()


_CANCELED = gtfs_realtime_pb2.TripDescriptor.CANCELED
_SKIPPED = gtfs_realtime_pb2.TripUpdate.StopTimeUpdate.SKIPPED
_STOPPED_AT = gtfs_realtime_pb2.VehiclePosition.STOPPED_AT
_Cause = gtfs_realtime_pb2.Alert.Cause
_Effect = gtfs_realtime_pb2.Alert.Effect


def _parse(feed_bytes: bytes, metro_trip_ids: set) -> Tuple[Dict[str, dict], Dict[str, Set[str]]]:
    """(trip updates, cancellations) for metro trips in the feed.

    OVapi keeps cancelled runs in the feed (measured: ~90% of metro entries are
    CANCELED, mostly the previous service day's) — they must not count as live
    updates, and a cancelled run must not be drawn from its schedule either.
    """
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(feed_bytes)
    updates: Dict[str, dict] = {}
    cancelled: Dict[str, Set[str]] = {}
    for entity in feed.entity:
        if not entity.HasField("trip_update"):
            continue
        tu = entity.trip_update
        trip_id = tu.trip.trip_id
        if trip_id not in metro_trip_ids:
            continue
        if tu.trip.schedule_relationship == _CANCELED:
            cancelled.setdefault(trip_id, set()).add(tu.trip.start_date)
            continue
        stops: Dict[int, dict] = {}
        for stu in tu.stop_time_update:
            rec: dict = {
                "arr": None, "dep": None, "delay": 0,
                "skipped": stu.schedule_relationship == _SKIPPED,
            }
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
    return updates, cancelled


def _parse_vehicles(feed_bytes: bytes, metro_trip_ids: set) -> Dict[str, dict]:
    """Latest reported stop per metro trip. Entries without a stop say nothing
    the solver can use, so they are dropped."""
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(feed_bytes)
    out: Dict[str, dict] = {}
    for entity in feed.entity:
        if not entity.HasField("vehicle"):
            continue
        v = entity.vehicle
        trip_id = v.trip.trip_id
        if trip_id not in metro_trip_ids or not v.stop_id:
            continue
        stopped = v.HasField("current_status") and v.current_status == _STOPPED_AT
        out[trip_id] = {
            "stop_id": v.stop_id,
            # INCOMING_AT and IN_TRANSIT_TO both mean "not there yet"; an
            # unset status defaults to IN_TRANSIT_TO in the GTFS-rt spec.
            "status": "at" if stopped else "to",
            "ts": v.timestamp or feed.header.timestamp,
        }
    return out


def _split_languages(text: str) -> Dict[str, Optional[str]]:
    """GVB puts both languages in one translation tagged "nl", as
    "<Dutch> -- <English>", and uses "|" as a line break, so the separator
    also comes as "--|". A text without the separator is Dutch only."""
    flat = " ".join(text.replace("|", " ").split())
    nl, sep, en = flat.partition("--")
    return {"nl": nl.strip(), "en": (en.strip() or None) if sep else None}


def _text(ts) -> str:
    return ts.translation[0].text if ts.translation else ""


def _parse_alerts(feed_bytes: bytes, metro: Tuple[frozenset, frozenset]) -> List[dict]:
    """Alerts naming a metro route or a metro stop. `metro` is (GTFS route
    ids, stop ids) of the metro subset; the feed leaves agency_id empty, so
    those are the only reliable way to tell a metro alert from a bus one."""
    route_ids, stop_ids = metro
    feed = gtfs_realtime_pb2.FeedMessage()
    feed.ParseFromString(feed_bytes)
    out: List[dict] = []
    for entity in feed.entity:
        if not entity.HasField("alert"):
            continue
        a = entity.alert
        routes = {ie.route_id for ie in a.informed_entity if ie.route_id in route_ids}
        stops = {ie.stop_id for ie in a.informed_entity if ie.stop_id in stop_ids}
        if not routes and not stops:
            continue
        header = _text(a.header_text)
        if not header:
            continue
        out.append({
            "id": entity.id,
            "header": _split_languages(header),
            "description": _split_languages(_text(a.description_text)),
            "route_ids": sorted(routes),
            "stop_ids": sorted(stops),
            # (start, end) epochs; 0 is an open end, as in the feed
            "periods": [(p.start, p.end) for p in a.active_period],
            "cause": _Cause.Name(a.cause),
            "effect": _Effect.Name(a.effect),
        })
    return out


# Retry pace while the static data loads (~75 s on a cold start). 5 s cost
# ~45 extra OVapi requests per deploy across the three feeds; 15 s still shows
# alerts within seconds of the data being ready, at a third of the load.
EMPTY_FILTER_RETRY_SECONDS = 15


def _is_empty(flt: object) -> bool:
    """No ids yet: a set of trip ids, or a tuple of id sets, all empty."""
    if isinstance(flt, tuple):
        return not any(flt)
    return not flt


async def _poll(
    url: str, interval: float, get_filter: Callable[[], object],
    parse: Callable[[bytes, object], object], apply: Callable[[object], None],
    name: str, on_ok: Callable[[], None] = lambda: None,
    on_error: Callable[[str], None] = lambda e: None,
) -> None:
    """Poll one feed with conditional requests, forever.

    A 304 only means the *feed* is unchanged; if the filter changed since the
    last parse (first static load after boot, daily rebuild) the cached result
    was filtered against the wrong ids, so drop the validators and take a full
    copy.
    """
    conditional_headers: dict[str, str] = {}
    parsed_for: object = None
    async with httpx.AsyncClient(timeout=60, headers=HTTP_HEADERS) as client:
        while True:
            try:
                flt = get_filter()
                if flt != parsed_for:
                    conditional_headers.clear()
                resp = await client.get(url, headers=conditional_headers)
                if resp.status_code == 304:
                    logger.debug("%s poll not modified (304)", name)
                else:
                    resp.raise_for_status()
                    apply(await asyncio.to_thread(parse, resp.content, flt))
                    parsed_for = flt
                    if etag := resp.headers.get("etag"):
                        conditional_headers["If-None-Match"] = etag
                    if modified := resp.headers.get("last-modified"):
                        conditional_headers["If-Modified-Since"] = modified
                on_ok()
            except Exception as e:  # keep polling through transient failures
                on_error(str(e))
                logger.warning("%s poll failed: %s", name, e)
            # Until the static data loads there is nothing to filter against:
            # retry soon, or a slow feed (alerts) stays empty for minutes.
            await asyncio.sleep(EMPTY_FILTER_RETRY_SECONDS if _is_empty(parsed_for) else interval)


def _trip_updates_ok() -> None:
    state.last_success_ts = int(time.time())
    state.last_error = None


def _trip_updates_error(e: str) -> None:
    state.last_error = e


def _apply_trip_updates(result) -> None:
    state.trip_updates, state.cancelled = result
    logger.info(
        "RT poll ok: %d metro trip updates, %d cancelled",
        len(state.trip_updates), len(state.cancelled),
    )


def _apply_vehicles(result) -> None:
    state.vehicle_stops = result
    logger.debug("Vehicle poll ok: %d metro trains with a reported stop", len(result))


def _apply_alerts(result) -> None:
    state.alerts = result
    logger.info("Alerts poll ok: %d metro alerts", len(result))


async def poll_forever(get_metro_trip_ids) -> None:
    await _poll(
        TRIP_UPDATES_URL, RT_POLL_SECONDS, get_metro_trip_ids, _parse,
        _apply_trip_updates, "RT", on_ok=_trip_updates_ok, on_error=_trip_updates_error,
    )


async def poll_vehicles_forever(get_metro_trip_ids) -> None:
    await _poll(
        VEHICLE_POSITIONS_URL, VEHICLE_POLL_SECONDS, get_metro_trip_ids,
        _parse_vehicles, _apply_vehicles, "Vehicle",
    )


async def poll_alerts_forever(get_metro_ids) -> None:
    """`get_metro_ids` returns (route ids, stop ids) of the metro subset."""
    await _poll(
        ALERTS_URL, ALERTS_POLL_SECONDS, get_metro_ids, _parse_alerts,
        _apply_alerts, "Alerts",
    )
