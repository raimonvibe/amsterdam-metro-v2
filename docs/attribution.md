# Attribution & third-party notices

Amsterdam Metro Live uses the following services and data sources.  
This document mirrors the in-app credits in `frontend/src/components/Credits.tsx`.

## Transit data

| Provider | URL | Use |
|---|---|---|
| **OVapi** | https://gtfs.ovapi.nl/ | GTFS static (`gtfs-nl.zip`) and GTFS-realtime (`tripUpdates.pb`) |
| **openOV** | https://openov.nl/ | Open-data programme behind OVapi |
| **NDOV** | https://ndov.nl/ | National open-data for public transport (Netherlands) |

Metro routes, stations, timetables, and live predictions for **GVB lines 50–54** are derived from these open feeds.

**License:** Underlying NDOV data is released under **[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)** (public domain dedication). OVapi converts and hosts GTFS feeds as a best-effort service operated by Stichting OpenGeo / Bliksem Labs B.V.

**Technical usage policy** ([OVapi README](https://gtfs.ovapi.nl/README)) — implemented in this repo:

1. **`User-Agent`** identifies the app: `AmsterdamMetroLive/2.0 (+https://amsterdammetro.nl)`
2. **`If-None-Match` / `If-Modified-Since`** on realtime polls (every 30 s)
3. **No impersonation** of transit agencies

> **Disclaimer:** This app is **not affiliated with, endorsed by, or operated by GVB** (Gemeentelijk Vervoerbedrijf) or the City of Amsterdam. Route names and line numbers refer to publicly available open data only.

## Map tiles & geographic data

| Provider | URL | License / terms |
|---|---|---|
| **OpenFreeMap** | https://openfreemap.org/ | Free vector tile hosting |
| **OpenStreetMap** | https://www.openstreetmap.org/copyright | ODbL — © OpenStreetMap contributors |
| **OpenMapTiles** | https://openmaptiles.org/ | Vector tile schema used by OpenFreeMap styles |

Map attribution also appears in the MapLibre control on the map (bottom-right). OpenFreeMap [requires attribution](https://openfreemap.org/); MapLibre adds this automatically.

## Privacy

| Item | Detail |
|---|---|
| **localStorage** | Dark/light theme preference only |
| **Cookies** | None set by this app |
| **Analytics** | None |
| **Personal data** | Not collected |

See [legal-compliance.md](./legal-compliance.md) for a full compliance checklist.

## Open-source libraries

| Library | URL | License |
|---|---|---|
| **MapLibre GL JS** | https://maplibre.org/ | BSD-3-Clause |
| **deck.gl** | https://deck.gl/ | MIT |
| **React / Vite / FastAPI** | — | MIT / MIT / MIT |

See `package.json` and `backend/requirements.txt` for full dependency lists.

## Icons

| Provider | URL | Notice |
|---|---|---|
| **Font Awesome Free** | https://fontawesome.com/license/free | Social icons — icons by [Fonticons, Inc.](https://fontawesome.com/) |

## Inspiration

| Project | URL | Credit |
|---|---|---|
| **londonunderground.live** | https://www.londonunderground.live/ | Concept inspiration — Ben James |

## This project

| Item | Detail |
|---|---|
| **Site** | https://amsterdammetro.nl |
| **Source** | https://github.com/raimonvibe/amsterdam-metro-v2 |
| **License** | MIT — see [LICENSE](../LICENSE) |
| **Author** | raimonvibe |
