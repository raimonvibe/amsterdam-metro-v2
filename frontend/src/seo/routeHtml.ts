import { SEO } from "./site";

/** In-app pages that get their own built HTML (dist/<path>/index.html), so a
 *  crawler sees the right title, description and canonical before any
 *  JavaScript runs. At runtime setPageMeta() sets the same values. */
export const ROUTE_PAGES = [
  { path: "/reisinfo", title: SEO.travelTitle, description: SEO.travelDescription },
  // Kept out of search results (it would only clutter the site's sitelinks);
  // "follow" still lets crawlers use its links. Not in sitemap.xml either.
  { path: "/privacy", title: SEO.privacyTitle, description: SEO.privacyDescription, noindex: true },
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
  page: { path: string; title: string; description: string; noindex?: boolean },
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
