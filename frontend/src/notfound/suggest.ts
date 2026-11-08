/**
 * The 404 page's logic, kept free of the DOM so it can be tested: what the
 * address asks for, which stations it probably means, where to forward it.
 * Every link it returns is built from the page's own station list, never
 * from the typed address (CodeQL js/xss-through-dom).
 */

export type Lang = "nl" | "en";

export interface StationData {
  slug: string;
  name: string;
  lines: string[];
}

/** Station data embedded in the 404 page by notFound.ts. */
export interface PageData {
  stations: StationData[];
  /** Nickname → station slugs ("amstel" lists three). */
  nicknames: Record<string, string[]>;
}

export const REPO_ISSUES = "https://github.com/raimonvibe/amsterdam-metro-v2/issues/new";

export const langOfPath = (path: string): Lang => (path === "/en" || path.startsWith("/en/") ? "en" : "nl");

/** Own keys only: "/constructor" must not find Object's constructor. */
const has = (obj: object, key: string) => Object.prototype.hasOwnProperty.call(obj, key);

/** Free text in slug form: "Station Zuid-WTC" → "zuid-wtc". */
export function toSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^station[-\s]+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The last part of the address in slug form, and whether the address has
 *  the shape of a station page (/reisinfo/x, /en/reisinfo/x). */
export function readPath(path: string): { lang: Lang; wanted: string; stationShaped: boolean } {
  const lang = langOfPath(path);
  const parts = path.split("/").filter(Boolean);
  let last = parts[parts.length - 1] ?? "";
  try {
    last = decodeURIComponent(last);
  } catch {
    /* keep it encoded */
  }
  const wanted = toSlug(last);
  const stationShaped = parts.length === (lang === "en" ? 3 : 2) && parts[parts.length - 2] === "reisinfo";
  return { lang, wanted: wanted === "en" || wanted === "reisinfo" ? "" : wanted, stationShaped };
}

/** Edit distance, for typos. */
export function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let k = 1; k <= b.length; k++) {
      cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a[i - 1] === b[k - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Stations a slug-form word probably means, closest first, at most `max`. */
export function suggest(wanted: string, data: PageData, max = 3): StationData[] {
  if (!wanted) return [];
  const bySlug = new Map(data.stations.map((s) => [s.slug, s]));
  const pick = (slugs: string[]) => slugs.map((s) => bySlug.get(s)).filter((s): s is StationData => !!s);
  if (has(data.nicknames, wanted)) return pick(data.nicknames[wanted]);
  if (bySlug.has(wanted)) return pick([wanted]);
  const flat = wanted.replace(/-/g, "");
  const found = data.stations
    .map((st) => {
      const slug = st.slug.replace(/-/g, "");
      return { st, d: slug.includes(flat) || flat.includes(slug) ? 0 : distance(flat, slug) };
    })
    .filter((x) => x.d <= Math.max(2, Math.floor(flat.length / 3)))
    .sort((a, b) => a.d - b.d || a.st.name.localeCompare(b.st.name, "nl"))
    .slice(0, max)
    .map((x) => x.st);
  if (found.length || !wanted.includes("-")) return found;
  // Nothing for the whole word: try its parts ("arena-x" → "arena").
  const parts = wanted.split("-").filter((p) => p.length >= 3);
  return [...new Set(parts.flatMap((p) => suggest(p, data, max)))].slice(0, max);
}

/** A station page's address in one language: "/reisinfo/zuid/". */
export const stationHref = (st: StationData, lang: Lang) =>
  `${lang === "en" ? "/en/reisinfo/" : "/reisinfo/"}${encodeURIComponent(st.slug)}/`;

/**
 * Where to send a station-shaped address that clearly means one station:
 * the missing slash (/reisinfo/zuid), another spelling (/reisinfo/Zuid) or
 * an unambiguous nickname (/reisinfo/cs). Null otherwise.
 */
export function forwardTarget(path: string, search: string, data: PageData): string | null {
  const { lang, wanted, stationShaped } = readPath(path);
  if (!stationShaped || !wanted) return null;
  const exact = data.stations.find((s) => s.slug === wanted);
  const nick = has(data.nicknames, wanted) ? data.nicknames[wanted] : [];
  const target = exact ?? (nick.length === 1 ? data.stations.find((s) => s.slug === nick[0]) : undefined);
  if (!target) return null;
  // Only the travel page's own parameters come along, re-encoded: nothing
  // else from the address reaches the redirect.
  const kept = new URLSearchParams();
  const given = new URLSearchParams(search);
  for (const key of ["van", "naar", "lijn"]) {
    const value = given.get(key);
    if (value && value.length <= 60) kept.set(key, value);
  }
  const query = kept.toString();
  return stationHref(target, lang) + (query ? `?${query}` : "");
}

/** The search box: stations whose name contains the words, then typos. */
export function searchStations(query: string, data: PageData, max = 5): StationData[] {
  const q = toSlug(query);
  if (!q) return [];
  const flat = q.replace(/-/g, "");
  const contains = data.stations.filter((s) => toSlug(s.name).replace(/-/g, "").includes(flat) || s.slug.includes(q));
  const rest = suggest(q, data, max).filter((s) => !contains.includes(s));
  return [...contains, ...rest].slice(0, max);
}

/**
 * A prefilled GitHub issue for a broken link: the path only (no query, no
 * referrer), so nothing personal leaves the page by accident.
 */
export function issueUrl(path: string, lang: Lang): string {
  const shown = path.length > 200 ? `${path.slice(0, 200)}…` : path;
  const title = lang === "en" ? `Broken link: ${shown}` : `Kapotte link: ${shown}`;
  const body =
    lang === "en"
      ? `This address gave a 404 page:\n\n${shown}\n\nWhere did you find the link? (optional)\n`
      : `Dit adres gaf een 404-pagina:\n\n${shown}\n\nWaar vond je de link? (optioneel)\n`;
  return `${REPO_ISSUES}?${new URLSearchParams({ title, body, labels: "404" }).toString()}`;
}

/** Stations the visitor saved or opened on this site before, by slug,
 *  favourites first. Read only; the 404 page stores nothing. */
export function knownStations(favourites: unknown, recent: unknown, data: PageData, slugOf: (gtfsName: string) => string, max = 4): StationData[] {
  const names = [...(Array.isArray(favourites) ? favourites : []), ...(Array.isArray(recent) ? recent : [])].filter(
    (n): n is string => typeof n === "string",
  );
  const out: StationData[] = [];
  for (const n of names) {
    const st = data.stations.find((s) => s.slug === slugOf(n));
    if (st && !out.includes(st)) out.push(st);
    if (out.length === max) break;
  }
  return out;
}
