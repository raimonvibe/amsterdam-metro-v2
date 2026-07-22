import { Departure, Line, ShapeGeom, Station, Status, Train } from "./types";

/** Empty in local dev → relative /api/... (Vite proxy). Set on Render build. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`);
  if (!res.ok) throw new Error(`GET /api${path} -> ${res.status}`);
  return res.json();
}

export const fetchLines = () => get<Line[]>("/lines");
export const fetchStations = () => get<Station[]>("/stations");
export const fetchTrains = () => get<Train[]>("/trains");
export const fetchShapes = () => get<Record<string, ShapeGeom>>("/shapes");
export const fetchStatus = () => get<Status>("/status");
export const fetchDepartures = (station: string) =>
  get<Departure[]>(`/departures?station=${encodeURIComponent(station)}`);
