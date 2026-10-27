import accessibility from "./accessibility.json";

/** OSM's wheelchair tag for a metro station; "unknown" where OSM has none. */
export type StepFree = "yes" | "limited" | "no" | "unknown";

export interface StationAccess {
  step_free: StepFree;
  /** "osm": seeded by scripts/seed-accessibility.sh; "checked": verified by
   *  hand, and kept when the script runs again. */
  source: "osm" | "checked";
  /** The OSM element the value came from, e.g. "node/4053335995". */
  osm?: string;
  /** For checked stations: where and when, and anything a rider should know. */
  note?: string;
}

const STATIONS = accessibility.stations as Record<string, StationAccess>;

/** Step-free access at a station, by its grouped name ("Amsterdam, Rokin"). */
export function stepFree(station: string): StepFree {
  return STATIONS[station]?.step_free ?? "unknown";
}

/** GVB's own list of lift and escalator faults: live, but only in a browser. */
export const GVB_LIFT_FAULTS = "https://www.gvb.nl/reisinformatie/lift-roltrappen";
