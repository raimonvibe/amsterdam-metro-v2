import { SEO } from "./site";

/** In-app pages that get their own built HTML (dist/<path>/index.html), so a
 *  crawler sees the right title, description, canonical and body text before
 *  any JavaScript runs. At runtime setPageMeta() sets the same head values.
 *  `body` replaces the homepage's <noscript> text: with the same text on every
 *  page, Google treats /reisinfo as a duplicate of the homepage. */
export const ROUTE_PAGES = [
  {
    path: "/reisinfo",
    title: SEO.travelTitle,
    description: SEO.travelDescription,
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
      <p><a href="/">Live 3D-metrokaart</a> · <a href="/privacy">Privacybeleid</a></p>`,
  },
  // Kept out of search results (it would only clutter the site's sitelinks);
  // "follow" still lets crawlers use its links. Not in sitemap.xml either.
  {
    path: "/privacy",
    title: SEO.privacyTitle,
    description: SEO.privacyDescription,
    noindex: true,
    body: `<h1>Privacybeleid — Metro Amsterdam Live</h1>
      <p>
        Welke gegevens Metro Amsterdam Live verwerkt, welke cookies en externe diensten de site
        gebruikt, en wat uw rechten zijn. Deze pagina heeft JavaScript nodig.
      </p>
      <p><a href="/">Live 3D-metrokaart</a> · <a href="/reisinfo">Reisinformatie</a></p>`,
  },
] as const;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The built index.html with the head rewritten for one route. Every tag must
 * be found exactly once: if index.html changes shape, the build fails here
 * instead of quietly shipping a page that still claims to be the homepage.
 */
export function routeHtml(
  indexHtml: string,
  page: { path: string; title: string; description: string; body: string; noindex?: boolean },
): string {
  const url = `${SEO.canonicalBase}${page.path}`;
  const title = escape(page.title);
  const description = escape(page.description);
  const swaps: [RegExp, string][] = [
    [/<title>[^<]*<\/title>/g, `<title>${title}</title>`],
    [/(<meta\s+name="description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<link\s+rel="canonical"\s+href=")[^"]*(")/g, `$1${url}$2`],
    [/(<meta\s+property="og:title"\s+content=")[^"]*(")/g, `$1${title}$2`],
    [/(<meta\s+property="og:description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<meta\s+property="og:url"\s+content=")[^"]*(")/g, `$1${url}$2`],
    [/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/g, `$1${title}$2`],
    [/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/g, `$1${description}$2`],
    [/(<noscript>)[\s\S]*?(<\/noscript>)/g, `$1\n      ${page.body}\n    $2`],
  ];
  if (page.noindex) swaps.push([/(<meta\s+name="robots"\s+content=")[^"]*(")/g, "$1noindex, follow$2"]);
  let html = indexHtml;
  for (const [re, to] of swaps) {
    const found = html.match(re)?.length ?? 0;
    if (found !== 1) throw new Error(`routeHtml(${page.path}): expected one match for ${re}, found ${found}`);
    html = html.replace(re, to);
  }
  return html;
}
