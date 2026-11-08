import accessibility from "./accessibility.json";
import { type StationAccess, liftOutSince, stepFree } from "./accessibility";

/**
 * The metro network as it is fixed between timetable changes: lines, their
 * stations in running order, and each station's page address. Used where the
 * live API is not available: the build (station pages, sitemap, crawlable
 * text) and the 404 page. The app's live data comes from the API as before.
 *
 * From the GTFS timetable (backend/data/cache/gvb_metro.json, Nov 2026).
 * StationPages.test.ts checks these names against accessibility.json, which
 * lists every metro station.
 */
export const METRO_LINES: readonly { line: string; stations: readonly string[] }[] = [
  {
    line: "50",
    stations: [
      "Amsterdam, Isolatorweg", "Amsterdam, Station Sloterdijk", "Amsterdam, Burg. De Vlugtlaan", "Amsterdam, Jan van Galenstraat",
      "Amsterdam, Postjesweg", "Amsterdam, Station Lelylaan", "Amsterdam, Heemstedestraat", "Amsterdam, Henk Sneevlietweg",
      "Amsterdam, Amstelveenseweg", "Amsterdam, Station Zuid", "Amsterdam, Station RAI", "Amsterdam, Overamstel",
      "Amsterdam, Van der Madeweg", "Duivendrecht, Station Duivendrecht", "Amsterdam, Strandvliet", "Amsterdam, Station Bijlmer ArenA",
      "Amsterdam, Bullewijk", "Amsterdam, Station Holendrecht", "Amsterdam, Reigersbos", "Amsterdam, Gein",
    ],
  },
  {
    line: "51",
    stations: [
      "Amsterdam, Centraal Station", "Amsterdam, Nieuwmarkt", "Amsterdam, Waterlooplein", "Amsterdam, Weesperplein",
      "Amsterdam, Wibautstraat", "Amsterdam, Amstelstation", "Amsterdam, Spaklerweg", "Amsterdam, Overamstel",
      "Amsterdam, Station RAI", "Amsterdam, Station Zuid", "Amsterdam, Amstelveenseweg", "Amsterdam, Henk Sneevlietweg",
      "Amsterdam, Heemstedestraat", "Amsterdam, Station Lelylaan", "Amsterdam, Postjesweg", "Amsterdam, Jan van Galenstraat",
      "Amsterdam, Burg. De Vlugtlaan", "Amsterdam, Station Sloterdijk", "Amsterdam, Isolatorweg",
    ],
  },
  {
    line: "52",
    stations: [
      "Amsterdam, Noord", "Amsterdam, Noorderpark", "Amsterdam, Centraal Station", "Amsterdam, Rokin",
      "Amsterdam, Vijzelgracht", "Amsterdam, De Pijp", "Amsterdam, Europaplein", "Amsterdam, Station Zuid",
    ],
  },
  {
    line: "53",
    stations: [
      "Amsterdam, Centraal Station", "Amsterdam, Nieuwmarkt", "Amsterdam, Waterlooplein", "Amsterdam, Weesperplein",
      "Amsterdam, Wibautstraat", "Amsterdam, Amstelstation", "Amsterdam, Spaklerweg", "Amsterdam, Van der Madeweg",
      "Amsterdam, Venserpolder", "Diemen, Station Diemen Zuid", "Diemen, Verrijn Stuartweg", "Amsterdam, Ganzenhoef",
      "Amsterdam, Kraaiennest", "Amsterdam, Gaasperplas",
    ],
  },
  {
    line: "54",
    stations: [
      "Amsterdam, Centraal Station", "Amsterdam, Nieuwmarkt", "Amsterdam, Waterlooplein", "Amsterdam, Weesperplein",
      "Amsterdam, Wibautstraat", "Amsterdam, Amstelstation", "Amsterdam, Spaklerweg", "Amsterdam, Van der Madeweg",
      "Duivendrecht, Station Duivendrecht", "Amsterdam, Strandvliet", "Amsterdam, Station Bijlmer ArenA", "Amsterdam, Bullewijk",
      "Amsterdam, Station Holendrecht", "Amsterdam, Reigersbos", "Amsterdam, Gein",
    ],
  },
];

const ACCESS = accessibility.stations as Record<string, StationAccess>;

/** Every metro station by its GTFS name ("Amsterdam, Rokin"), A–Z. */
export const STATION_NAMES: readonly string[] = Object.keys(ACCESS).sort((a, b) =>
  displayName(a).localeCompare(displayName(b), "nl"),
);

/** A station's name without its town: "Rokin", "Station Diemen Zuid". */
export function displayName(name: string): string {
  return name.replace(/^[^,]+, /, "");
}

/**
 * The station's part of its page address: /reisinfo/<slug>. Lower case,
 * dashes, and without a leading "Station ", so the short names people type
 * work: /reisinfo/zuid, /reisinfo/rai, /reisinfo/bijlmer-arena.
 */
export function stationSlug(name: string): string {
  return displayName(name)
    .replace(/^Station /, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const BY_SLUG = new Map(STATION_NAMES.map((n) => [stationSlug(n), n]));

/** The station a slug names, or null. */
export function stationOfSlug(slug: string): string | null {
  return BY_SLUG.get(slug.toLowerCase()) ?? null;
}

/** Lines that stop at a station, in line order. */
export function linesAt(name: string): string[] {
  return METRO_LINES.filter((l) => l.stations.includes(name)).map((l) => l.line);
}

export interface Direction {
  line: string;
  /** The terminus this direction runs to. */
  terminus: string;
  /** The next station that way. */
  next: string;
}

/** Each line's directions from a station; a terminus has one. */
export function directionsFrom(name: string): Direction[] {
  const out: Direction[] = [];
  for (const { line, stations } of METRO_LINES) {
    const i = stations.indexOf(name);
    if (i < 0) continue;
    if (i > 0) out.push({ line, terminus: stations[0], next: stations[i - 1] });
    if (i < stations.length - 1) out.push({ line, terminus: stations[stations.length - 1], next: stations[i + 1] });
  }
  return out;
}

/** GVB's station pages for a station (Centraal has two metro stops). */
export function gvbStopUrls(name: string): string[] {
  return (ACCESS[name]?.gvb_stops ?? []).map((code) => `https://www.gvb.nl/reisinformatie/halte/${code}`);
}

/** What GVB's own station page says, as recorded at the last check: a
 *  station with a lift out is still "Rolstoelvriendelijk" there. */
export function gvbSaysStepFree(name: string): boolean {
  return ACCESS[name]?.source === "checked" && (ACCESS[name].step_free === "yes" || ACCESS[name].lift_out === true);
}

/** The day a station's GVB page was last read, from its note (YYYY-MM-DD). */
export function checkedOn(name: string): string | null {
  const dates = ACCESS[name]?.note?.match(/\d{4}-\d{2}-\d{2}/g);
  return dates ? dates.sort()[dates.length - 1] : null;
}

/**
 * The three states riders see, the same everywhere: step-free; step-free
 * but a lift was seen broken at the last check (and that check is recent);
 * not step-free, which also covers "not confirmed".
 */
export type AccessState = "step-free" | "lift-out" | "not-step-free";

export function accessState(name: string, nowMs = Date.now()): AccessState {
  if (stepFree(name) === "yes") return "step-free";
  return liftOutSince(name, nowMs) ? "lift-out" : "not-step-free";
}

/**
 * The nearest step-free station in each direction of each line, for when a
 * lift is out here: where to get on or off instead. Skips stations that are
 * not step-free themselves. Directions without one are left out.
 */
export function stepFreeAlternatives(name: string, nowMs = Date.now()): (Direction & { station: string })[] {
  const out: (Direction & { station: string })[] = [];
  for (const { line, stations } of METRO_LINES) {
    const i = stations.indexOf(name);
    if (i < 0) continue;
    for (const [step, terminus] of [[-1, stations[0]], [1, stations[stations.length - 1]]] as const) {
      if (stations[i + step] === undefined) continue;
      for (let j = i + step; j >= 0 && j < stations.length; j += step) {
        if (accessState(stations[j], nowMs) === "step-free") {
          out.push({ line, terminus, next: stations[i + step], station: stations[j] });
          break;
        }
      }
    }
  }
  return out;
}

/** Step-free stations reachable without changing trains, per line. */
export function stepFreeReachable(name: string, nowMs = Date.now()): { line: string; stations: string[] }[] {
  return METRO_LINES.filter((l) => l.stations.includes(name)).map(({ line, stations }) => ({
    line,
    stations: stations.filter((s) => s !== name && accessState(s, nowMs) === "step-free"),
  }));
}
