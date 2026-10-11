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

from . import gtfs_static, realtime
from .config import CORS_ORIGINS, GTFS_REFRESH_SECONDS
from .gtfs_static import TZ
from .models import StatusOut
from .payload import Payload
from .positions import MetroData

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# How often train positions are re-solved. Every client polls /api/trains, but
# all of them get this one shared snapshot: server cost no longer grows with
# the number of viewers. Clients dead-reckon between polls, so 1s is plenty.
SNAPSHOT_SECONDS = 1.0
# Retry cadence while the first static load keeps failing (OVapi down at boot).
STATIC_RETRY_SECONDS = 60
DEPARTURES_TTL_SECONDS = 10
# Static data changes at most once per GTFS refresh; ETags make repeats cheap.
STATIC_CACHE_CONTROL = "public, max-age=300"
SNAPSHOT_AGE_HEADER = "X-Snapshot-Age-Ms"


@dataclass(frozen=True)
class StaticData:
    metro: MetroData
    lines: Payload
    stations: Payload
    shapes: Payload
    station_names: frozenset


@dataclass(frozen=True)
class Snapshot:
    computed_at: float
    trains: Payload
    status: Payload


static: Optional[StaticData] = None
snapshot: Optional[Snapshot] = None
_departures_cache: Dict[Tuple[str, int], Tuple[float, Payload]] = {}


def _prepare(subset: dict) -> StaticData:
    """Everything derived from one static subset, built off the event loop."""
    m = MetroData(subset)
    return StaticData(
        metro=m,
        lines=Payload.of([line.model_dump() for line in m.lines()]),
        stations=Payload.of([s.model_dump() for s in m.stations()]),
        shapes=Payload.of({sid: {"coords": s.coords, "cum": s.cum} for sid, s in m.shapes.items()}),
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
    logger.info("Static data ready (subset from %s)",
                datetime.fromtimestamp(subset["generated_ts"], TZ).isoformat(timespec="minutes"))


async def keep_static_fresh() -> None:
    """Load at boot, then re-check hourly so a long-lived process picks up new
    service dates. Runs in the background: the server answers (healthz 503)
    while the first load is still in progress."""
    while True:
        try:
            await _refresh_static()
        except Exception:
            logger.exception("GTFS static refresh failed")
        await asyncio.sleep(GTFS_REFRESH_SECONDS if static else STATIC_RETRY_SECONDS)


def _solve_snapshot(data: StaticData) -> Snapshot:
    now = time.time()
    trains = data.metro.trains(realtime.state, now)
    rt = realtime.state
    status = StatusOut(
        static_loaded=True,
        static_age_hours=(now - data.metro.subset["generated_ts"]) / 3600,
        rt_last_success_ts=rt.last_success_ts,
        rt_trip_count=len(rt.trip_updates),
        active_trains=len(trains),
        is_live=rt.is_live,
    )
    return Snapshot(
        computed_at=now,
        trains=Payload.of([t.model_dump() for t in trains]),
        status=Payload.of(status.model_dump()),
    )


async def keep_snapshot_fresh() -> None:
    global snapshot
    while True:
        started = time.monotonic()
        if static:
            try:
                snapshot = await asyncio.to_thread(_solve_snapshot, static)
            except Exception:
                logger.exception("Train snapshot failed; keeping the previous one")
        await asyncio.sleep(max(0.1, SNAPSHOT_SECONDS - (time.monotonic() - started)))


@asynccontextmanager
async def lifespan(app: FastAPI):
    tasks = [
        asyncio.create_task(keep_static_fresh()),
        asyncio.create_task(keep_snapshot_fresh()),
        asyncio.create_task(
            realtime.poll_forever(lambda: static.metro.trip_ids() if static else set())
        ),
    ]
    yield
    for task in tasks:
        task.cancel()


app = FastAPI(title="Amsterdam Metro Live API", lifespan=lifespan)

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


@app.get("/api/status")
async def status(request: Request):
    return _snapshot().status.respond(request, "no-store")


@app.get("/api/departures")
async def departures(
    request: Request,
    station: str = Query(..., max_length=100),
    limit: int = Query(8, ge=1, le=20),
):
    """Upcoming departures for a station (by grouped station name)."""
    data = _static()
    if station not in data.station_names:
        return Payload.of([]).respond(request, "no-store")
    key = (station, limit)
    now = time.time()
    hit = _departures_cache.get(key)
    if hit is None or hit[0] < now:
        # Keyed only by real station names x bounded limits, so the cache is
        # bounded too (~40 stations x 20) however the endpoint is called.
        payload = Payload.of(data.metro.departures(station, realtime.state, now=now, limit=limit))
        hit = (now + DEPARTURES_TTL_SECONDS, payload)
        _departures_cache[key] = hit
    return hit[1].respond(request, "no-store")
