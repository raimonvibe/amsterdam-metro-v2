import { Departure, Line, ShapeGeom, Station } from "./types";
import { BoardDeparture, Journey, NetworkLine, StationInfo } from "./travel/types";

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

/** Board departures for the travel-info page: a wider window and, on
 *  request, cancelled runs flagged instead of left out. */
export const fetchBoard = (station: string, minutes: number, cancelled: boolean) =>
  get<BoardDeparture[]>(
    `/departures?station=${encodeURIComponent(station)}&limit=60&minutes=${minutes}&cancelled=${cancelled}`,
  );
export const fetchStationInfo = (station: string) =>
  get<StationInfo>(`/station?station=${encodeURIComponent(station)}`);
export const fetchJourneys = (from: string, to: string, limit = 5) =>
  get<Journey[]>(`/journey?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`);
export const fetchNetwork = () => get<NetworkLine[]>("/network");
