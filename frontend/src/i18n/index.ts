import { useSyncExternalStore } from "react";
import { nl } from "./nl";
import { en } from "./en";
import { langOfPath, pageOfPath, pagePath } from "./paths";
import { PSEUDO, pseudoDict } from "./pseudo";

/** UI language. The URL decides it: /en/… is English, every other path
 *  Dutch. The browser's language does not: crawlers browse as en-US (Googlebot
 *  sends no Accept-Language), and choosing by browser had Google index the
 *  Dutch pages in English. A choice made with the language button wins over
 *  the URL by moving to that language's URL. See docs/english-urls.md. */
export type Lang = "nl" | "en";

type Widen<T> = { [K in keyof T]: T[K] extends (...args: infer A) => string ? (...args: A) => string : string };
/** Every UI string, keyed as in nl.ts; en.ts has to supply the same keys. */
export type Dict = Widen<typeof nl>;

const DICTS: Record<Lang, Dict> = PSEUDO ? { nl: pseudoDict(nl), en: pseudoDict(en) } : { nl, en };
const STORAGE_KEY = "metro-lang";

/** The language picked with the language button, if any. */
export function savedLang(): Lang | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "nl" || saved === "en") return saved;
  } catch {
    /* storage unavailable */
  }
  return null;
}

/** Whether the browser lists Dutch at all. Only decides whether to offer
 *  English (EnglishHint), never which language a page is in. */
export function browserReadsDutch(): boolean {
  const langs = typeof navigator === "undefined" ? [] : navigator.languages ?? [navigator.language];
  return !langs.length || langs.some((l) => l?.toLowerCase().startsWith("nl"));
}

function detect(): Lang {
  if (typeof window === "undefined") return "nl";
  return savedLang() ?? langOfPath(window.location.pathname);
}

let current: Lang = detect();
const listeners = new Set<() => void>();

/** Mark the document and put the address bar on this language's URL (same
 *  page, query and hash; replaced, so Back doesn't flip the language). */
function apply(lang: Lang) {
  if (typeof document === "undefined") return;
  document.documentElement.lang = lang;
  const { pathname, search, hash } = window.location;
  if (langOfPath(pathname) !== lang) {
    window.history.replaceState(window.history.state, "", pagePath(pageOfPath(pathname), lang) + search + hash);
  }
}
apply(current);
// Back/forward can land on an entry made before a language switch
// (/reisinfo after switching to English there); keep the URL on the
// language the visitor is reading.
if (typeof window !== "undefined") window.addEventListener("popstate", () => apply(current));

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
  apply(lang);
  if (lang === current) return;
  current = lang;
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

/** `pick`, and the language the picked text is in: for `lang` on its element,
 *  so a translator knows what it is translating from. */
export function pickWithLang(text: { nl: string; en?: string | null }, lang: Lang = current): { text: string; lang: Lang } {
  return lang === "en" && text.en ? { text: text.en, lang: "en" } : { text: text.nl, lang: "nl" };
}
