from pathlib import Path
import os

# Point at a persistent disk (e.g. a Render disk mount) to keep the 240MB zip
# and the subset across deploys/restarts instead of re-downloading each time.
DATA_DIR = Path(os.getenv("GTFS_DATA_DIR") or Path(__file__).resolve().parent.parent / "data")
CACHE_DIR = DATA_DIR / "cache"

GTFS_STATIC_URL = "https://gtfs.ovapi.nl/nl/gtfs-nl.zip"
GTFS_STATIC_ZIP = DATA_DIR / "gtfs-nl.zip"
GTFS_CACHE_FILE = CACHE_DIR / "gvb_metro.json"
GTFS_MAX_AGE_HOURS = 24
# How often the running process re-checks the static subset. load_subset()
# itself is cheap when the cache is still valid, so this can be frequent;
# it's what guards against a long-lived process serving a stale service-date
# window (see docs on the day-rollover bug this replaced).
GTFS_REFRESH_SECONDS = 3600

TRIP_UPDATES_URL = "https://gtfs.ovapi.nl/nl/tripUpdates.pb"
RT_POLL_SECONDS = 30
# Metro entries carry no GPS (0,0) but do name the stop a train is at or
# heading to, with the time the signalling system reported it. Small (~35KB
# nationally), so polled faster than trip updates: a platform stop lasts ~25s.
VEHICLE_POSITIONS_URL = "https://gtfs.ovapi.nl/nl/vehiclePositions.pb"
VEHICLE_POLL_SECONDS = 20
# KV15 service messages: ~350KB for the whole country and slow to change.
ALERTS_URL = "https://gtfs.ovapi.nl/nl/alerts.pb"
ALERTS_POLL_SECONDS = 120

# Comma-separated list, or "*" when unset (handy for local dev).
_cors = os.getenv("CORS_ORIGINS", "").strip()
CORS_ORIGINS = ["*"] if not _cors else [o.strip() for o in _cors.split(",") if o.strip()]

# Interactive API docs (/docs, /redoc, /openapi.json): off unless asked for,
# so production does not publish them. Set API_DOCS=1 locally to browse.
API_DOCS = os.getenv("API_DOCS", "").strip().lower() in ("1", "true", "yes")

# Required by OVapi technical usage policy: https://gtfs.ovapi.nl/README
HTTP_USER_AGENT = os.getenv(
    "HTTP_USER_AGENT",
    "AmsterdamMetroLive/2.0 (+https://amsterdammetro.nl)",
)
HTTP_HEADERS = {"User-Agent": HTTP_USER_AGENT}

# GVB metro lines and display colours (public route colours, not official GVB branding)
METRO_LINES = {
    "50": {"name": "Gein - Isolatorweg", "color": "#3CB44B"},
    "51": {"name": "Centraal Station - Isolatorweg", "color": "#F58231"},
    "52": {"name": "Noord - Zuid", "color": "#4363D8"},
    "53": {"name": "Centraal Station - Gaasperplas", "color": "#E6194B"},
    "54": {"name": "Centraal Station - Gein", "color": "#FFE119"},
}
