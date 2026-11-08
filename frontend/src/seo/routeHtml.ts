import type { Lang } from "../i18n";
import { type Page, pagePath, stationPath } from "../i18n/paths";
import { GVB_LIFT_FAULTS, gvbSearch } from "../data/accessibility";
import {
  METRO_LINES,
  STATION_NAMES,
  checkedOn,
  directionsFrom,
  displayName,
  gvbSaysStepFree,
  gvbStopUrls,
  linesAt,
  stationSlug,
} from "../data/network";
import {
  INDEXED_PAGES,
  IMAGE_ALT,
  OG_LOCALE,
  PAGE_META,
  SITE_NAME,
  alternates,
  listJoin,
  pageUrl,
  stationAlternates,
  stationMeta,
  stationUrl,
} from "./site";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A link to a station's page, with its name as the text. */
const stationLink = (name: string, lang: Lang) =>
  `<a href="${stationPath(stationSlug(name), lang)}">${escape(displayName(name))}</a>`;

/** The lines and their stations as a short HTML section, per language, each
 *  station linked to its page. index.html's <noscript> carries the Dutch copy. */
export function linesHtml(lang: Lang): string {
  const heading = lang === "nl" ? "De metrolijnen van Amsterdam" : "Amsterdam's metro lines";
  const items = METRO_LINES.map(
    ({ line, stations }) =>
      `<li><strong>M${line}</strong> ${escape(displayName(stations[0]))} – ${escape(displayName(stations[stations.length - 1]))}: ${stations.map((n) => stationLink(n, lang)).join(", ")}.</li>`,
  ).join("\n        ");
  return `<h2>${heading}</h2>
      <ul>
        ${items}
      </ul>`;
}

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
 *  head values. The Dutch homepage is index.html itself. Station pages are
 *  in STATION_PAGES below. */
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
      <p>
        Trains ride the real curves of the rails between 3D buildings. Click a station for its
        next departures, or click a train to follow it and see its next stop, delay, arrival time
        and platform. GVB's service messages for the metro show on the map, in Dutch or English.
        Amsterdam's metro publishes no GPS positions, so each train's place is worked out from
        GVB's live timetable and delay feed, the same data GVB itself uses.
      </p>
      ${linesHtml("en")}
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
      <p>
        De vertrekstaat toont per station de vertrekken per richting, met vertraging, uitgevallen
        ritten en aankomsttijd op het eindpunt. Kies "Zonder trappen" in de reisplanner om te zien
        welke stations op je reis niet stapvrij zijn of een lift buiten gebruik hebben, met een
        link naar de liftstoringen van GVB. Bewaar favoriete stations en deel een reis met een link.
      </p>
      ${linesHtml("nl")}
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
      <p>
        The departure board shows each station's trains by direction, with delays, cancelled runs
        and arrival time at the terminus. Choose "Avoid stairs" in the journey planner to see which
        stations on your trip are not step-free or have a lift out of service, with a link to
        GVB's lift faults. Save favourite stations and share a journey with a link.
      </p>
      ${linesHtml("en")}
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

interface Head {
  lang: Lang;
  title: string;
  description: string;
  url: string;
  alternates: { hreflang: string; href: string }[];
  body: string;
  noindex?: boolean;
  /** Extra structured data, inserted before </head>. */
  jsonLd?: object;
}

/**
 * The built index.html with the head rewritten for one page. Every tag must
 * be found exactly once: if index.html changes shape, the build fails here
 * instead of quietly shipping a page that still claims to be the homepage.
 */
function rewriteHead(indexHtml: string, h: Head, label: string): string {
  const title = escape(h.title);
  const description = escape(h.description);
  const swaps: [RegExp, string][] = [
    [/(<html\s+lang=")[^"]*(")/g, `$1${h.lang}$2`],
    [/<title>[^<]*<\/title>/g, `<title>${title}</title>`],
    [/(<meta\s+name="description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<link\s+rel="canonical"\s+href=")[^"]*(")/g, `$1${h.url}$2`],
    [/(<meta\s+property="og:title"\s+content=")[^"]*(")/g, `$1${title}$2`],
    [/(<meta\s+property="og:description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<meta\s+property="og:url"\s+content=")[^"]*(")/g, `$1${h.url}$2`],
    [/(<meta\s+property="og:site_name"\s+content=")[^"]*(")/g, `$1${escape(SITE_NAME[h.lang])}$2`],
    [/(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/g, `$1${escape(IMAGE_ALT[h.lang])}$2`],
    [/(<meta\s+name="twitter:image:alt"\s+content=")[^"]*(")/g, `$1${escape(IMAGE_ALT[h.lang])}$2`],
    [/(<meta\s+property="og:locale"\s+content=")[^"]*(")/g, `$1${OG_LOCALE[h.lang]}$2`],
    [/(<meta\s+property="og:locale:alternate"\s+content=")[^"]*(")/g, `$1${OG_LOCALE[h.lang === "nl" ? "en" : "nl"]}$2`],
    [/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/g, `$1${title}$2`],
    [/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<noscript>)[\s\S]*?(<\/noscript>)/g, `$1\n      ${h.body}\n    $2`],
  ];
  for (const { hreflang, href } of h.alternates) {
    swaps.push([new RegExp(`(<link\\s+rel="alternate"\\s+hreflang="${hreflang}"\\s+href=")[^"]*(")`, "g"), `$1${href}$2`]);
  }
  if (h.noindex) swaps.push([/(<meta\s+name="robots"\s+content=")[^"]*(")/g, "$1noindex, follow$2"]);
  if (h.jsonLd) {
    // "<" escaped so no text in the data can close the script element.
    const json = JSON.stringify(h.jsonLd).replace(/</g, "\\u003c");
    swaps.push([/<\/head>/g, `  <script type="application/ld+json">${json}</script>\n  </head>`]);
  }
  let html = indexHtml;
  for (const [re, to] of swaps) {
    const found = html.match(re)?.length ?? 0;
    if (found !== 1) throw new Error(`routeHtml(${label}): expected one match for ${re}, found ${found}`);
    // "$$" keeps any other "$" in the content literal; $1/$2 are the groups.
    html = html.replace(re, to.replace(/\$(?![12])/g, "$$$$"));
  }
  return html;
}

/** One built site page (/en/, /reisinfo, …). */
export function routeHtml(indexHtml: string, route: RoutePage): string {
  const meta = PAGE_META[route.page][route.lang];
  return rewriteHead(
    indexHtml,
    {
      lang: route.lang,
      title: meta.title,
      description: meta.description,
      url: pageUrl(route.page, route.lang),
      alternates: alternates(route.page),
      body: route.body,
      noindex: route.noindex,
    },
    pagePath(route.page, route.lang),
  );
}

// ─── Station pages ───────────────────────────────────────────────────────────

/** "2 november 2026" / "2 November 2026". */
function longDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === "nl" ? "nl-NL" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

/** A station page is indexed only when it has something checked of its own
 *  to say: a station checked on GVB's site, with its GVB page known. */
export function stationIndexable(name: string): boolean {
  return checkedOn(name) !== null && gvbStopUrls(name).length > 0;
}

/**
 * The crawlable text of a station's page: only facts about this station that
 * stay true between deploys (lines, directions, neighbours, GVB's own rating
 * and links). Never live times or lift faults: those load in the browser, so
 * they can't go stale in a search result. See docs/seo-tidy-plan.md.
 */
export function stationBody(name: string, lang: Lang): string {
  const nl = lang === "nl";
  const station = escape(displayName(name));
  const lines = linesAt(name);
  const checked = checkedOn(name);
  const term = escape(gvbSearch(name));
  const other: Lang = nl ? "en" : "nl";
  const home = pagePath("/", lang);
  const travel = pagePath("/reisinfo", lang);

  const directions = directionsFrom(name)
    .map(({ line, terminus, next }) =>
      nl
        ? `<li><strong>M${line}</strong> richting ${escape(displayName(terminus))}: volgende station ${stationLink(next, lang)}</li>`
        : `<li><strong>M${line}</strong> towards ${escape(displayName(terminus))}: next station ${stationLink(next, lang)}</li>`,
    )
    .join("\n        ");

  const when = checked ? (nl ? ` (onze laatste controle: ${longDate(checked, lang)})` : ` (our last check: ${longDate(checked, lang)})`) : "";
  const faults = `<a href="${GVB_LIFT_FAULTS}">${nl ? "liftstoringen van GVB" : "GVB's lift faults"}</a>`;
  let access: string;
  if (!checked) {
    access = nl
      ? `<p>${station} is nog niet gecontroleerd op de site van GVB. Tot dan geldt het station hier als niet rolstoeltoegankelijk.</p>`
      : `<p>${station} has not been checked on GVB's site yet. Until then it counts as not step-free here.</p>`;
  } else if (gvbSaysStepFree(name)) {
    access = nl
      ? `<p>Volgens de haltepagina van GVB is ${station} rolstoelvriendelijk${when}. Een lift kan tijdelijk buiten gebruik zijn: zoek "${term}" bij de ${faults} voordat je reist.</p>`
      : `<p>According to GVB's station page, ${station} is step-free${when}. A lift can be out of service for a while: search for "${term}" in ${faults} before you travel.</p>`;
  } else {
    access = nl
      ? `<p>Volgens de haltepagina van GVB is ${station} niet rolstoelvriendelijk${when}.</p>`
      : `<p>According to GVB's station page, ${station} is not step-free${when}.</p>`;
  }

  const gvbPages = gvbStopUrls(name)
    .map((url, i, all) => `<a href="${url}">${nl ? "Haltepagina van GVB" : "GVB's station page"}${all.length > 1 ? ` ${i + 1}` : ""}</a>`)
    .join(" · ");

  const intro = nl
    ? `Metro${lines.length > 1 ? "lijnen" : "lijn"} ${listJoin(lines, lang)} ${lines.length > 1 ? "stoppen" : "stopt"} op ${station}. Deze pagina toont live de vertrektijden per richting, met perron en vertraging; daarvoor is JavaScript nodig.`
    : `Metro ${lines.length > 1 ? "lines" : "line"} ${listJoin(lines, lang)} ${lines.length > 1 ? "stop" : "stops"} at ${station}. This page shows live departures by direction, with platform and delay; that needs JavaScript.`;

  return `<nav aria-label="${nl ? "Kruimelpad" : "Breadcrumb"}"><a href="${home}">${escape(SITE_NAME[lang])}</a> › <a href="${travel}">${nl ? "Reisinformatie" : "Travel info"}</a> › ${station}</nav>
      <h1>${nl ? `Metrostation ${station}` : `${station} metro station`}</h1>
      <p>${intro}</p>
      <h2>${nl ? "Lijnen en richtingen" : "Lines and directions"}</h2>
      <ul>
        ${directions}
      </ul>
      <h2>${nl ? "Toegankelijkheid" : "Step-free access"}</h2>
      ${access}
      <p>${gvbPages}</p>
      <p><a href="${travel}">${nl ? "Alle stations en de reisplanner" : "All stations and the journey planner"}</a> · <a href="${home}">${nl ? "Live 3D-metrokaart" : "Live 3D metro map"}</a> · <a href="${stationPath(stationSlug(name), other)}" hreflang="${other}" lang="${other}">${nl ? "English" : "Nederlands"}</a></p>`;
}

/** Breadcrumb structured data: Reisinformatie › station. */
function stationBreadcrumb(name: string, lang: Lang): object {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: lang === "nl" ? "Reisinformatie" : "Travel info", item: pageUrl("/reisinfo", lang) },
      { "@type": "ListItem", position: 2, name: displayName(name), item: stationUrl(name, lang) },
    ],
  };
}

export interface StationPage {
  name: string;
  lang: Lang;
  /** Under dist/: "reisinfo/zuid", "en/reisinfo/zuid" (served at /reisinfo/zuid/). */
  dir: string;
  indexed: boolean;
}

/** Every station's page in both languages. */
export const STATION_PAGES: StationPage[] = STATION_NAMES.flatMap((name) =>
  (["nl", "en"] as const).map((lang) => ({
    name,
    lang,
    dir: stationPath(stationSlug(name), lang).slice(1, -1),
    indexed: stationIndexable(name),
  })),
);

export function stationHtml(indexHtml: string, page: StationPage): string {
  const { title, description } = stationMeta(page.name, page.lang);
  return rewriteHead(
    indexHtml,
    {
      lang: page.lang,
      title,
      description,
      url: stationUrl(page.name, page.lang),
      alternates: stationAlternates(page.name),
      body: stationBody(page.name, page.lang),
      noindex: !page.indexed,
      jsonLd: stationBreadcrumb(page.name, page.lang),
    },
    `/${page.dir}`,
  );
}

// ─── Sitemap ─────────────────────────────────────────────────────────────────

/**
 * Every indexable URL: the site's pages and the checked station pages, in
 * both languages. No <lastmod>: nothing records when a station's page last
 * changed, and a wrong date is worse than none.
 */
export function sitemapUrls(): string[] {
  return [
    ...INDEXED_PAGES.flatMap((p) => [pageUrl(p, "nl"), pageUrl(p, "en")]),
    ...STATION_PAGES.filter((p) => p.indexed).map((p) => stationUrl(p.name, p.lang)),
  ];
}

export function sitemapXml(): string {
  const urls = sitemapUrls()
    .map((u) => `  <url>\n    <loc>${escape(u)}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
