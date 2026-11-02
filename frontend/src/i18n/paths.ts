import type { Lang } from "./index";

/** The site's pages, by their Dutch path. English lives under /en with the
 *  same names (/en/reisinfo), so switching language is adding or removing
 *  the prefix. See docs/english-urls.md. */
export const PAGES = ["/", "/reisinfo", "/privacy"] as const;
export type Page = (typeof PAGES)[number];

export function langOfPath(pathname: string): Lang {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "nl";
}

/** The page a path shows, without its language prefix. Unknown paths show the
 *  map (the host rewrites them to the entry page), so they count as "/". */
export function pageOfPath(pathname: string): Page {
  const rest = langOfPath(pathname) === "en" ? pathname.slice(3) : pathname;
  const page = rest.replace(/\/+$/, "") || "/";
  return (PAGES as readonly string[]).includes(page) ? (page as Page) : "/";
}

/** A page's path in one language: "/reisinfo" → "/en/reisinfo", "/" → "/en/". */
export function pagePath(page: Page, lang: Lang): string {
  if (lang === "nl") return page;
  return page === "/" ? "/en/" : `/en${page}`;
}
