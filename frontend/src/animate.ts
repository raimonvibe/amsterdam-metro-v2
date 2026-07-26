import { AnimatedTrain, ShapeGeom } from "./types";

const EARTH_R_M = 6371000;

/** Right-hand unit normal of a tangent (east, north) in metres. */
function rightNormal(east: number, north: number): [number, number] {
  const len = Math.hypot(east, north) || 1;
  return [north / len, -east / len];
}

/** Flip a normal into the western half-plane (initial lane pick only). */
function preferWest([rx, ry]: [number, number]): [number, number] {
  if (rx > 0 || (rx === 0 && ry > 0)) return [-rx, -ry];
  return [rx, ry];
}

function applyOffsetM(
  lon: number,
  lat: number,
  rx: number,
  ry: number,
  offsetM: number,
): [number, number] {
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return [
    lon + ((rx * offsetM) / (EARTH_R_M * cosLat)) * (180 / Math.PI),
    lat + ((ry * offsetM) / EARTH_R_M) * (180 / Math.PI),
  ];
}

/** Walk along `path` from `i` until ~`targetM` of chord length is covered. */
function indexAtDistance(
  path: [number, number][],
  i: number,
  dir: -1 | 1,
  targetM: number,
): number {
  let traveled = 0;
  let j = i;
  while (j + dir >= 0 && j + dir < path.length && traveled < targetM) {
    const a = path[j];
    const b = path[j + dir];
    const cosLat = Math.cos((a[1] * Math.PI) / 180);
    const east = ((b[0] - a[0]) * Math.PI) / 180 * cosLat * EARTH_R_M;
    const north = ((b[1] - a[1]) * Math.PI) / 180 * EARTH_R_M;
    traveled += Math.hypot(east, north);
    j += dir;
  }
  return j;
}

/**
 * Tangent at vertex `i`, sampled over a metres window so GTFS vertex jitter
 * (sub-metre backtracks) does not reverse the normal and spike the parallel.
 */
function tangentAt(
  path: [number, number][],
  i: number,
  windowM = 40,
): { east: number; north: number; lon: number; lat: number } {
  const prev = path[indexAtDistance(path, i, -1, windowM / 2)];
  const next = path[indexAtDistance(path, i, 1, windowM / 2)];
  const [lon, lat] = path[i];
  const cosLat = Math.cos((lat * Math.PI) / 180);
  return {
    lon,
    lat,
    east: ((next[0] - prev[0]) * Math.PI) / 180 * cosLat * EARTH_R_M,
    north: ((next[1] - prev[1]) * Math.PI) / 180 * EARTH_R_M,
  };
}

/**
 * Shift a lon/lat point sideways by `offsetM` metres using bearing
 * (0° = north, clockwise). Prefer the continuous path offset when a polyline
 * is available — this is a fallback for single points.
 */
export function offsetLonLatMeters(
  lon: number,
  lat: number,
  bearingDeg: number,
  offsetM: number,
): [number, number] {
  if (!offsetM) return [lon, lat];
  const br = (bearingDeg * Math.PI) / 180;
  const [rx, ry] = preferWest(rightNormal(Math.sin(br), Math.cos(br)));
  return applyOffsetM(lon, lat, rx, ry, offsetM);
}

/**
 * Shift a lon/lat polyline sideways by `offsetM` metres.
 *
 * Lane side is chosen once (west-positive for +offsetM on the first usable
 * tangent), then the normal is kept continuous along the path. Per-vertex
 * west-bias was wrong: on E–W corridors the preferred half-plane flips every
 * time the tangent wobbles, which drew the sawtooth zig-zags at Isolatorweg,
 * Gein, Zuid, etc. Continuity + windowed tangents keep one smooth parallel;
 * inbound/outbound still share a lane because each starts with the same
 * west-positive pick.
 */
export function offsetPathMeters(
  path: [number, number][],
  offsetM: number,
): [number, number][] {
  if (!offsetM || path.length < 2) return path;
  const out: [number, number][] = new Array(path.length);
  let prevN: [number, number] | null = null;

  for (let i = 0; i < path.length; i++) {
    const { lon, lat, east, north } = tangentAt(path, i);
    const len = Math.hypot(east, north);
    let n: [number, number];
    if (len < 1e-3) {
      n = prevN ?? [0, 0];
    } else {
      n = rightNormal(east, north);
      if (!prevN) {
        n = preferWest(n);
      } else if (n[0] * prevN[0] + n[1] * prevN[1] < 0) {
        n = [-n[0], -n[1]];
      }
      prevN = n;
    }
    out[i] =
      n[0] === 0 && n[1] === 0
        ? [lon, lat]
        : applyOffsetM(lon, lat, n[0], n[1], offsetM);
  }
  return out;
}

/**
 * Copy the lateral displacement of a reference raw→offset pair onto `path`.
 *
 * Deduped track runs and individual trip shapes must share one lane. Offsetting
 * each polyline on its own re-picks west-bias at the fragment start, so a train
 * on a full shape can sit a lane away from the painted rail (e.g. yellow at
 * Duivendrecht). Nearest-point transfer keeps every path on the line's
 * canonical offset (usually the longest shape).
 */
export function offsetPathLikeReference(
  path: [number, number][],
  refRaw: [number, number][],
  refOffset: [number, number][],
): [number, number][] {
  if (path.length === 0 || refRaw.length === 0 || refRaw.length !== refOffset.length) {
    return path;
  }
  return path.map(([lon, lat]) => {
    let bestI = 0;
    let bestD = Infinity;
    for (let i = 0; i < refRaw.length; i++) {
      const dx = refRaw[i][0] - lon;
      const dy = refRaw[i][1] - lat;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        bestI = i;
      }
    }
    return [
      lon + (refOffset[bestI][0] - refRaw[bestI][0]),
      lat + (refOffset[bestI][1] - refRaw[bestI][1]),
    ];
  });
}

/** Position (lon, lat, bearing) at distance d along a shape polyline. */
export function pointAt(shape: ShapeGeom, d: number): [number, number, number] {
  const { coords, cum } = shape;
  const n = cum.length;
  if (n < 2) return [coords[0]?.[0] ?? 0, coords[0]?.[1] ?? 0, 0];
  let i: number;
  if (d <= 0) i = 1;
  else if (d >= cum[n - 1]) i = n - 1;
  else {
    // binary search: first index with cum[i] >= d
    let lo = 1, hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < d) lo = mid + 1;
      else hi = mid;
    }
    i = lo;
  }
  const a = coords[i - 1];
  const b = coords[i];
  const seg = cum[i] - cum[i - 1];
  const t = seg <= 0 ? 0 : Math.min(Math.max((d - cum[i - 1]) / seg, 0), 1);
  const lon = a[0] + (b[0] - a[0]) * t;
  const lat = a[1] + (b[1] - a[1]) * t;
  const bearing =
    (Math.atan2(
      (b[0] - a[0]) * Math.cos((lat * Math.PI) / 180),
      b[1] - a[1],
    ) *
      180) /
      Math.PI || 0;
  return [lon, lat, (bearing + 360) % 360];
}

/**
 * Dead-reckon the train's current distance along its shape: advance from the
 * backend-computed distance at segment speed, capped so it never overshoots
 * the next station before fresh data arrives.
 */
export function currentDistance(train: AnimatedTrain, nowMs: number): number {
  let d = train.distance_m;
  if (train.status === "moving" && train.speed_m_s > 0) {
    let dt = (nowMs - train.fetchedAt) / 1000;
    if (train.next_arrival_ts) {
      const untilArrival = train.next_arrival_ts - train.fetchedAt / 1000;
      dt = Math.min(dt, Math.max(untilArrival, 0));
    }
    d += train.speed_m_s * dt;
  }
  return d;
}

/**
 * Sub-polyline between distances d0..d1 along a shape — used to draw trains
 * as pill-shaped segments that bend with the track. Includes interpolated
 * endpoints plus any shape vertices in between.
 */
export function pathBetween(
  shape: ShapeGeom,
  d0: number,
  d1: number,
): [number, number][] {
  const { coords, cum } = shape;
  const n = cum.length;
  if (n < 2) return coords.slice(0, 1) as [number, number][];
  const lo = Math.max(Math.min(d0, d1), 0);
  const hi = Math.min(Math.max(d0, d1), cum[n - 1]);
  const [x0, y0] = pointAt(shape, lo);
  const [x1, y1] = pointAt(shape, hi);
  const path: [number, number][] = [[x0, y0]];
  for (let i = 0; i < n; i++) {
    if (cum[i] > lo && cum[i] < hi) path.push(coords[i]);
  }
  path.push([x1, y1]);
  return path;
}
