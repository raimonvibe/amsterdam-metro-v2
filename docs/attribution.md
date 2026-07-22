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

> **Disclaimer:** This app is not affiliated with, endorsed by, or operated by **GVB** or the City of Amsterdam. “GVB” refers to the transit agency whose open data is used under fair-use terms.

## Map tiles & geographic data

| Provider | URL | License / terms |
|---|---|---|
| **OpenFreeMap** | https://openfreemap.org/ | Free vector tile hosting |
| **OpenStreetMap** | https://www.openstreetmap.org/copyright | ODbL — © OpenStreetMap contributors |
| **OpenMapTiles** | https://openmaptiles.org/ | Vector tile schema used by OpenFreeMap styles |

Map attribution also appears in the MapLibre control on the map (bottom-right).

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
