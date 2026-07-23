#!/usr/bin/env bash
# Refresh frontend/src/data/churches.json from OpenStreetMap (Overpass API).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/src/data/churches.json"
QUERY='[out:json][timeout:90];(node["building"="church"](52.28,4.72,52.46,5.08);way["building"="church"](52.28,4.72,52.46,5.08);node["amenity"="place_of_worship"](52.28,4.72,52.46,5.08);way["amenity"="place_of_worship"](52.28,4.72,52.46,5.08););out center;'

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

curl -fsSL --max-time 120 \
  -H 'User-Agent: amsterdam-metro-v2/1.0 (fetch-churches)' \
  'https://overpass.kumi.systems/api/interpreter' \
  --data-urlencode "data=$QUERY" \
  -o "$tmp"

python3 - "$tmp" "$OUT" <<'PY'
import json, sys

raw = json.load(open(sys.argv[1]))
out = sys.argv[2]
churches = []
seen = set()
non_christian = {
    "muslim", "jewish", "buddhist", "hindu", "sikh", "taoist",
    "shinto", "multifaith", "bahai", "unitarian_universalist",
}

for el in raw.get("elements", []):
    tags = el.get("tags", {})
    if tags.get("religion", "").lower() in non_christian:
        continue
    lat = el.get("lat") or el.get("center", {}).get("lat")
    lon = el.get("lon") or el.get("center", {}).get("lon")
    if lat is None or lon is None:
        continue
    key = (round(lat, 6), round(lon, 6))
    if key in seen:
        continue
    seen.add(key)
    churches.append({"latitude": lat, "longitude": lon})

churches.sort(key=lambda c: (c["latitude"], c["longitude"]))
with open(out, "w") as f:
    json.dump(churches, f, separators=(",", ":"))
    f.write("\n")
print(f"Wrote {len(churches)} churches to {out}")
PY
