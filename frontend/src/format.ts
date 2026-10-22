import { nl } from "./i18n/nl";

/** Delay as a short label: "op tijd", "+3 min" or "-1 min". */
export function delayLabel(s: number): string {
  if (Math.abs(s) < 30) return nl.onTime;
  const m = Math.round(Math.abs(s) / 60);
  return s > 0 ? `+${m || 1} min` : `-${m || 1} min`;
}

/** Station name for headings: city prefix off, but not abbreviated
 *  ("Centraal Station", where lists say "CS"). */
export function fullPlaceName(name: string): string {
  return name.replace(/^Amsterdam, /, "");
}

/** Strip city prefix and shorten common station names for display. */
export function formatPlaceName(name: string): string {
  const stripped = name.replace(/^Amsterdam, /, "");
  return stripped.replace(/\bCentraal Station\b/g, "CS").replace(/^Centraal$/, "CS");
}
