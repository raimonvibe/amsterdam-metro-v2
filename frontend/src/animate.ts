import { AnimatedTrain, ShapeGeom } from "./types";

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
 * Dead-reckon a train's current position: advance from the backend-computed
 * distance along its track shape at its segment speed, capped so it never
 * overshoots the next station before fresh data arrives.
 */
export function currentPosition(
  train: AnimatedTrain,
  shapes: Record<string, ShapeGeom>,
  nowMs: number,
): [number, number, number] {
  const shape = shapes[train.shape_id];
  if (!shape) return [train.longitude, train.latitude, train.bearing];
  let d = train.distance_m;
  if (train.status === "moving" && train.speed_m_s > 0) {
    let dt = (nowMs - train.fetchedAt) / 1000;
    if (train.next_arrival_ts) {
      const untilArrival = train.next_arrival_ts - train.fetchedAt / 1000;
      dt = Math.min(dt, Math.max(untilArrival, 0));
    }
    d += train.speed_m_s * dt;
  }
  return pointAt(shape, d);
}
