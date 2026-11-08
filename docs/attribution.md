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

## 3D models (404 page)

| Model | Author | License | Use |
|---|---|---|---|
| [S1/2 Metro for Cities Skylines](https://sketchfab.com/3d-models/s12-metro-for-cities-skylines-e5eef97cc78340d49fb6d4b7f6e77c52) | [accessviolation](https://sketchfab.com/accessviolation) | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) | The S1/S2 metro on the 404 page |
| [Rails](https://sketchfab.com/3d-models/rails-09b595cfd94e45fcae81d247f303f88a) | [Daniel Yaroshenko](https://sketchfab.com/yarodan) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | The track under the S1/S2 on the 404 page |

**Changes:** the metro's textures re-encoded as WebP and its geometry quantized; the rails scaled to a unit segment, repeated along the track, their textures re-encoded as WebP and geometry quantized ([`assets-src/models/README.md`](../assets-src/models/README.md)). The adapted files are licensed like their originals (`s12-metro.glb` CC BY-NC-SA 4.0, `rails.glb` CC BY 4.0), with a notice next to them (`models/LICENSE.txt`). The 404 page credits both models' title, author, source, license and changes in its footer.

**NonCommercial:** the site has no ads, sales or donations. If that changes, check the license or replace the model.

The 3D view uses **three.js** (MIT), loaded on the 404 page only.

## Icons

| Provider | URL | Notice |
|---|---|---|
| **Font Awesome Free** | https://fontawesome.com/license/free | Social icons (inlined as SVG) — icons by [Fonticons, Inc.](https://fontawesome.com/) |
| **Lucide** | https://lucide.dev/license | UI and map-style icons (ISC license) |

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
