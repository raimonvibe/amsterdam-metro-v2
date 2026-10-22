import { Departure, Line, ShapeGeom, Station } from "./types";

/** Empty in local dev → relative /api/... (Vite proxy). Set on Render build. */
export const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

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
export const fetchDepartures = (station: string) =>
  get<Departure[]>(`/departures?station=${encodeURIComponent(station)}`);
