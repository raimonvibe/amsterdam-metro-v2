import { Departure, Line, ShapeGeom, Station, Status, Train } from "./types";

/** Empty in local dev → relative /api/... (Vite proxy). Set on Render build. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function request(path: string): Promise<Response> {
  const res = await fetch(`${API_BASE}/api${path}`);
  if (!res.ok) throw new Error(`GET /api${path} -> ${res.status}`);
  return res;
}

async function get<T>(path: string): Promise<T> {
  return (await request(path)).json();
}

export const fetchLines = () => get<Line[]>("/lines");
export const fetchStations = () => get<Station[]>("/stations");
export const fetchShapes = () => get<Record<string, ShapeGeom>>("/shapes");
export const fetchStatus = () => get<Status>("/status");
export const fetchDepartures = (station: string) =>
  get<Departure[]>(`/departures?station=${encodeURIComponent(station)}`);

/**
 * Trains plus the client-clock moment their positions describe. The server
 * shares one snapshot (re-solved every second) between all viewers and says
 * how old it is; rewinding by that age keeps dead reckoning from starting
 * up to a second behind.
 */
export async function fetchTrains(): Promise<{ trains: Train[]; asOf: number }> {
  const res = await request("/trains");
  const ageMs = Number(res.headers.get("X-Snapshot-Age-Ms")) || 0;
  const asOf = Date.now() - ageMs;
  return { trains: await res.json(), asOf };
}
