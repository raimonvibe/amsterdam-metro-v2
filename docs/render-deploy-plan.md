# Deploy Amsterdam Metro Live on Render.com

Plan for hosting this project on [Render](https://render.com). Render supports **Python web services** (FastAPI) and **static sites** (Vite/React build), which matches this repo’s split backend/frontend layout.

---

## Architecture overview

| Component | Render type | Runtime | Public URL example |
|---|---|---|---|
| Backend API | **Web Service** | Python 3.12 + Uvicorn | `https://api.amsterdammetro.nl` |
| Frontend UI | **Static Site** | Node build → static files | `https://amsterdammetro.nl` |

**Why two services?**

- Backend must stay running to poll GTFS-realtime every ~30s.
- Frontend is a static SPA after `npm run build`.
- Locally, Vite proxies `/api` → `:8020`. In production, the frontend must call the backend URL directly (see [Code changes required](#code-changes-required-before-deploy)).

**Alternative (simpler, one URL):** serve the built frontend from FastAPI with `StaticFiles` on a single Web Service. Fewer moving parts, but slightly more backend code. This plan focuses on the standard two-service setup.

Related: [domain.md](./domain.md) · [costs-and-specs.md](./costs-and-specs.md) — production URLs, DNS, RAM, and pricing.

---

## Prerequisites

- GitHub repo: [raimonvibe/amsterdam-metro-v2](https://github.com/raimonvibe/amsterdam-metro-v2)
- Production domain: **amsterdammetro.nl** (frontend) + **api.amsterdammetro.nl** (API)
- Render account (free tier works for testing; see [costs & limits](#costs--limits))
- No API keys needed (OVapi + OpenFreeMap are free)

---

## Local vs production (how it works)

| | **Local dev** | **Production (Render)** |
|---|---|---|
| Frontend | `npm run dev` → `:5183` | Static site build |
| API calls | Relative `/api/...` via Vite proxy | Full URL via `VITE_API_URL` |
| Backend | `uvicorn` on `:8020` | Render Web Service on `$PORT` |
| CORS | `*` (default) | Set `CORS_ORIGINS` to frontend URL |

**Frontend env files**

- `frontend/.env.development` — `VITE_API_URL=` (empty, uses proxy)
- `frontend/.env.production.example` — template for Render

**Backend env**

- `backend/.env.example` — optional `CORS_ORIGINS` for production

---

## Code changes required before deploy

These are **already in the repo**:

### 1. Frontend API base URL

`frontend/src/api.ts` uses `VITE_API_URL` when set, otherwise relative `/api/...` for local dev.

Set on Render Static Site at build time:

```bash
VITE_API_URL=https://api.amsterdammetro.nl
```

### 2. Backend bind to Render’s `PORT`

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### 3. CORS in production

Set on Render Web Service:

```bash
CORS_ORIGINS=https://amsterdammetro.nl,https://www.amsterdammetro.nl
```

Local dev: leave unset → allows all origins.

### 4. Deploy files

| File | Purpose |
|---|---|
| `render.yaml` | Blueprint describing both services (see note below) |
| `backend/runtime.txt` | Python 3.12.8 |

> **`render.yaml` is not applied to the production services.** They were created by hand in the Render dashboard, not from a Blueprint, so Render never reads this file: start command, headers and rewrites in it have no effect. **The dashboard is the source of truth.** Keep `render.yaml` in sync as documentation (or link it as a Blueprint), and make real changes in the dashboard:
>
> | Service | Dashboard setting | Value |
> |---|---|---|
> | `amsterdam-metro-api` | Settings → Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-access-log --timeout-graceful-shutdown 5` |
> | `amsterdam-metro` | Manage → Headers | `/assets/*` → `Cache-Control: public, max-age=31536000, immutable`; `/*` → `Referrer-Policy: strict-origin-when-cross-origin` |
> | `amsterdam-metro` | Manage → Redirects/Rewrites | Source `/*` → Destination `/index.html`, action **Rewrite** |

---

## Step-by-step: Backend (Python Web Service)

### Create service

1. Render Dashboard → **New +** → **Web Service**
2. Connect GitHub repo `raimonvibe/amsterdam-metro-v2`
3. Settings:

| Setting | Value |
|---|---|
| **Name** | `amsterdam-metro-api` |
| **Region** | Frankfurt (closest to Amsterdam) |
| **Root directory** | `backend` |
| **Runtime** | Python 3 |
| **Build command** | `pip install -r requirements.txt` |
| **Start command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT --no-access-log --timeout-graceful-shutdown 5` |
| **Health check path** | `/healthz` |

### Environment variables

| Key | Value | Notes |
|---|---|---|
| `PYTHON_VERSION` | `3.12.8` | Match local dev |
| `CORS_ORIGINS` | `https://amsterdammetro.nl,https://www.amsterdammetro.nl` | Set in `render.yaml` |
| `GTFS_DATA_DIR` | e.g. `/var/data/gtfs` | Optional. Point at a persistent disk mount to keep the GTFS zip + subset across deploys/restarts |

### First startup behavior

On first boot (and after every redeploy, unless `GTFS_DATA_DIR` is on a persistent disk):

1. Uvicorn starts serving immediately; `/healthz` and the APIs return **503** while static data loads
2. A **child process** downloads the national GTFS zip (~**240 MB**) from OVapi and builds the GVB metro subset (~30 s CPU locally, longer on 0.5 CPU, ~115 MB peak RAM). It runs out-of-process so the rebuild never stalls request handling.
3. The realtime poller and the 1-second train snapshot start serving

**Expect 1–3 minutes** before `/healthz` passes. Render keeps the previous instance serving until it does, so deploys are zero-downtime. If OVapi is unreachable, the backend falls back to the previous cached subset (still valid for about a day) instead of failing to start.

### Verify backend

```bash
curl https://api.amsterdammetro.nl/healthz
curl https://api.amsterdammetro.nl/api/status
```

---

## Step-by-step: Frontend (Static Site)

### Create service

1. Render Dashboard → **New +** → **Static Site**
2. Same GitHub repo
3. Settings:

| Setting | Value |
|---|---|
| **Name** | `amsterdam-metro` |
| **Root directory** | `frontend` |
| **Build command** | `npm install && npm run build` |
| **Publish directory** | `dist` |

### Environment variables (build time)

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://api.amsterdammetro.nl` |

> **Important:** Static sites bake env vars into the build. If the backend URL changes, **redeploy** the frontend.

### SPA routing

Render static sites do **not** read a `_redirects` file (that is a Netlify convention). Add the rule in the dashboard: **Manage → Redirects/Rewrites** → Source `/*`, Destination `/index.html`, action **Rewrite**. Without it, opening `/privacy` or `/reisinfo` directly (shared link, refresh, search engines) returns 404. Real files (`/assets/…`, `/sitemap.xml`, `/robots.txt`) are still served as-is.

The build also writes `reisinfo/index.html` and `privacy/index.html`, copies of the entry page whose title, description, canonical and social tags already name that page (see `frontend/src/seo/routeHtml.ts`), so crawlers that read the HTML before running JavaScript don't see the homepage there. Add two rewrites **above** the `/*` rule, because rules run top to bottom:

| Source | Destination | Action |
|---|---|---|
| `/reisinfo` | `/reisinfo/index.html` | Rewrite |
| `/privacy` | `/privacy/index.html` | Rewrite |
| `/*` | `/index.html` | Rewrite |

Check after deploy: `curl -s https://amsterdammetro.nl/reisinfo | grep canonical` should print `…/reisinfo`, not `…/`.

### Verify frontend

Open `https://amsterdammetro.nl` — map loads, sidebar shows live train count, no “Backend not reachable” error.

---

## Deployment checklist

- [ ] Push repo to GitHub
- [x] Add `VITE_API_URL` support in `frontend/src/api.ts`
- [ ] Deploy backend Web Service
- [ ] Wait for GTFS download; confirm `/api/status` returns `is_live: true`
- [ ] Copy backend URL
- [ ] Set `VITE_API_URL` on Static Site
- [ ] Deploy frontend
- [ ] Test map, trains, station departures in browser
- [ ] Configure DNS for **amsterdammetro.nl** (see [domain.md](./domain.md))

---

## Costs & limits

### Render free tier

| Limit | Impact on this project |
|---|---|
| **Spin down after ~15 min idle** | Cold start + GTFS re-download on wake (slow first load) |
| **512 MB RAM** | Usually enough after GTFS subset is cached |
| **Ephemeral disk** | GTFS zip/cache lost on redeploy; re-downloads each deploy |
| **750 free instance hours/month** | ~1 always-on service |

**Good for:** demos, personal use, testing.

### Render Starter (~$7/month per service) — what production runs on

| Benefit | Impact |
|---|---|
| Always on | No cold starts; realtime poller stays live |
| 512 MB RAM / 0.5 CPU | Plenty: ~100 MB steady, ~115 MB more during the daily rebuild |
| Optional **persistent disk** ($0.25/GB) | Keep GTFS cache between deploys (set `GTFS_DATA_DIR`). Note: Render disables zero-downtime deploys for services with a disk |

#### How the backend stays cheap per viewer

- Train positions are solved **once per second** into a shared, pre-serialised, pre-gzipped snapshot (~5 ms CPU). `/api/trains` and `/api/status` just send those bytes, so cost does not grow with the number of viewers.
- `/api/lines`, `/api/stations`, `/api/shapes` are serialised and gzipped once per GTFS refresh and served with `ETag` + `Cache-Control: max-age=300` (shapes: 909 KB → 234 KB on the wire; repeat visits get a 304).
- Departures are cached per station for 10 s.
- Browsers pause polling in background tabs.
- Access logging is off (`--no-access-log`): every viewer polls every 5 s.

**Recommended for production:** Starter backend + free static frontend ≈ **$7/month**.

---

## Operational notes

### Health & monitoring

- **Health check:** `GET /healthz` → `{"status":"ok"}`
- **Live status:** `GET /api/status` → train count, last realtime poll
- Render logs: Dashboard → service → **Logs**

### GTFS cache refresh

Backend re-checks hourly and rebuilds static GTFS (in a child process) when the cache is older than 24 hours or no longer covers today (`GTFS_MAX_AGE_HOURS` in `backend/app/config.py`). On ephemeral disk, redeploys always trigger a full re-download.

### WebGL / browsers

Deployment does not fix client-side WebGL issues (Chrome GPU disabled). Users need hardware acceleration enabled locally.

### Custom domain

Full DNS setup, registrar steps, and env vars: **[domain.md](./domain.md)**.

Quick summary:

1. Render static site → `amsterdammetro.nl`, `www.amsterdammetro.nl`
2. Render web service → `api.amsterdammetro.nl`
3. Point DNS at registrar; `render.yaml` already has the correct env vars

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| “Backend not reachable” | Wrong `VITE_API_URL` or backend asleep | Check env var; upgrade to Starter or wake backend |
| 503 on `/api/*` | GTFS still loading | Wait 2–5 min; check backend logs |
| Deploy timeout | GTFS download during build | Build only installs deps; GTFS loads at **start**, not build |
| CORS errors in browser | Frontend URL not allowed | Set `CORS_ORIGINS` or keep `*` for dev |
| Blank map, API OK | WebGL blocked in browser | Enable Chrome hardware acceleration |
| Slow after idle | Free tier spin-down | Use Starter plan for backend |

---

## Quick reference commands

**Local (unchanged):**

```bash
# Backend
cd backend && .venv/bin/uvicorn app.main:app --port 8020

# Frontend
cd frontend && npm run dev
```

**Production URLs (after deploy):**

```text
Frontend:  https://amsterdammetro.nl
Backend:   https://api.amsterdammetro.nl
Health:    https://api.amsterdammetro.nl/healthz
Status:    https://api.amsterdammetro.nl/api/status
```

---

## Summary

Yes — **Render is a good fit** for this project:

- **Python Web Service** runs FastAPI + GTFS poller natively
- **Static Site** hosts the Vite/React frontend cheaply
- **No paid third-party APIs** required
- **~$7/month** for a reliable always-on demo; free tier works with cold-start tradeoffs

Next step: push to GitHub, deploy on Render, then wire DNS — see [domain.md](./domain.md).
