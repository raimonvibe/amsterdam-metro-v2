import asyncio
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import gtfs_static, realtime
from .config import CORS_ORIGINS, GTFS_REFRESH_SECONDS
from .gtfs_static import TZ
from .models import Line, StationOut, StatusOut, TrainOut
from .positions import MetroData

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

metro: Optional[MetroData] = None


def _load_metro() -> MetroData:
    return MetroData(gtfs_static.load_subset())


async def refresh_gtfs_forever() -> None:
    """Rebuild the static subset periodically so a long-lived process picks
    up new service dates. load_subset() is a cheap no-op when the on-disk
    cache is still fresh and covers today; it only re-downloads/rebuilds
    when actually stale, so a short interval here is safe. Both the load and
    the (CPU-bound) MetroData construction run in a thread so a rebuild never
    blocks the event loop / request handling / RT polling."""
    global metro
    while True:
        await asyncio.sleep(GTFS_REFRESH_SECONDS)
        try:
            metro = await asyncio.to_thread(_load_metro)
            logger.info("GTFS static subset refreshed")
        except Exception as e:  # keep the previous subset serving on failure
            logger.warning("GTFS static refresh failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global metro
    metro = await asyncio.to_thread(_load_metro)
    poller = asyncio.create_task(
        realtime.poll_forever(lambda: metro.trip_ids() if metro else set())
    )
    refresher = asyncio.create_task(refresh_gtfs_forever())
    yield
    poller.cancel()
    refresher.cancel()


app = FastAPI(title="Amsterdam Metro Live API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _metro() -> MetroData:
    if metro is None:
        raise HTTPException(status_code=503, detail="GTFS data still loading")
    return metro


def _covers_today() -> bool:
    if metro is None:
        return False
    today = datetime.now(TZ).strftime("%Y%m%d")
    return any(today in dates for dates in metro.service_dates.values())


@app.get("/healthz")
async def healthz():
    # Ties directly into the bug this guards against: a long-lived process
    # whose static subset has aged out of today's service dates (the
    # periodic refresh in refresh_gtfs_forever should prevent this, but if
    # it's ever failing repeatedly this makes the platform's health check
    # catch it and restart the process, instead of silently serving zero
    # trains forever).
    if not _covers_today():
        raise HTTPException(status_code=503, detail="GTFS static data does not cover today's service date")
    return {"status": "ok"}


@app.get("/api/lines", response_model=List[Line])
async def lines():
    return _metro().lines()


@app.get("/api/stations", response_model=List[StationOut])
async def stations():
    return _metro().stations()


@app.get("/api/trains", response_model=List[TrainOut])
async def trains():
    return _metro().trains(realtime.state)


@app.get("/api/departures")
async def departures(station: str, limit: int = 8):
    """Upcoming departures for a station (by grouped station name)."""
    return _metro().departures(station, realtime.state, limit=limit)


@app.get("/api/shapes")
async def shapes():
    """Track geometries with cumulative distances, for client-side animation."""
    return {
        sid: {"coords": s.coords, "cum": s.cum}
        for sid, s in _metro().shapes.items()
    }


@app.get("/api/status", response_model=StatusOut)
async def status():
    m = _metro()
    active = m.trains(realtime.state)
    return StatusOut(
        static_loaded=True,
        static_age_hours=(time.time() - m.subset["generated_ts"]) / 3600,
        rt_last_success_ts=realtime.state.last_success_ts,
        rt_trip_count=len(realtime.state.trip_updates),
        active_trains=len(active),
        is_live=realtime.state.is_live,
    )
