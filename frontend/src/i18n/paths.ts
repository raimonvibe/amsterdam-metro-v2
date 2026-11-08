import type { Lang } from "./index";

/** The site's pages, by their Dutch path. English lives under /en with the
 *  same names (/en/reisinfo), so switching language is adding or removing
 *  the prefix. See docs/english-urls.md. */
export const PAGES = ["/", "/reisinfo", "/privacy"] as const;
export type Page = (typeof PAGES)[number];

export function langOfPath(pathname: string): Lang {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "nl";
}

/** A path without its language prefix: "/en/reisinfo/zuid" → "/reisinfo/zuid". */
function withoutLang(pathname: string): string {
  return langOfPath(pathname) === "en" ? pathname.slice(3) || "/" : pathname;
}

/** The page a path shows, without its language prefix. A station page
 *  (/reisinfo/<slug>) is the travel page. Unknown paths show the map, so
 *  they count as "/" (on the live site they get the 404 page instead). */
export function pageOfPath(pathname: string): Page {
  const rest = withoutLang(pathname).replace(/\/+$/, "") || "/";
  if (/^\/reisinfo\/[^/]+$/.test(rest)) return "/reisinfo";
  return (PAGES as readonly string[]).includes(rest) ? (rest as Page) : "/";
}

/** The station slug in a station page's path, or null: "/en/reisinfo/zuid" → "zuid".
 *  Only letters, digits and dashes: a decoded "../" or "//host" never comes
 *  back out of here into a link or the address bar. */
export function stationSlugOfPath(pathname: string): string | null {
  const m = withoutLang(pathname).match(/^\/reisinfo\/([^/]+)\/?$/);
  if (!m) return null;
  let slug: string;
  try {
    slug = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  return /^[a-z0-9-]+$/i.test(slug) ? slug : null;
}

/** A station page's path in one language: "/reisinfo/zuid/", "/en/reisinfo/zuid/".
 *  With the trailing slash: Render serves a built folder's index.html at
 *  that address by itself, with no routing rule. Without the slash it does
 *  not (tested on the live site, 8 Nov 2026); the 404 page forwards it. */
export function stationPath(slug: string, lang: Lang): string {
  return `${pagePath("/reisinfo", lang)}/${slug}/`;
}

/** The same page in another language, station included. */
export function localizedPath(pathname: string, lang: Lang): string {
  const slug = stationSlugOfPath(pathname);
  return slug ? stationPath(slug, lang) : pagePath(pageOfPath(pathname), lang);
}

/** A page's path in one language: "/reisinfo" → "/en/reisinfo", "/" → "/en/". */
export function pagePath(page: Page, lang: Lang): string {
  if (lang === "nl") return page;
  return page === "/" ? "/en/" : `/en${page}`;
}
