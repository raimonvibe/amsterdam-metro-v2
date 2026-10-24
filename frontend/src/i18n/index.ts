import { useSyncExternalStore } from "react";
import { nl } from "./nl";
import { en } from "./en";

/** UI language. Dutch stays the default: the site's audience, its prerendered
 *  pages and its search snippets are Dutch. English is picked from a saved
 *  choice or a browser that does not list Dutch at all. */
export type Lang = "nl" | "en";

type Widen<T> = { [K in keyof T]: T[K] extends (...args: infer A) => string ? (...args: A) => string : string };
/** Every UI string, keyed as in nl.ts; en.ts has to supply the same keys. */
export type Dict = Widen<typeof nl>;

const DICTS: Record<Lang, Dict> = { nl, en };
const STORAGE_KEY = "metro-lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "nl" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  const langs = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language];
  if (!langs.length || langs.some((l) => l?.toLowerCase().startsWith("nl"))) return "nl";
  return "en";
}

let current: Lang = detect();
const listeners = new Set<() => void>();

function apply(lang: Lang) {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
}
apply(current);

export function getLang(): Lang {
  return current;
}

/** Switch language everywhere. `persist: false` leaves the saved choice
 *  alone (tests). */
export function setLang(lang: Lang, { persist = true }: { persist?: boolean } = {}) {
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable: the choice lasts until reload */
    }
  }
  if (lang === current) return;
  current = lang;
  apply(lang);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

/** The strings for the current language; re-renders on a switch. */
export function useT(): Dict {
  return DICTS[useLang()];
}

/** Strings outside a component (formatters). Callers re-run on a switch
 *  because the component calling them re-renders through useT/useLang. */
export function strings(): Dict {
  return DICTS[current];
}

/** BCP 47 locale for Intl formatters. */
export function locale(lang: Lang = current): string {
  return lang === "en" ? "en-GB" : "nl-NL";
}

/** Text the feed gives in both languages; Dutch where English is missing. */
export function pick(text: { nl: string; en?: string | null }, lang: Lang = current): string {
  return (lang === "en" && text.en) || text.nl;
}
