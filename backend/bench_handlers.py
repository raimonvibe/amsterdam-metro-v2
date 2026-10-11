"""Benchmark: per-request JSON vs pre-built snapshot vs snapshot + gzip.

Times /api/shapes and /api/trains in three variants, each served by a real
uvicorn server on localhost and hit sequentially by one client:

  1. old       - the pre-#80 handlers: rebuild the data and let FastAPI
                 validate + serialise it on every request (no gzip).
  2. snapshot  - Payload built once; every request returns the stored bytes.
  3. +gzip     - same Payload, but the pre-gzipped body (Accept-Encoding: gzip).

Client time covers request -> last raw byte received. The client does not
decompress, so variant 3 is not charged for the browser's gunzip.

Needs the cached GTFS subset in data/cache (build it with
`python -c "from app import gtfs_static; gtfs_static.load_subset()"`).

Usage (from backend/):  .venv/bin/python bench_handlers.py [-n 100]
"""
import argparse
import socket
import statistics
import threading
import time
from typing import List

import httpx
import uvicorn
from fastapi import FastAPI, Request
from starlette.responses import Response

from app import gtfs_static, realtime
from app.models import TrainOut
from app.payload import Payload
from app.positions import MetroData

WARMUP = 5
# Localhost hides transfer time, which is where gzip pays off. Shown as an
# estimate for a typical mobile connection, separate from the measured numbers.
LINK_MBIT = 10


def build_app(m: MetroData) -> FastAPI:
    app = FastAPI()

    # Same snapshot the live server keeps, built once up front.
    shapes = Payload.of({sid: {"coords": s.coords, "cum": s.cum} for sid, s in m.shapes.items()})
    trains = Payload.of([t.model_dump() for t in m.trains(realtime.state)])

    # 1. Old handlers, copied from main.py before the snapshot change.
    @app.get("/old/shapes")
    async def old_shapes():
        return {sid: {"coords": s.coords, "cum": s.cum} for sid, s in m.shapes.items()}

    @app.get("/old/trains", response_model=List[TrainOut])
    async def old_trains():
        return m.trains(realtime.state)

    # 2. Snapshot, identity encoding only.
    @app.get("/snapshot/shapes")
    async def snap_shapes():
        return Response(shapes.body, media_type="application/json")

    @app.get("/snapshot/trains")
    async def snap_trains():
        return Response(trains.body, media_type="application/json")

    # 3. Snapshot + gzip: the current production code path.
    @app.get("/gzip/shapes")
    async def gzip_shapes(request: Request):
        return shapes.respond(request, "no-store")

    @app.get("/gzip/trains")
    async def gzip_trains(request: Request):
        return trains.respond(request, "no-store")

    return app


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def time_endpoint(client: httpx.Client, path: str, n: int):
    def hit() -> int:
        with client.stream("GET", path) as r:
            r.raise_for_status()
            return sum(len(chunk) for chunk in r.iter_raw())

    for _ in range(WARMUP):
        hit()
    times, size = [], 0
    for _ in range(n):
        t0 = time.perf_counter()
        size = hit()
        times.append((time.perf_counter() - t0) * 1000)
    return times, size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-n", type=int, default=100, help="timed requests per scenario")
    args = parser.parse_args()

    subset = gtfs_static.cached_subset(require_fresh=False)
    if subset is None:
        raise SystemExit("No cached GTFS subset in data/cache; build it first (see docstring).")
    m = MetroData(subset)

    port = free_port()
    server = uvicorn.Server(uvicorn.Config(build_app(m), port=port, log_level="warning"))
    threading.Thread(target=server.run, daemon=True).start()
    while not server.started:
        time.sleep(0.05)

    scenarios = [
        ("1. old (rebuild + serialise)", "old"),
        ("2. snapshot, no gzip", "snapshot"),
        ("3. snapshot + gzip", "gzip"),
    ]
    with httpx.Client(base_url=f"http://127.0.0.1:{port}", headers={"Accept-Encoding": "gzip"}) as client:
        for endpoint in ("shapes", "trains"):
            print(f"\n/api/{endpoint}  ({args.n} requests each, {WARMUP} warm-up)")
            print(f"  {'scenario':<30}{'mean ms':>9}{'median':>9}{'p95':>9}{'bytes':>11}"
                  f"{'+ xfer @' + str(LINK_MBIT) + 'Mbit':>16}")
            means = {}
            for label, prefix in scenarios:
                times, size = time_endpoint(client, f"/{prefix}/{endpoint}", args.n)
                mean = statistics.fmean(times)
                means[prefix] = mean
                p95 = statistics.quantiles(times, n=20)[-1]
                xfer = size * 8 / (LINK_MBIT * 1e6) * 1000
                print(f"  {label:<30}{mean:>9.2f}{statistics.median(times):>9.2f}{p95:>9.2f}"
                      f"{size:>11,}{mean + xfer:>13.1f} ms")
            print(f"  snapshot saves {means['old'] - means['snapshot']:.2f} ms/request; "
                  f"gzip saves a further {means['snapshot'] - means['gzip']:.2f} ms on localhost")

    server.should_exit = True


if __name__ == "__main__":
    main()
