import asyncio
import logging
import multiprocessing
import time
from concurrent.futures import ProcessPoolExecutor
from contextlib import asynccontextmanager
from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.sse import format_sse_event

from . import gtfs_static, realtime, travel
from .broadcast import DROPPED, Broadcaster
from .config import API_DOCS, CORS_ORIGINS, GTFS_REFRESH_SECONDS
from .gtfs_static import TZ
from .limits import ClientCounter, RateLimiter, TTLCache, client_ip, snap_up
from .models import StatusOut
from .payload import Payload
from .positions import MetroData
from .security import SecurityHeadersMiddleware
from .sse import HEARTBEAT, EventStream

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# How often train positions are re-solved. Every client polls /api/trains, but
# all of them get this one shared snapshot: server cost no longer grows with
# the number of viewers. Clients dead-reckon between polls, so 1s is plenty.
SNAPSHOT_SECONDS = 1.0
# Retry backoff while the first static load keeps failing (OVapi down or
# throttling at boot): 1 min, doubling up to 30 min. A fixed 1-minute retry
# against a 429 only keeps the throttling going.
STATIC_RETRY_SECONDS = 60
STATIC_RETRY_MAX_SECONDS = 1800
# Upper bound on honouring a Retry-After: past this, try anyway.
STATIC_RETRY_AFTER_MAX_SECONDS = 3600
DEPARTURES_TTL_SECONDS = 10
# Static data changes at most once per GTFS refresh; ETags make repeats cheap.
STATIC_CACHE_CONTROL = "public, max-age=300"
SNAPSHOT_AGE_HEADER = "X-Snapshot-Age-Ms"
# /api/trains/stream pushes every Nth snapshot, not all of them: clients
# dead-reckon between updates, so the old 5s poll cadence is still plenty.
STREAM_PUSH_SECONDS = 5.0
# Comment line sent when nothing else went out for this long, so idle-timeout
# layers (Render's proxy, CDNs, corporate firewalls) keep the connection open.
# Only fires while no snapshots are pushed, e.g. while static data loads.
STREAM_HEARTBEAT_SECONDS = 20.0
# A client this many pushes behind (30s) is not reading; drop it rather than
# buffer for it. Its browser reconnects and resumes from the newest snapshot.
STREAM_MAX_QUEUED = 6
# Browser reconnect delay after a dropped connection (EventSource `retry:`).
STREAM_RETRY_MS = 3000
# Open streams allowed at once. Each holds a socket and a queue; without a cap
# anyone could open connections until the instance runs out of memory or file
# descriptors. Far above real traffic for this app.
STREAM_MAX_CLIENTS = 500
# Streams per visitor (one IP address). Generous: a school, an office or a
# mobile network (carrier-grade NAT puts many strangers behind one address)
# shares it. 100 still keeps one script from taking all 500 slots.
STREAM_MAX_PER_CLIENT = 100
# Computed endpoints (departures, station, journey, alerts): per address, a
# burst of 300 and 20 per second after that. Sized like STREAM_MAX_PER_CLIENT
# for ~100 people behind one address (mobile networks share addresses), each
# with an open travel page at ~10 requests a minute (~17/s together). A
# script still hits it; the bounded caches cap what a burst can cost.
RATE_PER_SECOND = 20.0
RATE_BURST = 300
# The only request values the app sends. Anything else is served from the
# next step up, so the cache key space stays small whatever the query says.
DEPARTURE_MINUTES_STEPS = (15, 30, 45, 60, 120, 180)
DEPARTURE_LIMIT_STEPS = (8, 20, 60)
JOURNEY_LIMIT_STEPS = (6, 10)


@dataclass(frozen=True)
class StaticData:
    metro: MetroData
    lines: Payload
    stations: Payload
    shapes: Payload
    network: Payload
    station_names: frozenset


@dataclass(frozen=True)
class Snapshot:
    # SSE event id. Seeded from the clock at boot and +1 per snapshot (at most
    # one per second), so ids keep rising across restarts too.
    seq: int
    computed_at: float
    trains: Payload
    status: Payload


static: Optional[StaticData] = None
snapshot: Optional[Snapshot] = None
STATION_INFO_TTL_SECONDS = 60
JOURNEY_TTL_SECONDS = 20
# Cached answers: (rows, payload). Bounded and least-recently-used first, so
# memory stays flat however the endpoints are called. Before, the departures
# cache had 823,680 possible keys and never dropped one.
# 39 stations x 6 windows x 3 limits x 2 = 1,404 departures keys in practice.
_departures_cache: TTLCache[Tuple[list, Payload]] = TTLCache(2000)
_station_info_cache: TTLCache[Payload] = TTLCache(200)
# Station pairs x 2 limits: up to ~3,000, so the least used fall out.
_journey_cache: TTLCache[Tuple[list, Payload]] = TTLCache(2000)
broadcaster = Broadcaster(STREAM_MAX_QUEUED)
stream_clients = ClientCounter(STREAM_MAX_PER_CLIENT)
rate_limiter = RateLimiter(RATE_PER_SECOND, RATE_BURST)


def _rate_limited(request: Request) -> Optional[Response]:
    """429 with Retry-After once a visitor exceeds the computed-endpoint rate."""
    wait = rate_limiter.check(client_ip(request))
    if wait is None:
        return None
    return Response(
        content=b'{"detail":"Too many requests"}', status_code=429, media_type="application/json",
        headers={"Retry-After": str(wait), "Cache-Control": "no-store"},
    )


def _sliced(rows: list, payload: Payload, limit: int, computed_for: int) -> Payload:
    """The cached answer, cut to the requested length when it was computed
    for a larger step. The app asks for step values, so this is rare."""
    return payload if limit >= computed_for else Payload.of(rows[:limit])


def _prepare(subset: dict) -> StaticData:
    """Everything derived from one static subset, built off the event loop."""
    m = MetroData(subset)
    return StaticData(
        metro=m,
        lines=Payload.of([line.model_dump() for line in m.lines()]),
        stations=Payload.of([s.model_dump() for s in m.stations()]),
        shapes=Payload.of({sid: {"coords": s.coords, "cum": s.cum} for sid, s in m.shapes.items()}),
        network=Payload.of(travel.network(m)),
        station_names=frozenset(m.station_names()),
    )


def _rebuild_subset() -> dict:
    """Download + rebuild in a child process. The rebuild is ~30-60s of pure
    Python CSV parsing; in a thread it would hold the GIL and stall every
    request and the realtime poller for that long."""
    ctx = multiprocessing.get_context("spawn")
    with ProcessPoolExecutor(
        max_workers=1, mp_context=ctx, initializer=gtfs_static.init_worker_logging,
    ) as pool:
        return pool.submit(gtfs_static.load_subset).result()


async def _refresh_static() -> None:
    global static
    subset = await asyncio.to_thread(gtfs_static.cached_subset)
    if subset is None:
        logger.info("Static subset missing or stale; rebuilding in a child process")
        subset = await asyncio.to_thread(_rebuild_subset)
    if static and subset["generated_ts"] == static.metro.subset["generated_ts"]:
        return  # same data already served; skip re-deriving everything
    static = await asyncio.to_thread(_prepare, subset)
    _departures_cache.clear()
    _station_info_cache.clear()
    _journey_cache.clear()
    logger.info("Static data ready (subset from %s)",
                datetime.fromtimestamp(subset["generated_ts"], TZ).isoformat(timespec="minutes"))


async def keep_static_fresh() -> None:
    """Load at boot, then re-check hourly so a long-lived process picks up new
    service dates. Runs in the background: the server answers (healthz 503)
    while the first load is still in progress."""
    retry = STATIC_RETRY_SECONDS
    while True:
        retry_after = None
        try:
            await _refresh_static()
        except gtfs_static.StaticDownloadError as e:
            # Expected and self-explanatory (e.g. HTTP 429): no traceback.
            logger.warning("GTFS static download failed: %s", e)
            retry_after = e.retry_after
        except Exception:
            logger.exception("GTFS static refresh failed")
        if static:
            retry = STATIC_RETRY_SECONDS
            await asyncio.sleep(GTFS_REFRESH_SECONDS)
            continue
        wait = max(retry, min(retry_after or 0, STATIC_RETRY_AFTER_MAX_SECONDS))
        retry = min(retry * 2, STATIC_RETRY_MAX_SECONDS)
        logger.info("Retrying the GTFS static load in %ds", wait)
        await asyncio.sleep(wait)


def _solve_snapshot(data: StaticData, seq: int) -> Snapshot:
    now = time.time()
    trains = data.metro.trains(realtime.state, now)
    rt = realtime.state
    status = StatusOut(
        static_loaded=True,
        static_age_hours=(now - data.metro.subset["generated_ts"]) / 3600,
        rt_last_success_ts=rt.last_success_ts,
        rt_trip_count=len(rt.live_updates()),
        active_trains=len(trains),
        is_live=rt.is_live,
    )
    return Snapshot(
        seq=seq,
        computed_at=now,
        trains=Payload.of([t.model_dump() for t in trains]),
        status=Payload.of(status.model_dump()),
    )


async def keep_snapshot_fresh() -> None:
    global snapshot
    last_push = 0.0
    seq = int(time.time())
    while True:
        started = time.monotonic()
        if static:
            try:
                seq += 1
                snapshot = await asyncio.to_thread(_solve_snapshot, static, seq)
            except Exception:
                logger.exception("Train snapshot failed; keeping the previous one")
            else:
                # Half a tick of slack: loop jitter must not skip a push.
                if snapshot.computed_at - last_push >= STREAM_PUSH_SECONDS - SNAPSHOT_SECONDS / 2:
                    broadcaster.publish(snapshot)
                    last_push = snapshot.computed_at
        await asyncio.sleep(max(0.1, SNAPSHOT_SECONDS - (time.monotonic() - started)))


def _metro_trip_ids() -> set:
    return static.metro.trip_ids() if static else set()


def _metro_alert_ids() -> tuple:
    """(GTFS route ids, stop ids) of the metro, for filtering alerts.pb."""
    if not static:
        return (frozenset(), frozenset())
    subset = static.metro.subset
    return (frozenset(subset.get("route_to_line", {})), frozenset(subset["stops"]))


@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = [
        asyncio.create_task(keep_static_fresh()),
        asyncio.create_task(keep_snapshot_fresh()),
        asyncio.create_task(realtime.poll_forever(_metro_trip_ids)),
        asyncio.create_task(realtime.poll_vehicles_forever(_metro_trip_ids)),
        asyncio.create_task(realtime.poll_alerts_forever(_metro_alert_ids)),
    ]
    yield
    for task in tasks:
        task.cancel()


app = FastAPI(
    title="Amsterdam Metro Live API",
    lifespan=lifespan,
    docs_url="/docs" if API_DOCS else None,
    redoc_url="/redoc" if API_DOCS else None,
    openapi_url="/openapi.json" if API_DOCS else None,
)

# Added first, so it runs innermost: CORS headers and errors pass through it too.
app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
    # Cross-origin JS can only read headers listed here; the client needs this
    # one to place trains correctly (see /api/trains).
    expose_headers=[SNAPSHOT_AGE_HEADER],
)


def _static() -> StaticData:
    if static is None:
        raise HTTPException(status_code=503, detail="GTFS data still loading")
    return static


def _covers_today() -> bool:
    if static is None:
        return False
    today = datetime.now(TZ).strftime("%Y%m%d")
    return any(today in dates for dates in static.metro.service_dates.values())


@app.get("/healthz")
async def healthz():
    # 503 while the first load runs (Render keeps the previous instance serving
    # until this passes), and if the static subset has aged out of today's
    # service dates — so a refresh that keeps failing gets the process
    # restarted instead of silently serving zero trains forever.
    if not _covers_today():
        raise HTTPException(status_code=503, detail="GTFS static data does not cover today's service date")
    return {"status": "ok"}


@app.get("/api/lines")
async def lines(request: Request):
    return _static().lines.respond(request, STATIC_CACHE_CONTROL)


@app.get("/api/stations")
async def stations(request: Request):
    return _static().stations.respond(request, STATIC_CACHE_CONTROL)


@app.get("/api/shapes")
async def shapes(request: Request):
    """Track geometries with cumulative distances, for client-side animation."""
    return _static().shapes.respond(request, STATIC_CACHE_CONTROL)


def _snapshot() -> Snapshot:
    _static()
    if snapshot is None:
        raise HTTPException(status_code=503, detail="Train positions not computed yet")
    return snapshot


@app.get("/api/trains")
async def trains(request: Request):
    snap = _snapshot()
    # Positions are as of computed_at, up to SNAPSHOT_SECONDS ago. The client
    # rewinds its receive time by this age before dead-reckoning, so a slightly
    # old snapshot never makes trains jump back. An age, not a timestamp, so
    # client/server clock skew does not matter.
    age_ms = str(max(0, int((time.time() - snap.computed_at) * 1000)))
    return snap.trains.respond(request, "no-store", {SNAPSHOT_AGE_HEADER: age_ms})


def _stream_event(snap: Snapshot) -> bytes:
    # Built per client at send time so ageMs covers any time spent queued.
    # Splices the pre-serialised bodies instead of re-encoding the trains.
    age_ms = max(0, int((time.time() - snap.computed_at) * 1000))
    return format_sse_event(
        event="snapshot",  # never "error": that name is EventSource's own
        id=str(snap.seq),
        data_str='{"ageMs":%d,"trains":%s,"status":%s}'
        % (age_ms, snap.trains.body.decode(), snap.status.body.decode()),
    )


@app.get("/api/trains/stream")
async def trains_stream(request: Request):
    """Train positions and status as Server-Sent Events: one `snapshot` event
    per push, with the snapshot's sequence number as its id.

    Every event is a full snapshot, so a reconnect has nothing to replay: a
    resuming client (Last-Event-ID header from the browser's own reconnect,
    or ?lastEventId= from the app's) gets the current snapshot at once, like
    a new one, and never keeps showing positions from before the gap.

    The only error status is 503 at STREAM_MAX_CLIENTS, which the client
    retries with backoff (EventSource itself gives up for good on any non-200
    reply). While data is still loading the stream just stays open (with
    heartbeats) until the first snapshot arrives. The resume id is never
    validated into an error either: a 422 would make the client retry with
    the same id forever."""
    if len(broadcaster) >= STREAM_MAX_CLIENTS:
        logger.warning("SSE at capacity (%d streams); refusing a client", STREAM_MAX_CLIENTS)
        return Response(status_code=503, headers={"Retry-After": "30", "Cache-Control": "no-store"})
    who = client_ip(request)
    if not stream_clients.acquire(who):
        # The client backs off and retries; a person with 20 tabs is unlikely.
        logger.warning("SSE per-client cap (%d) reached; refusing a stream", STREAM_MAX_PER_CLIENT)
        return Response(status_code=429, headers={"Retry-After": "30", "Cache-Control": "no-store"})
    resumed_from = request.headers.get("last-event-id") or request.query_params.get("lastEventId")
    if resumed_from:
        # %r and a length cap: the value is client-supplied, keep it inert in logs.
        logger.debug("SSE client resuming after event %r", resumed_from[:32])
    queue = broadcaster.subscribe()

    async def events():
        yield format_sse_event(retry=STREAM_RETRY_MS)
        sent = -1
        if (snap := snapshot) is not None:
            yield _stream_event(snap)
            sent = snap.seq
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), STREAM_HEARTBEAT_SECONDS)
            except TimeoutError:
                yield HEARTBEAT
                continue
            if item is DROPPED:
                return  # too slow: end the stream, the browser reconnects
            if item.seq <= sent:
                continue  # already sent as the current snapshot on connect
            yield _stream_event(item)
            sent = item.seq

    # Same check as Payload.respond. EventSource requests always offer gzip.
    gzip = "gzip" in request.headers.get("accept-encoding", "")
    def close() -> None:
        broadcaster.unsubscribe(queue)
        stream_clients.release(who)

    return EventStream(events(), on_close=close, gzip=gzip)


@app.get("/api/status")
async def status(request: Request):
    return _snapshot().status.respond(request, "no-store")


@app.get("/api/network")
async def network(request: Request):
    """Per line and direction: ordered stations and typical run times."""
    return _static().network.respond(request, STATIC_CACHE_CONTROL)


@app.get("/api/alerts")
async def alerts(request: Request):
    """GVB service messages (KV15) for the metro that are in force now."""
    if limited := _rate_limited(request):
        return limited
    data = _static()
    return Payload.of(travel.alerts(data.metro, realtime.state)).respond(request, "public, max-age=60")


@app.get("/api/departures")
async def departures(
    request: Request,
    station: str = Query(..., max_length=100),
    limit: int = Query(8, ge=1, le=60),
    minutes: int = Query(45, ge=5, le=180),
    cancelled: bool = Query(False),
):
    """Upcoming departures for a station (by grouped station name)."""
    if limited := _rate_limited(request):
        return limited
    data = _static()
    if station not in data.station_names:
        return Payload.of([]).respond(request, "no-store")
    # Served from the next step up: a window of 50 minutes is the 60-minute
    # answer, which already holds every departure of the 50.
    window = snap_up(minutes, DEPARTURE_MINUTES_STEPS)
    computed_for = snap_up(limit, DEPARTURE_LIMIT_STEPS)
    key = (station, computed_for, window, cancelled)
    now = time.time()
    hit = _departures_cache.get(key, now)
    if hit is None:
        # Off the event loop: a miss costs tens of ms of CPU, and inline that
        # would stall every open /api/trains/stream connection meanwhile.
        def compute():
            rows = data.metro.departures(
                station, realtime.state, now=now, limit=computed_for,
                horizon_s=window * 60, include_cancelled=cancelled,
            )
            return rows, Payload.of(rows)
        hit = await asyncio.to_thread(compute)
        _departures_cache.set(key, hit, now + DEPARTURES_TTL_SECONDS)
    rows, payload = hit
    if window != minutes:
        rows = [d for d in rows if d["departure_ts"] <= now + minutes * 60]
        return Payload.of(rows[:limit]).respond(request, "no-store")
    return _sliced(rows, payload, limit, computed_for).respond(request, "no-store")


@app.get("/api/station")
async def station_info(request: Request, station: str = Query(..., max_length=100)):
    """First/last train today, frequency and stops ahead, per direction."""
    if limited := _rate_limited(request):
        return limited
    data = _static()
    if station not in data.station_names:
        raise HTTPException(status_code=404, detail="Unknown station")
    now = time.time()
    payload = _station_info_cache.get(station, now)
    if payload is None:
        payload = await asyncio.to_thread(
            lambda: Payload.of(travel.station_info(data.metro, station, realtime.state, now=now))
        )
        _station_info_cache.set(station, payload, now + STATION_INFO_TTL_SECONDS)
    return payload.respond(request, "no-store")


@app.get("/api/journey")
async def journey(
    request: Request,
    origin: str = Query(..., alias="from", max_length=100),
    dest: str = Query(..., alias="to", max_length=100),
    limit: int = Query(5, ge=1, le=10),
):
    """Direct and one-transfer journeys between two stations, soonest first."""
    if limited := _rate_limited(request):
        return limited
    data = _static()
    if origin not in data.station_names or dest not in data.station_names:
        raise HTTPException(status_code=404, detail="Unknown station")
    if origin == dest:
        raise HTTPException(status_code=422, detail="Origin and destination are the same")
    computed_for = snap_up(limit, JOURNEY_LIMIT_STEPS)
    key = (origin, dest, computed_for)
    now = time.time()
    hit = _journey_cache.get(key, now)
    if hit is None:
        def compute():
            rows = travel.journeys(data.metro, realtime.state, origin, dest, now=now, limit=computed_for)
            return rows, Payload.of(rows)
        hit = await asyncio.to_thread(compute)
        _journey_cache.set(key, hit, now + JOURNEY_TTL_SECONDS)
    rows, payload = hit
    return _sliced(rows, payload, limit, computed_for).respond(request, "no-store")
