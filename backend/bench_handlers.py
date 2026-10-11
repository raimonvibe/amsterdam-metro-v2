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

# Untimed requests per scenario first, so imports, route lookup and
# connection setup don't land in the measured numbers.
WARMUP = 5
# Localhost hides transfer time, which is where gzip pays off. Shown as an
# estimate for a typical mobile connection, separate from the measured numbers.
LINK_MBIT = 10


def build_app(m: MetroData) -> FastAPI:
    """One app with all three variants side by side, under /old, /snapshot
    and /gzip, so every scenario runs on the same server and the same data."""
    app = FastAPI()

    # Same snapshot the live server keeps, built once up front.
    # Payload.of() JSON-encodes, gzips and hashes (ETag) the data a single time.
    shapes = Payload.of({sid: {"coords": s.coords, "cum": s.cum} for sid, s in m.shapes.items()})
    trains = Payload.of([t.model_dump() for t in m.trains(realtime.state)])

    # 1. Old handlers, copied from main.py before the snapshot change.
    # Returning plain Python objects makes FastAPI run jsonable_encoder and
    # json.dumps on every request: ~900 KB of nested lists for /shapes.
    @app.get("/old/shapes")
    async def old_shapes():
        return {sid: {"coords": s.coords, "cum": s.cum} for sid, s in m.shapes.items()}

    # response_model adds Pydantic validation on top, and the train positions
    # themselves are re-solved per request, as the old /api/trains did.
    @app.get("/old/trains", response_model=List[TrainOut])
    async def old_trains():
        return m.trains(realtime.state)

    # 2. Snapshot, identity encoding only.
    # Hands back the pre-encoded bytes untouched: no encoding work, but the
    # full uncompressed body still goes over the wire.
    @app.get("/snapshot/shapes")
    async def snap_shapes():
        return Response(shapes.body, media_type="application/json")

    @app.get("/snapshot/trains")
    async def snap_trains():
        return Response(trains.body, media_type="application/json")

    # 3. Snapshot + gzip: the current production code path.
    # Payload.respond() picks the pre-gzipped bytes because the client sends
    # Accept-Encoding: gzip; nothing is compressed at request time.
    @app.get("/gzip/shapes")
    async def gzip_shapes(request: Request):
        return shapes.respond(request, "no-store")

    @app.get("/gzip/trains")
    async def gzip_trains(request: Request):
        return trains.respond(request, "no-store")

    return app


def free_port() -> int:
    # Bind to port 0 so the OS picks an unused port; avoids clashing with a
    # dev server already running on 8020.
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def time_endpoint(client: httpx.Client, path: str, n: int):
    """Return (per-request times in ms, response size in bytes on the wire)."""
    def hit() -> int:
        # Stream and read the raw bytes: iter_raw() skips httpx's automatic
        # gunzip, so we time the server, not client-side decompression, and
        # the byte count is what actually crossed the network.
        with client.stream("GET", path) as r:
            r.raise_for_status()
            return sum(len(chunk) for chunk in r.iter_raw())

    for _ in range(WARMUP):
        hit()
    times, size = [], 0
    for _ in range(n):
        # perf_counter: monotonic, high resolution; right clock for intervals.
        t0 = time.perf_counter()
        size = hit()
        times.append((time.perf_counter() - t0) * 1000)
    return times, size


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("-n", type=int, default=100, help="timed requests per scenario")
    args = parser.parse_args()

    # require_fresh=False: any cached subset will do for timing, even one
    # older than a day; we only need realistic data volumes.
    subset = gtfs_static.cached_subset(require_fresh=False)
    if subset is None:
        raise SystemExit("No cached GTFS subset in data/cache; build it first (see docstring).")
    m = MetroData(subset)

    # Run a real uvicorn server in a background thread, so each request goes
    # through HTTP parsing and the socket like in production, not a test shim.
    port = free_port()
    server = uvicorn.Server(uvicorn.Config(build_app(m), port=port, log_level="warning"))
    threading.Thread(target=server.run, daemon=True).start()
    while not server.started:
        time.sleep(0.05)

    # (label printed in the table, URL prefix of the matching routes)
    scenarios = [
        ("1. old (rebuild + serialise)", "old"),
        ("2. snapshot, no gzip", "snapshot"),
        ("3. snapshot + gzip", "gzip"),
    ]
    # Every scenario gets the same Accept-Encoding header, like a browser would
    # send; only variant 3 actually acts on it.
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
                # quantiles(n=20) gives 19 cut points; the last one is the 95th percentile.
                p95 = statistics.quantiles(times, n=20)[-1]
                # Estimated, not measured: bytes -> bits, divided by link speed, in ms.
                xfer = size * 8 / (LINK_MBIT * 1e6) * 1000
                print(f"  {label:<30}{mean:>9.2f}{statistics.median(times):>9.2f}{p95:>9.2f}"
                      f"{size:>11,}{mean + xfer:>13.1f} ms")
            # Each optimisation's own share: old -> snapshot, then snapshot -> gzip.
            print(f"  snapshot saves {means['old'] - means['snapshot']:.2f} ms/request; "
                  f"gzip saves a further {means['snapshot'] - means['gzip']:.2f} ms on localhost")

    server.should_exit = True


if __name__ == "__main__":
    main()
