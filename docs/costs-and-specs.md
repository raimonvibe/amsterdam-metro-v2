# Costs & infrastructure specs

Planning guide for running **Amsterdam Metro Live** in production (Render.com or similar). Figures below are based on measured behaviour from this repo (Jul 2026).

Related: [render-deploy-plan.md](./render-deploy-plan.md)

---

## What the app needs to stay “live”

| Requirement | Why |
|---|---|
| **Always-on backend** | Polls GTFS-realtime every **30 s**; if the server sleeps, trains stop updating |
| **Outbound HTTPS** | Downloads from OVapi (`gtfs.ovapi.nl`) — no API key |
| **~512 MB+ RAM** | Python + in-memory metro graph + ~1k live trip updates |
| **~250 MB disk** (ephemeral OK) | GTFS zip cache + JSON subset |
| **Static frontend host** | ~2 MB built SPA; map tiles load from OpenFreeMap in the **browser** (not your server) |

No database, Redis, or paid map/transit API keys.

---

## Measured resource usage (this project)

| Resource | Typical value | Notes |
|---|---|---|
| GTFS static zip | **~236 MB** | Downloaded at most once per 24 h |
| Metro subset cache (`gvb_metro.json`) | **~1 MB** | Fast restarts when cache exists |
| Realtime feed (`tripUpdates.pb`) | **~4.9 MB** per poll | Every 30 s while running |
| Backend RAM (steady state) | **~110 MB** | After GTFS load |
| Backend RAM (startup peak) | **~300–512 MB** | While parsing zip / building subset |
| Frontend build (`dist/`) | **~1.7 MB** | Gzipped over the wire ≈ 500 KB |
| Active metro trips in memory | **~1,000** | Full NL feed filtered to GVB metro |
| Active trains on map | **~5–15** | Varies by time of day |

---

## Network bandwidth (backend)

Rough **inbound** from OVapi (your server downloads):

| Source | Frequency | Size | Per day | Per month (30 d) |
|---|---|---|---|---|
| `tripUpdates.pb` | Every 30 s | ~4.9 MB | **~14 GB** | **~420 GB** |
| `gtfs-nl.zip` | ≤ once / 24 h | ~236 MB | **~0.2 GB** | **~7 GB** |
| **Total inbound** | | | **~14 GB/day** | **~430 GB/month** |

Rough **outbound** from your API (depends on traffic):

| Endpoint | Client poll | Size (order of) |
|---|---|---|
| `/api/trains` | Every 5 s / user | ~2–20 KB |
| `/api/status` | Every 30 s / user | ~200 B |
| `/api/shapes`, `/api/lines`, `/api/stations` | Once on load | ~100–500 KB total |

**Example:** 10 concurrent users ≈ **~1–3 GB/month** API egress (very rough).

**Not on your bill:** OpenFreeMap vector tiles — fetched directly by each visitor’s browser.

---

## Recommended specs by tier

### Minimum (demo / low traffic)

| | Spec |
|---|---|
| **Backend** | 512 MB RAM, 0.5 vCPU, 1 GB disk |
| **Frontend** | Static hosting (CDN) |
| **Uptime** | Can tolerate 15–60 s cold starts |
| **Good for** | Personal demo, portfolio |

**Caveat:** On **512 MB**, first boot or daily GTFS refresh can spike memory during zip parse. Usually works; if OOM, bump to 1 GB.

### Recommended (public site, always live)

| | Spec |
|---|---|
| **Backend** | **1 GB RAM**, 0.5–1 vCPU, **1 GB persistent disk** (optional) |
| **Frontend** | Static site (free tier fine) |
| **Uptime** | Always on, no spin-down |
| **Region** | EU (Frankfurt / Amsterdam) — closer to OVapi & users |

Persistent disk avoids re-downloading 236 MB GTFS on every deploy/restart.

### High traffic (100+ concurrent users)

| | Spec |
|---|---|
| **Backend** | 2 GB RAM, 1 vCPU |
| **Frontend** | Static + CDN (default on Render) |
| **Optional** | Separate cache layer only if you add heavy features — **not needed today** |

---

## Render.com cost breakdown

Pricing below reflects Render’s usual model (verify on [render.com/pricing](https://render.com/pricing) before deploy).

### Option A — Free (testing only)

| Service | Plan | Cost | Limitations |
|---|---|---|---|
| Backend API | Free Web Service | **$0** | 512 MB RAM, **spins down after ~15 min idle**, 750 h/month |
| Frontend | Free Static Site | **$0** | Unlimited static bandwidth |
| **Total** | | **$0/month** | Cold start + 2–5 min GTFS load; live badge goes stale when asleep |

**Verdict:** OK for trying Render, **not** for a reliable public “live” map.

### Option B — Recommended production

| Service | Plan | Cost | Why |
|---|---|---|---|
| Backend API | **Starter** Web Service | **$7/month** | Always on, 512 MB RAM, no spin-down |
| Frontend | Free Static Site | **$0** | SPA is tiny |
| Persistent disk (optional) | 1 GB | **~$0.25/month** | Keep GTFS zip/cache between deploys |
| **Total** | | **~$7–8/month** | Best balance for this project |

### Option C — Safer headroom (busy hours / faster deploys)

| Service | Plan | Cost |
|---|---|---|
| Backend API | **Standard** | **$25/month** (2 GB RAM, 1 CPU) |
| Frontend | Free Static Site | **$0** |
| Persistent disk | 1 GB | **~$0.25/month** |
| **Total** | | **~$25/month** |

Only needed if Starter OOMs during GTFS ingest or you want extra CPU margin.

### Render cost summary

| Goal | Monthly cost |
|---|---|
| Hobby / test | **$0** (with cold starts) |
| **Live public map** | **~$7–8** |
| Comfortable headroom | **~$25** |

---

## Alternative hosts (same app)

| Provider | Typical spec | Est. cost | Notes |
|---|---|---|---|
| **Hetzner CX22** | 2 vCPU, 4 GB RAM, 40 GB disk | **~€4–6/month** | Single VPS runs backend + nginx static; you manage updates |
| **Fly.io** | 1 shared CPU, 512 MB | **~$5–10/month** | Needs `fly.toml`; good EU regions |
| **Railway** | Usage-based | **~$5–15/month** | Simple GitHub deploy; watch bandwidth |
| **DigitalOcean App Platform** | Basic container | **~$5–12/month** | Similar to Render |

This app is light except for **continuous OVapi polling** (~14 GB/day inbound). Any host with fair bandwidth and always-on compute works.

---

## External services (all free)

| Service | Cost | Usage |
|---|---|---|
| [OVapi / GTFS-NL](https://gtfs.ovapi.nl/) | **Free** (fair use) | Static + realtime feeds |
| [OpenFreeMap](https://openfreemap.org/) | **Free** | Map tiles in browser |
| GitHub | **Free** | Source + Render deploy hook |
| Domain (`amsterdammetro.nl`) | **~€8–15/year** | .nl registration; see [domain.md](docs/domain.md) |

---

## Client (visitor) requirements

Not a server cost, but affects who can use the site:

| Requirement | Detail |
|---|---|
| Browser | Modern Chrome, Firefox, Safari, Edge |
| **WebGL** | Required for MapLibre + deck.gl 3D map |
| Download | ~2 MB JS + map tiles (client → OpenFreeMap) |
| API calls | Browser → your backend (`VITE_API_URL`) every 5–30 s |

---

## Cost scenarios

### Solo developer, always-on live map

```
Render Starter backend     $7.00
Render static frontend     $0.00
Optional 1 GB disk         $0.25
Optional domain            ~€1/month (amsterdammetro.nl)
─────────────────────────────────
Total                      ~$7–8/month
```

### Portfolio demo (OK with sleep)

```
Render free backend        $0.00
Render static frontend     $0.00
─────────────────────────────────
Total                      $0/month
(trade-off: first visitor waits for wake + GTFS)
```

### Self-hosted VPS (maximum control)

```
Hetzner CX22               ~€5/month
Domain                     optional
─────────────────────────────────
Total                      ~€5/month + your ops time
```

---

## Sizing checklist before launch

- [ ] Backend **always on** (not free-tier spin-down) if you want 24/7 “LIVE” badge
- [ ] **≥ 512 MB RAM** (1 GB safer for GTFS cold start)
- [ ] **≥ 1 GB disk** for GTFS zip + cache (persistent disk on Render optional but nice)
- [ ] **EU region** for lower latency to OVapi
- [ ] Register **amsterdammetro.nl** and configure DNS ([domain.md](./domain.md))
- [ ] Set `VITE_API_URL` + `CORS_ORIGINS` (already in `render.yaml`)
- [ ] Expect **~430 GB/month inbound** bandwidth on backend (included on most paid plans; confirm provider limits)
- [ ] No need to pay for map tiles or transit API keys

---

## Quick reference

| | Local dev | Production |
|---|---|---|
| **Site** | http://localhost:5183 | **https://amsterdammetro.nl** |
| **API** | http://localhost:8020 | **https://api.amsterdammetro.nl** |
| Backend RAM | Your machine | 512 MB–1 GB |
| Backend cost | $0 | **~$7/month** (Render Starter) |
| Frontend cost | $0 | **$0** (static) |
| Transit data | Free | Free |
| Map tiles | Free (client-side) | Free (client-side) |
| **Total** | **$0** | **~$7–8/month** |

**Bottom line:** A reliable always-live deployment needs **one small always-on Python service** (~512 MB–1 GB) plus **free static hosting**. Budget **~$7–8/month** on Render, or **~€5/month** on a EU VPS if you don’t mind managing the server yourself.
