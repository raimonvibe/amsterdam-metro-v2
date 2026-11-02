import type { Lang } from "../i18n";
import { type Page, pagePath } from "../i18n/paths";
import { OG_LOCALE, PAGE_META, alternates, pageUrl } from "./site";

export interface RoutePage {
  page: Page;
  lang: Lang;
  /** Replaces the homepage's <noscript> text: with the same text on every
   *  page, Google treats /reisinfo as a duplicate of the homepage. */
  body: string;
  noindex?: boolean;
}

/** Pages that get their own built HTML (dist/<path>/index.html), so a crawler
 *  sees the right language, title, description, canonical, hreflang and body
 *  text before any JavaScript runs. At runtime setPageMeta() sets the same
 *  head values. The Dutch homepage is index.html itself. */
export const ROUTE_PAGES: RoutePage[] = [
  {
    page: "/",
    lang: "en",
    body: `<h1>Amsterdam Metro Live — live 3D metro map of Amsterdam</h1>
      <p>
        See where every metro in Amsterdam is right now. This live 3D metro map shows all GVB
        metro lines (M50, M51, M52, M53 and M54) on their real tracks, with delays and departures
        for every station. The map needs JavaScript and WebGL.
      </p>
      <p><a href="/en/reisinfo">Travel info</a> · <a href="/en/privacy">Privacy policy</a> · <a href="/" hreflang="nl" lang="nl">Nederlands</a></p>`,
  },
  {
    page: "/reisinfo",
    lang: "nl",
    body: `<h1>Reisinformatie metro Amsterdam — vertrektijden, reisplanner en lijnen</h1>
      <p>
        Live vertrektijden per metrostation in Amsterdam, met perron en vertraging. Plan een
        reis met overstappen tussen de GVB-metrolijnen M50, M51, M52, M53 en M54, en zie welke
        stations stapvrij bereikbaar zijn.
      </p>
      <p>
        Per lijn een overzicht van alle stations met de metro's die nu rijden, en hoe stipt
        elke lijn rijdt. Deze pagina heeft JavaScript nodig.
      </p>
      <p><a href="/">Live 3D-metrokaart</a> · <a href="/privacy">Privacybeleid</a> · <a href="/en/reisinfo" hreflang="en" lang="en">English</a></p>`,
  },
  {
    page: "/reisinfo",
    lang: "en",
    body: `<h1>Amsterdam metro travel info — departures, journey planner and lines</h1>
      <p>
        Live departures for every metro station in Amsterdam, with platform and delay. Plan a
        journey with transfers between GVB metro lines M50, M51, M52, M53 and M54, and see which
        stations are step-free.
      </p>
      <p>
        For each line, all its stations with the trains running now, and how punctual each line
        is. This page needs JavaScript.
      </p>
      <p><a href="/en/">Live 3D metro map</a> · <a href="/en/privacy">Privacy policy</a> · <a href="/reisinfo" hreflang="nl" lang="nl">Nederlands</a></p>`,
  },
  // Kept out of search results (it would only clutter the site's sitelinks);
  // "follow" still lets crawlers use its links. Not in sitemap.xml either.
  {
    page: "/privacy",
    lang: "nl",
    noindex: true,
    body: `<h1>Privacybeleid — Metro Amsterdam Live</h1>
      <p>
        Welke gegevens Metro Amsterdam Live verwerkt, welke cookies en externe diensten de site
        gebruikt, en wat uw rechten zijn. Deze pagina heeft JavaScript nodig.
      </p>
      <p><a href="/">Live 3D-metrokaart</a> · <a href="/reisinfo">Reisinformatie</a></p>`,
  },
  {
    page: "/privacy",
    lang: "en",
    noindex: true,
    body: `<h1>Privacy policy — Amsterdam Metro Live</h1>
      <p>
        What data Amsterdam Metro Live processes, which cookies and third-party services the site
        uses, and what your rights are. This page needs JavaScript.
      </p>
      <p><a href="/en/">Live 3D metro map</a> · <a href="/en/reisinfo">Travel info</a></p>`,
  },
];

/** Where a route's HTML goes under dist/: "/en/" → "en", "/reisinfo" → "reisinfo". */
export const routeDir = (r: Pick<RoutePage, "page" | "lang">) => pagePath(r.page, r.lang).replace(/^\/|\/$/g, "");

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The built index.html with the head rewritten for one route. Every tag must
 * be found exactly once: if index.html changes shape, the build fails here
 * instead of quietly shipping a page that still claims to be the homepage.
 */
export function routeHtml(indexHtml: string, route: RoutePage): string {
  const meta = PAGE_META[route.page][route.lang];
  const url = pageUrl(route.page, route.lang);
  const title = escape(meta.title);
  const description = escape(meta.description);
  const swaps: [RegExp, string][] = [
    [/(<html\s+lang=")[^"]*(")/g, `$1${route.lang}$2`],
    [/<title>[^<]*<\/title>/g, `<title>${title}</title>`],
    [/(<meta\s+name="description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<link\s+rel="canonical"\s+href=")[^"]*(")/g, `$1${url}$2`],
    [/(<meta\s+property="og:title"\s+content=")[^"]*(")/g, `$1${title}$2`],
    [/(<meta\s+property="og:description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<meta\s+property="og:url"\s+content=")[^"]*(")/g, `$1${url}$2`],
    [/(<meta\s+property="og:locale"\s+content=")[^"]*(")/g, `$1${OG_LOCALE[route.lang]}$2`],
    [/(<meta\s+property="og:locale:alternate"\s+content=")[^"]*(")/g, `$1${OG_LOCALE[route.lang === "nl" ? "en" : "nl"]}$2`],
    [/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/g, `$1${title}$2`],
    [/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<noscript>)[\s\S]*?(<\/noscript>)/g, `$1\n      ${route.body}\n    $2`],
  ];
  for (const { hreflang, href } of alternates(route.page)) {
    swaps.push([new RegExp(`(<link\\s+rel="alternate"\\s+hreflang="${hreflang}"\\s+href=")[^"]*(")`, "g"), `$1${href}$2`]);
  }
  if (route.noindex) swaps.push([/(<meta\s+name="robots"\s+content=")[^"]*(")/g, "$1noindex, follow$2"]);
  let html = indexHtml;
  for (const [re, to] of swaps) {
    const found = html.match(re)?.length ?? 0;
    if (found !== 1) throw new Error(`routeHtml(${pagePath(route.page, route.lang)}): expected one match for ${re}, found ${found}`);
    html = html.replace(re, to);
  }
  return html;
}
