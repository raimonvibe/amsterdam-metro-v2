# Legal compliance review

Last reviewed: July 2026. **Not legal advice** — a checklist for this open-source hobby project.

Related: [attribution.md](./attribution.md) · [privacy-policy.md](./privacy-policy.md) · [domain.md](./domain.md)

---

## Summary

| Area | Status | Notes |
|---|---|---|
| **Transit data (OVapi)** | ✅ Compliant (after fixes) | CC0 data; User-Agent + conditional HTTP headers |
| **GVB / trademark** | ✅ OK with disclaimers | No logo; clear “unofficial” notice in app |
| **OpenStreetMap / tiles** | ✅ OK | MapLibre attribution control on map |
| **Open-source libs** | ✅ OK | MIT/BSD; LICENSE file present |
| **Font Awesome** | ✅ OK | Free icons; attribution in credits |
| **Privacy (GDPR)** | ✅ Compliant | In-app policy + docs; localStorage only; Render as processor |
| **Your MIT license** | ✅ OK | Copyright notice in LICENSE |

---

## 1. Transit data (OVapi / NDOV / openOV)

**Source:** [gtfs.ovapi.nl/README](https://gtfs.ovapi.nl/README)

| Requirement | Status |
|---|---|
| Free to use | ✅ CC0 / open license via NDOV koppelvlakken |
| No impersonation of transit agencies | ✅ In-app + docs disclaimer |
| Identify in `User-Agent` | ✅ `AmsterdamMetroLive/2.0 (+https://amsterdammetro.nl)` |
| `If-Modified-Since` / `If-None-Match` when polling &lt; 1 min | ✅ Realtime poller uses conditional headers |
| No SLA / best-effort | ✅ Documented; app keeps last known state on failure |
| Scientific citation (optional) | ℹ️ See attribution.md |

**Backend implementation:** `backend/app/config.py` (`HTTP_USER_AGENT`), `gtfs_static.py`, `realtime.py`.

---

## 2. GVB and branding

| Risk | Mitigation |
|---|---|
| Implied official GVB app | “Unofficial — not affiliated with GVB” in sidebar credits |
| GVB logo / registered marks | ❌ Not used anywhere |
| Line colours on map | Public route colours for identification only — not GVB corporate identity |
| Domain `amsterdammetro.nl` | Descriptive; disclaimer clarifies non-official status |

**Recommendation:** Do not add GVB logo, “official”, or “GVB app” wording in marketing.

---

## 3. Map data (OpenFreeMap / OpenStreetMap)

**Source:** [openfreemap.org](https://openfreemap.org/) — attribution required.

| Requirement | Status |
|---|---|
| OSM © attribution | ✅ MapLibre default control (bottom-right on map) |
| OpenFreeMap credit | ✅ Shown in map control + sidebar credits |
| Commercial use | ✅ Allowed by OpenFreeMap |
| ODbL for OSM data | ✅ Attribution satisfies display requirement for interactive map |

---

## 4. Open-source software

| Component | License | Compliance |
|---|---|---|
| This repo | MIT | ✅ LICENSE file with copyright |
| MapLibre GL JS | BSD-3-Clause | ✅ Preserve copyright in source distributions |
| deck.gl, React, FastAPI | MIT | ✅ |
| Font Awesome Free | Icons: CC BY 4.0; Fonts: SIL OFL | ✅ Credit + link to license/free |

Redistributing built frontend includes minified third-party JS — standard for web apps; source available on GitHub.

---

## 5. Privacy (GDPR / AVG)

**Data controller:** Raimon / raimonvibe — see [privacy-policy.md](./privacy-policy.md).

| Data | Stored? | Where |
|---|---|---|
| Theme (dark/light) | Yes | `localStorage` in browser only |
| Location | No | — |
| Accounts / email | No | — |
| Analytics / cookies | No | — |
| Server logs | Yes (hosting) | Render may log IP, URL, user-agent on API/static requests |

**In-app policy:** `/privacy` route (modal overlay) — link in sidebar credits. Source: `frontend/src/components/PrivacyPolicy.tsx`, operator constants in `frontend/src/legal/site.ts`.

**Render (processor):**

| Service | Logs personal data? | Notes |
|---|---|---|
| Static site (frontend) | No application logs | Render static sites emit no server logs |
| Web service (API) | IP + request metadata | Typical HTTP access logs; 7–30 days retention by plan |
| DPA | [render.com/dpa](https://render.com/dpa) | EU-US Data Privacy Framework; accept in Render dashboard |

Deploy API in **Frankfurt** region when possible for EU data residency preference.

**Status:** Privacy policy published; no consent banner required for theme-only localStorage. Revisit if adding analytics or accounts.

---

## 6. Inspiration (londonunderground.live)

| Item | Status |
|---|---|
| Concept inspiration | ✅ Credited by name + link |
| Code reuse | ✅ Independent codebase — no copied source |

---

## 7. Remaining recommendations

| Priority | Action |
|---|---|
| Low | Register `amsterdammetro.nl` in your name; keep WHOIS accurate |
| Low | Accept Render DPA in dashboard when deploying |
| Low | If GVB contacts you about naming, be ready to clarify unofficial status |
| Info | OVapi is best-effort — show “last updated” (already in app) |

---

## Checklist before public launch

- [x] User-Agent on OVapi HTTP requests
- [x] Conditional headers on realtime poll
- [x] GVB unofficial disclaimer visible in app
- [x] OSM / OpenFreeMap attribution on map
- [x] Third-party credits in sidebar
- [x] MIT LICENSE in repo
- [x] Privacy policy (`/privacy` + docs/privacy-policy.md)
- [ ] Custom domain DNS + HTTPS live
