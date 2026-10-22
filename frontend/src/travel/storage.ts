/** Favourites, recent stations and page preferences, kept only in this
 *  browser's localStorage (never sent to the server). Every access is
 *  guarded: storage can be unavailable (private mode, blocked site data). */

const FAVOURITES = "metro-live:favourites";
const RECENT = "metro-live:recent";
const PREFS = "metro-live:travel-prefs";
export const RECENT_MAX = 6;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the feature just doesn't persist */
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

export function loadFavourites(): string[] {
  return stringList(read(FAVOURITES, []));
}

/** Adds or removes a station; returns the new list. */
export function toggleFavourite(name: string): string[] {
  const list = loadFavourites();
  const next = list.includes(name) ? list.filter((n) => n !== name) : [...list, name];
  write(FAVOURITES, next);
  return next;
}

export function loadRecent(): string[] {
  return stringList(read(RECENT, []));
}

/** Moves a station to the front of the recent list; returns the new list. */
export function pushRecent(name: string): string[] {
  const next = [name, ...loadRecent().filter((n) => n !== name)].slice(0, RECENT_MAX);
  write(RECENT, next);
  return next;
}

export function clearRecent(): string[] {
  write(RECENT, []);
  return [];
}

export interface TravelPrefs {
  windowMin: number;
  showCancelled: boolean;
  walkMin: number;
  /** Single-key shortcuts (/, F, P, ?). Switchable off (WCAG 2.1.4): speech
   *  input types letters too, and would otherwise trigger them. */
  shortcuts: boolean;
}

export const DEFAULT_PREFS: TravelPrefs = { windowMin: 30, showCancelled: true, walkMin: 0, shortcuts: true };

export function loadPrefs(): TravelPrefs {
  const p = read<Partial<TravelPrefs>>(PREFS, {});
  return {
    windowMin: [15, 30, 60, 120].includes(p.windowMin as number) ? (p.windowMin as number) : DEFAULT_PREFS.windowMin,
    showCancelled: typeof p.showCancelled === "boolean" ? p.showCancelled : DEFAULT_PREFS.showCancelled,
    walkMin: typeof p.walkMin === "number" && p.walkMin >= 0 && p.walkMin <= 30 ? p.walkMin : DEFAULT_PREFS.walkMin,
    shortcuts: typeof p.shortcuts === "boolean" ? p.shortcuts : DEFAULT_PREFS.shortcuts,
  };
}

export function savePrefs(p: TravelPrefs): void {
  write(PREFS, p);
}
