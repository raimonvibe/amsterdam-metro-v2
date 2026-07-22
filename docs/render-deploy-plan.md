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
| `render.yaml` | Blueprint: both services in one click |
| `backend/runtime.txt` | Python 3.12.8 |
| `frontend/public/_redirects` | SPA routing on static host |

Example `render.yaml` (already at repo root):

```yaml
# See render.yaml at repo root — deploy via Render Blueprint or copy settings manually.
```

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
| **Start command** | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Health check path** | `/healthz` |

### Environment variables

| Key | Value | Notes |
|---|---|---|
| `PYTHON_VERSION` | `3.12.8` | Match local dev |
| `CORS_ORIGINS` | `https://amsterdammetro.nl,https://www.amsterdammetro.nl` | Set in `render.yaml` |

### First startup behavior

On first boot (and after redeploy on free tier):

1. Downloads national GTFS zip (~**240 MB**) from OVapi
2. Parses and caches GVB metro subset (~few MB JSON)
3. Starts realtime poller

**Expect 2–5 minutes** before APIs respond. `/healthz` returns immediately once Uvicorn is up; `/api/status` returns 503 until GTFS load finishes.

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

Add a `_redirects` file in `frontend/public/` (copied to `dist` on build):

```
/*    /index.html   200
```

Or use Render’s **Rewrite** rule: `/*` → `/index.html`.

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

### Render Starter (~$7/month per service)

| Benefit | Impact |
|---|---|
| Always on | No cold starts; realtime poller stays live |
| More RAM/CPU | Faster GTFS parse |
| Optional **persistent disk** ($0.25/GB) | Keep GTFS cache between deploys |

**Recommended for production:** Starter backend + free static frontend ≈ **$7/month**.

---

## Operational notes

### Health & monitoring

- **Health check:** `GET /healthz` → `{"status":"ok"}`
- **Live status:** `GET /api/status` → train count, last realtime poll
- Render logs: Dashboard → service → **Logs**

### GTFS cache refresh

Backend refreshes static GTFS when cache is older than 24 hours (`GTFS_MAX_AGE_HOURS` in `backend/app/config.py`). On ephemeral disk, redeploys always trigger a full re-download.

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
