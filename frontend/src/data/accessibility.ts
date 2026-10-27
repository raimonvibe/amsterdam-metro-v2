import accessibility from "./accessibility.json";

// The rule, the sources and the regular checks of this data:
// docs/step-free-stations.md. Read it before editing accessibility.json.

/** Whether a metro station is step-free. Only a station checked on GVB's
 *  station page can be "yes"; anything not confirmed is "no", since telling
 *  a rider "step-free" and being wrong is worse than the other way round. */
export type StepFree = "yes" | "limited" | "no" | "unknown";

export interface StationAccess {
  step_free: StepFree;
  /** "checked": verified on GVB's station page, and kept when the seed script
   *  runs again; "osm": seeded by scripts/seed-accessibility.sh, not yet
   *  checked, so "no". */
  source: "osm" | "checked";
  /** The nearest OSM station element, e.g. "node/4053335995". */
  osm?: string;
  /** What OSM says, as a hint for whoever checks the station next. */
  osm_wheelchair?: StepFree;
  /** For checked stations: where and when, and anything a rider should know. */
  note?: string;
}

const STATIONS = accessibility.stations as Record<string, StationAccess>;

/** Step-free access at a station, by its grouped name ("Amsterdam, Rokin").
 *  A station missing from the file (renamed, or new) is not step-free. */
export function stepFree(station: string): StepFree {
  return STATIONS[station]?.step_free ?? "no";
}

/** GVB's own list of lift and escalator faults: live, but only in a browser. */
export const GVB_LIFT_FAULTS = "https://www.gvb.nl/reisinformatie/lift-roltrappen";
