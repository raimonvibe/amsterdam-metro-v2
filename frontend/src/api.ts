import { Line, ShapeGeom, Station, Status, Train } from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`);
  if (!res.ok) throw new Error(`GET /api${path} -> ${res.status}`);
  return res.json();
}

export const fetchLines = () => get<Line[]>("/lines");
export const fetchStations = () => get<Station[]>("/stations");
export const fetchTrains = () => get<Train[]>("/trains");
export const fetchShapes = () => get<Record<string, ShapeGeom>>("/shapes");
export const fetchStatus = () => get<Status>("/status");
