from pathlib import Path
import os

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CACHE_DIR = DATA_DIR / "cache"

GTFS_STATIC_URL = "https://gtfs.ovapi.nl/nl/gtfs-nl.zip"
GTFS_STATIC_ZIP = DATA_DIR / "gtfs-nl.zip"
GTFS_CACHE_FILE = CACHE_DIR / "gvb_metro.json"
GTFS_MAX_AGE_HOURS = 24

TRIP_UPDATES_URL = "https://gtfs.ovapi.nl/nl/tripUpdates.pb"
RT_POLL_SECONDS = 30

# Comma-separated list, or "*" when unset (handy for local dev).
_cors = os.getenv("CORS_ORIGINS", "").strip()
CORS_ORIGINS = ["*"] if not _cors else [o.strip() for o in _cors.split(",") if o.strip()]

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
