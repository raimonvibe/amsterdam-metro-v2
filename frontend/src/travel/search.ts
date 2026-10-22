import { formatPlaceName } from "../format";
import { Station } from "../types";

/**
 * Smart station search for the travel-info page. Pure functions, no I/O, so
 * every rule here is unit-tested. Understands:
 *  - names with or without "Amsterdam, ", accents, "Burg." etc.
 *  - landmarks and nicknames ("arena", "amc", "dam", "zuidas")
 *  - typos (one or two letters off, swapped letters included)
 *  - initials ("hs" → Henk Sneevlietweg)
 *  - lines ("52", "M52", "lijn 52", "noord-zuidlijn")
 *  - whole trips ("noord naar gein", "cs → zuid", "van rokin tot rai")
 *  - "dichtbij" for the nearest station
 */

export type SearchResult =
  | { kind: "station"; station: Station; score: number; via?: string }
  | { kind: "line"; line: string; score: number }
  | { kind: "route"; from: Station; to: Station; score: number }
  | { kind: "nearby"; score: number };

/** Landmarks and everyday names, keyed by GTFS station name. */
export const STATION_ALIASES: Record<string, string[]> = {
  "Amsterdam, Centraal Station": ["cs", "centraal", "amsterdam centraal", "central station", "central", "ac"],
  "Amsterdam, Station Zuid": ["zuid", "zuidas", "wtc", "world trade center", "amsterdam zuid"],
  "Amsterdam, Station Bijlmer ArenA": ["arena", "johan cruijff arena", "ziggo dome", "afas live", "bijlmer", "amsterdamse poort"],
  "Amsterdam, Station Holendrecht": ["amc", "ziekenhuis amc", "academisch medisch centrum"],
  "Amsterdam, Station RAI": ["rai", "rai amsterdam", "congrescentrum"],
  "Amsterdam, Amstelstation": ["amstel", "station amstel"],
  "Amsterdam, Station Sloterdijk": ["sloterdijk"],
  "Amsterdam, Station Lelylaan": ["lelylaan"],
  "Amsterdam, Burg. De Vlugtlaan": ["vlugtlaan", "de vlugtlaan"],
  "Amsterdam, De Pijp": ["albert cuyp", "albert cuypmarkt", "pijp", "heineken experience"],
  "Amsterdam, Rokin": ["dam", "kalverstraat", "spui", "begijnhof"],
  "Amsterdam, Vijzelgracht": ["vijzel", "rijksmuseum", "museumplein", "weteringcircuit"],
  "Amsterdam, Waterlooplein": ["waterloo", "stopera", "nationale opera", "rembrandthuis"],
  "Amsterdam, Nieuwmarkt": ["de waag", "zeedijk", "chinatown"],
  "Amsterdam, Weesperplein": ["weesper", "carre"],
  "Amsterdam, Wibautstraat": ["wibaut", "oosterpark"],
  "Amsterdam, Noord": ["buikslotermeerplein", "boven t ij"],
  "Amsterdam, Noorderpark": ["noorderpark"],
  "Amsterdam, Europaplein": ["europaplein"],
  "Amsterdam, Gaasperplas": ["gaasperpark"],
  "Amsterdam, Henk Sneevlietweg": ["sneevliet"],
  "Amsterdam, Jan van Galenstraat": ["van galen"],
  "Amsterdam, Van der Madeweg": ["madeweg"],
  "Amsterdam, Spaklerweg": ["spakler"],
  "Diemen, Station Diemen Zuid": ["diemen zuid", "diemen"],
  "Duivendrecht, Station Duivendrecht": ["duivendrecht"],
};

/** Names people use for lines. */
const LINE_WORDS: Record<string, string[]> = {
  "50": ["ringlijn"],
  "51": ["amstelveenlijn"],
  "52": ["noord zuidlijn", "noordzuidlijn", "nzl"],
  "53": ["oostlijn", "gaasperplaslijn"],
  "54": ["oostlijn", "geinlijn"],
};

const NEARBY_WORDS = new Set(["dichtbij", "in de buurt", "bij mij", "hier", "locatie", "mijn locatie", "nearby"]);

/** Lowercase, accents off, "Burg." spelled out, punctuation to spaces. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\bburg\b\.?\s*/g, "burgemeester ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Restricted Damerau-Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (const c of s) if (c === q[i]) i++;
  return i === q.length;
}

/** How well a normalized query matches one normalized name, 0-100. */
export function matchScore(q: string, key: string): number {
  if (!q || !key) return 0;
  if (key === q) return 100;
  if (key.startsWith(q)) return 92 - Math.min(8, (key.length - q.length) / 4);
  const words = key.split(" ");
  if (words.some((w) => w.startsWith(q))) return 82;
  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length > 1 && tokens.every((t) => words.some((w) => w.startsWith(t)))) return 78;
  if (key.includes(q)) return 72;
  if (!q.includes(" ") && q.length >= 2 && words.length >= 2) {
    const initials = words.map((w) => w[0]).join("");
    if (initials.startsWith(q)) return 66;
  }
  if (q.length >= 4) {
    const allowed = q.length >= 7 ? 2 : 1;
    const candidates = [...words, key.slice(0, q.length), key];
    const best = Math.min(...candidates.map((w) => editDistance(q, w)));
    if (best <= allowed) return 60 - 12 * best;
  }
  if (q.length >= 3 && !q.includes(" ") && isSubsequence(q, key.replace(/ /g, ""))) {
    return 35 + Math.round((15 * q.length) / key.length);
  }
  return 0;
}

interface Indexed {
  station: Station;
  keys: { key: string; alias?: string }[];
}

const indexCache = new WeakMap<Station[], Indexed[]>();

function index(stations: Station[]): Indexed[] {
  let idx = indexCache.get(stations);
  if (!idx) {
    idx = stations.map((station) => {
      const display = formatPlaceName(station.name);
      const keys = new Map<string, string | undefined>();
      for (const k of [display, station.name, station.name.replace(/^[^,]+, /, "").replace(/^Station /, "")]) {
        keys.set(normalize(k), undefined);
      }
      for (const alias of STATION_ALIASES[station.name] ?? []) {
        const n = normalize(alias);
        if (!keys.has(n)) keys.set(n, alias);
      }
      return { station, keys: [...keys].map(([key, alias]) => ({ key, alias })) };
    });
    indexCache.set(stations, idx);
  }
  return idx;
}

/** Stations ranked for a query; ties go to busier (more lines) stations. */
export function searchStations(query: string, stations: Station[], limit = 8): Extract<SearchResult, { kind: "station" }>[] {
  const q = normalize(query);
  if (!q) return [];
  const out: Extract<SearchResult, { kind: "station" }>[] = [];
  for (const { station, keys } of index(stations)) {
    let best = 0;
    let via: string | undefined;
    for (const { key, alias } of keys) {
      // A landmark match ranks just below the same match on the real name.
      const s = matchScore(q, key) - (alias ? 3 : 0);
      if (s > best) {
        best = s;
        via = alias;
      }
    }
    if (best > 0) out.push({ kind: "station", station, score: best, via });
  }
  out.sort(
    (a, b) =>
      b.score - a.score ||
      b.station.lines.length - a.station.lines.length ||
      formatPlaceName(a.station.name).localeCompare(formatPlaceName(b.station.name), "nl"),
  );
  return out.slice(0, limit);
}

/** The single best station for a phrase, if it is a confident match. */
export function bestStation(phrase: string, stations: Station[], minScore = 58): Station | null {
  const [top] = searchStations(phrase, stations, 1);
  return top && top.score >= minScore ? top.station : null;
}

const ROUTE_RE = /^\s*(?:van\s+)?(.+?)(?:\s+naar\s+|\s*(?:->|→|=>|>)\s*|\s+-\s+|\s+tot\s+)(.+?)\s*$/i;

/** "noord naar gein" → both stations, when both halves resolve confidently. */
export function parseRoute(query: string, stations: Station[]): { from: Station; to: Station } | null {
  const m = ROUTE_RE.exec(query);
  if (!m) return null;
  const from = bestStation(m[1], stations);
  const to = bestStation(m[2], stations);
  return from && to && from.name !== to.name ? { from, to } : null;
}

/** Line ids a query refers to ("52", "m52", "lijn 52", "oostlijn"). */
export function parseLines(query: string, lineIds: string[]): string[] {
  const q = normalize(query);
  const m = /^(?:m|lijn|metro|metrolijn)?\s*(\d{2})$/.exec(q);
  if (m && lineIds.includes(m[1])) return [m[1]];
  return lineIds.filter((id) => (LINE_WORDS[id] ?? []).some((w) => w === q || (q.length >= 4 && w.startsWith(q))));
}

/** Everything the search box shows for a query, best first. */
export function search(query: string, stations: Station[], lineIds: string[], limit = 8): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];
  const results: SearchResult[] = [];
  if (NEARBY_WORDS.has(q)) results.push({ kind: "nearby", score: 300 });
  const route = parseRoute(query, stations);
  if (route) results.push({ kind: "route", ...route, score: 200 });
  for (const line of parseLines(query, lineIds)) results.push({ kind: "line", line, score: 150 });
  results.push(...searchStations(query, stations, limit));
  return results.slice(0, limit);
}

/** Great-circle distance in metres. */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

/** Stations ordered by distance from a point, with the distance. */
export function nearestStations(lat: number, lon: number, stations: Station[], limit = 3) {
  return stations
    .map((station) => ({ station, meters: distanceM(lat, lon, station.latitude, station.longitude) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, limit);
}
