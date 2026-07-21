import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import gtfs_static, realtime
from .models import Line, StationOut, StatusOut, TrainOut
from .positions import MetroData

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

metro: Optional[MetroData] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global metro
    subset = await asyncio.to_thread(gtfs_static.load_subset)
    metro = MetroData(subset)
    poller = asyncio.create_task(
        realtime.poll_forever(lambda: metro.trip_ids() if metro else set())
    )
    yield
    poller.cancel()


app = FastAPI(title="Amsterdam Metro Live API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _metro() -> MetroData:
    if metro is None:
        raise HTTPException(status_code=503, detail="GTFS data still loading")
    return metro


@app.get("/healthz")
async def healthz():
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
