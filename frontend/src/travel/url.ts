import { formatPlaceName } from "../format";
import { Station } from "../types";
import { bestStation } from "./search";

export interface TravelParams {
  station: string | null;
  from: string | null;
  to: string | null;
  line: string | null;
}

/** A station named in a link: exact GTFS name, display name, or a confident
 *  search match ("cs", "arena"). */
export function resolveStation(param: string | null, stations: Station[]): Station | null {
  if (!param) return null;
  const p = param.trim().toLowerCase();
  return (
    stations.find((s) => s.name.toLowerCase() === p) ??
    stations.find((s) => formatPlaceName(s.name).toLowerCase() === p) ??
    bestStation(param, stations, 75)
  );
}

export function readParams(search: string): TravelParams {
  const q = new URLSearchParams(search);
  return { station: q.get("station"), from: q.get("van"), to: q.get("naar"), line: q.get("lijn") };
}

/** Short, readable query string using display names ("?station=Noord"). */
export function writeParams(p: { station: Station | null; from: Station | null; to: Station | null; line: string | null }): string {
  const q = new URLSearchParams();
  if (p.station) q.set("station", formatPlaceName(p.station.name));
  if (p.from) q.set("van", formatPlaceName(p.from.name));
  if (p.to) q.set("naar", formatPlaceName(p.to.name));
  if (p.line) q.set("lijn", p.line);
  const s = q.toString();
  return s ? `?${s}` : "";
}
