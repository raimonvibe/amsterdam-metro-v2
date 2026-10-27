#!/usr/bin/env bash
# Seed frontend/src/data/accessibility.json from OpenStreetMap (Overpass API).
#
# Unlike churches.json this file is curated: a station whose "source" is
# "checked" was verified by hand and is never overwritten. Only stations still
# on "osm" (or new ones) take the OSM wheelchair tag of the nearest metro
# station. Station names and positions come from a running backend.
#
#   scripts/seed-accessibility.sh [backend-url]   (default http://localhost:8020)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/src/data/accessibility.json"
BACKEND="${1:-http://localhost:8020}"
QUERY='[out:json][timeout:90];(nwr["railway"="station"]["station"="subway"](52.25,4.70,52.45,5.05);nwr["public_transport"="station"]["subway"="yes"](52.25,4.70,52.45,5.05););out center tags;'

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

curl -fsSL --max-time 30 "$BACKEND/api/stations" -o "$tmp/stations.json"
for api in https://overpass-api.de https://overpass.kumi.systems; do
  curl -fsSL --max-time 120 \
    -H 'User-Agent: amsterdam-metro-v2/1.0 (seed-accessibility)' \
    "$api/api/interpreter" \
    --data-urlencode "data=$QUERY" \
    -o "$tmp/osm.json" && break
done
[ -s "$tmp/osm.json" ] || { echo "Overpass unreachable" >&2; exit 1; }

python3 - "$tmp/stations.json" "$tmp/osm.json" "$OUT" <<'PY'
import datetime, json, math, os, sys

stations = json.load(open(sys.argv[1]))
osm = json.load(open(sys.argv[2]))["elements"]
out = sys.argv[3]
old = json.load(open(out)) if os.path.exists(out) else {"stations": {}}

def where(el):
    return (el["lat"], el["lon"]) if "lat" in el else (el["center"]["lat"], el["center"]["lon"])

def metres(a, b):
    return math.hypot((a[0] - b[0]) * 111_000, (a[1] - b[1]) * 68_000)

# OSM's wheelchair tag, as the card's three states; anything else is unknown.
STATES = {"yes": "yes", "limited": "limited", "no": "no"}

result = {}
for s in sorted(stations, key=lambda s: s["name"]):
    name = s["name"]
    kept = old["stations"].get(name)
    if kept and kept.get("source") == "checked":
        result[name] = kept
        continue
    here = (s["latitude"], s["longitude"])
    near = [el for d, _, el in sorted((metres(here, where(el)), el["id"], el) for el in osm) if d < 300]
    # A metro-only entry wins over a combined train and metro station (Amstel:
    # station=train;subway). Among those, a tagged entry wins over an untagged
    # one: OSM often has both a station node and a station area.
    metro_only = [el for el in near if el.get("tags", {}).get("station") == "subway"]
    pool = metro_only or near
    tagged = [el for el in pool if el.get("tags", {}).get("wheelchair") in STATES]
    el = tagged[0] if tagged else (pool[0] if pool else None)
    entry = {"step_free": "unknown", "source": "osm"}
    if el:
        state = STATES.get(el.get("tags", {}).get("wheelchair"), "unknown")
        # A combined station's "limited" or "no" may be about the train
        # platforms only; "yes" covers the whole station, metro included.
        if el not in metro_only and state != "yes":
            state = "unknown"
        entry["step_free"] = state
        entry["osm"] = f'{el["type"]}/{el["id"]}'
    result[name] = entry

doc = {"updated": datetime.date.today().isoformat(), "stations": result}
with open(out, "w") as f:
    json.dump(doc, f, indent=2, ensure_ascii=False)
    f.write("\n")
counts = {}
for e in result.values():
    counts[e["step_free"]] = counts.get(e["step_free"], 0) + 1
print(f"Wrote {len(result)} stations to {out}: {counts}")
PY
