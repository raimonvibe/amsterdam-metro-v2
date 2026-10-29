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
  /** What to type in the search box on GVB's lift-fault page to find this
   *  station: GVB's spelling, and short enough to match ("Diemen Zuid", not
   *  "Station Diemen Zuid", which finds nothing). */
  gvb_search: string;
  /** GVB's lift faults listed a lift here at the last lift check. Only on
   *  stations whose GVB page says step-free; the lift is why they are "no". */
  lift_out?: boolean;
}

const STATIONS = accessibility.stations as Record<string, StationAccess>;

/** The day GVB's lift faults were last checked by hand (YYYY-MM-DD). */
export const LIFT_CHECK: string = accessibility.lift_check;

/** A lift check older than this (a missed weekly check) is not shown: the
 *  card falls back to the plain state and the link to GVB. */
export const LIFT_CHECK_MAX_DAYS = 10;

/** Step-free access at a station, by its grouped name ("Amsterdam, Rokin").
 *  A station missing from the file (renamed, or new) is not step-free. */
export function stepFree(station: string): StepFree {
  return STATIONS[station]?.step_free ?? "no";
}

/** GVB's own list of lift and escalator faults: live, but only in a browser.
 *  It cannot be linked pre-filtered (its search never reaches the URL), and
 *  GVB's station pages miss some faults, so riders search it themselves. */
export const GVB_LIFT_FAULTS = "https://www.gvb.nl/reisinformatie/lift-roltrappen";

/** What to search for on GVB's lift-fault page. A station missing from the
 *  file gets its name without city and "Station ", the likeliest match. */
export function gvbSearch(station: string): string {
  return STATIONS[station]?.gvb_search ?? station.replace(/^[^,]+, /, "").replace(/^Station /, "");
}

/** The date of the lift check that found this station's lift out of service,
 *  or null: no fault known, or the check is too old to show. Never a claim
 *  that a lift works, only that one was seen broken. */
export function liftOutSince(station: string, nowMs = Date.now()): string | null {
  if (!STATIONS[station]?.lift_out) return null;
  const age = (nowMs - Date.parse(`${LIFT_CHECK}T00:00:00Z`)) / 86_400_000;
  return age <= LIFT_CHECK_MAX_DAYS ? LIFT_CHECK : null;
}

/** "29 okt" / "29 Oct" for a YYYY-MM-DD date. */
export function shortDate(iso: string, lang: "nl" | "en"): string {
  return new Intl.DateTimeFormat(lang === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${iso}T00:00:00Z`))
    .replace(".", "");
}
