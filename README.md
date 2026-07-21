# Amsterdam Metro Live (v2)

Live 3D map of the Amsterdam metro — real trains, real track geometry, real-time
delays — in the spirit of [londonunderground.live](https://www.londonunderground.live/).

Like London, Amsterdam's metro fleet publishes **no GPS positions**. Instead, this
project derives train positions the same way the London app does:

1. **GTFS static** (daily, from [OVapi](https://gtfs.ovapi.nl/nl/)) provides the
   metro routes (50–54), stations, timetables, and true track geometry (`shapes.txt`).
2. **GTFS-realtime `tripUpdates.pb`** (polled ~30s) provides live per-station
   arrival/departure predictions for every active metro trip.
3. A **position solver** places each train along its track shape between its last
   departed and next predicted station, producing smooth, live movement.

## Stack

- **Backend**: FastAPI (Python) — GTFS ingest, RT poller, position solver
- **Frontend**: React + TypeScript + Vite, deck.gl over MapLibre (dark), 3D
  buildings via fill-extrusion, orbitable camera
- **Data**: OVapi / openOV (free, fair use) · Map tiles: OpenFreeMap

## Run

```bash
# Backend (Python 3.12+)
cd backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -m uvicorn app.main:app --port 8020

# Frontend
cd frontend
npm install
npm run dev   # http://localhost:5183 (proxies /api to :8020)
```

First backend start downloads the national GTFS zip (~240MB) and extracts the
GVB metro subset into `backend/data/cache/` (a few MB, refreshed daily).

## License

MIT
