import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Lang } from "../i18n";
import { type Page, pagePath } from "../i18n/paths";
import { ROUTE_PAGES, STATION_PAGES, linesHtml, routeDir, routeHtml, sitemapXml, stationBody, stationHtml } from "./routeHtml";
import { notFoundHtml, NICKNAMES } from "./notFound";
import { STATION_NAMES, stationOfSlug, stationSlug } from "../data/network";
import { IMAGE_ALT, INDEXED_PAGES, PAGE_META, SITE_NAME } from "./site";

// The real entry page, so a change to its head is caught here too. Vitest
// runs from frontend/ (the test environment is jsdom, so no file: import.meta.url).
const INDEX = readFileSync(join(process.cwd(), "index.html"), "utf8");
const RENDER_YAML = readFileSync(join(process.cwd(), "..", "render.yaml"), "utf8").replace(/\r\n/g, "\n");
const SITEMAP = sitemapXml();
const BASE = "https://amsterdammetro.nl";

/** The Dutch homepage is index.html itself; every other page is built. */
const ALL: { page: Page; lang: Lang; html: string }[] = [
  { page: "/", lang: "nl", html: INDEX },
  ...ROUTE_PAGES.map((r) => ({ page: r.page, lang: r.lang, html: routeHtml(INDEX, r) })),
];

const hreflangs = (html: string) =>
  [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)].map((m) => `${m[1]} ${m[2]}`);

describe("routeHtml", () => {
  it("builds every page in both languages", () => {
    expect(ALL.map((p) => pagePath(p.page, p.lang)).sort()).toEqual(
      ["/", "/en/", "/en/privacy", "/en/reisinfo", "/privacy", "/reisinfo"],
    );
  });

  it("gives each page its own language, title, description, canonical and social tags", () => {
    for (const { page, lang, html } of ALL) {
      const url = `${BASE}${pagePath(page, lang)}`;
      const { title, description } = PAGE_META[page][lang];
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain(`<link rel="canonical" href="${url}" />`);
      expect(html).toContain(`<meta property="og:url" content="${url}" />`);
      expect(html).toContain(`<meta property="og:locale" content="${lang === "nl" ? "nl_NL" : "en_GB"}" />`);
      expect(html).toContain(`<title>${title.replace(/&/g, "&amp;")}</title>`);
      // One brand per language: "Metro Amsterdam Live" (nl), "Amsterdam Metro Live" (en).
      expect(title).toContain(SITE_NAME[lang]);
      expect(html).toContain(`<meta property="og:site_name" content="${SITE_NAME[lang]}" />`);
      expect(html).toContain(`<meta property="og:image:alt" content="${IMAGE_ALT[lang]}" />`);
      expect(html).toContain(`<meta name="twitter:image:alt" content="${IMAGE_ALT[lang]}" />`);
      expect(html.match(/content="([^"]*)"/g)?.join("\n")).toContain(description);
    }
  });

  it("index.html matches the Dutch homepage's meta", () => {
    expect(INDEX).toContain(`<title>${PAGE_META["/"].nl.title.replace(/&/g, "&amp;")}</title>`);
    expect(INDEX).toContain(PAGE_META["/"].nl.description);
  });

  // Google ignores hreflang unless both versions list the same set, each
  // including itself, with links both ways.
  it("gives both versions of a page the same hreflang set, pointing both ways", () => {
    for (const { page, html } of ALL) {
      expect(hreflangs(html)).toEqual([
        `nl ${BASE}${pagePath(page, "nl")}`,
        `en ${BASE}${pagePath(page, "en")}`,
        `x-default ${BASE}${pagePath(page, "nl")}`,
      ]);
    }
  });

  it("leaves the rest of the page alone", () => {
    const html = routeHtml(INDEX, ROUTE_PAGES[0]);
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(html).toContain('<meta property="og:image" content="https://amsterdammetro.nl/social-share.png" />');
  });

  it("keeps the privacy pages out of search results, but nothing else", () => {
    for (const { page, html } of ALL) {
      const robots = page === "/privacy" ? "noindex, follow" : "index, follow, max-image-preview:large";
      expect(html).toContain(`<meta name="robots" content="${robots}" />`);
    }
  });

  it("gives each page its own crawlable text, in its own language", () => {
    const home = INDEX.match(/<noscript>[\s\S]*?<\/noscript>/)![0];
    for (const route of ROUTE_PAGES) {
      const html = routeHtml(INDEX, route);
      expect(html.match(/<noscript>/g)).toHaveLength(1);
      expect(html).toContain(route.body);
      expect(html).not.toContain(home);
      if (route.lang === "en") {
        expect(route.body).not.toMatch(/metrokaart|vertrektijden|Privacybeleid|Reisinformatie/);
        // Links stay in English, except the one that switches to Dutch.
        expect(route.body.match(/href="[^"]*"/g)?.filter((h) => !h.includes("/en/"))).toEqual([
          ...(route.page === "/privacy" ? [] : [`href="${pagePath(route.page, "nl")}"`]),
        ]);
      }
    }
  });

  it("gives crawlers enough words: intro plus every metro line and its stations", () => {
    const words = (html: string) => html.replace(/<[^>]+>/g, " ").split(/\s+/).filter((w) => /\w/.test(w)).length;
    const home = INDEX.match(/<noscript>([\s\S]*?)<\/noscript>/)![1].replace(/\r\n/g, "\n");
    expect(home).toContain(linesHtml("nl"));
    expect(words(home)).toBeGreaterThan(200);
    for (const route of ROUTE_PAGES.filter((r) => !r.noindex)) {
      expect(route.body).toContain(linesHtml(route.lang));
      expect(words(route.body)).toBeGreaterThan(200);
    }
  });

  it("claims no app ratings it does not have (SoftwareApplication needs a rating or review)", () => {
    expect(INDEX).not.toMatch(/"@type":\s*"(SoftwareApplication|WebApplication|MobileApplication)"/);
  });

  it("fails loudly when the page no longer has a tag it must rewrite", () => {
    const noCanonical = INDEX.replace(/<link rel="canonical"[^>]*>/, "");
    expect(() => routeHtml(noCanonical, ROUTE_PAGES[0])).toThrow(/canonical/);
    const noHreflang = INDEX.replace(/<link rel="alternate" hreflang="en"[^>]*>/, "");
    expect(() => routeHtml(noHreflang, ROUTE_PAGES[0])).toThrow(/hreflang="en"/);
  });
});

describe("deploy config", () => {
  // Render's dashboard is what production reads; render.yaml mirrors it
  // (docs/render-deploy-plan.md). Without a rewrite, a built page is never
  // served and crawlers get the Dutch homepage's head at its URL.
  it("has a rewrite for every site page, none for stations, and no catch-all", () => {
    for (const route of ROUTE_PAGES) {
      const dir = routeDir(route);
      expect(RENDER_YAML, `rewrite for /${dir}`).toContain(`source: /${dir}\n        destination: /${dir}/index.html\n`);
    }
    // Station pages are served at /reisinfo/<slug>/ without a rule; a
    // placeholder rule gave unknown stations an empty 200 page (8 Nov 2026).
    expect(RENDER_YAML).not.toMatch(/^\s+source: .*:station/m);
    // A catch-all answers every made-up address with the homepage and 200.
    expect(RENDER_YAML).not.toMatch(/source: \/\*\n/);
  });

  it("revalidates every page's HTML", () => {
    for (const route of ROUTE_PAGES) {
      expect(RENDER_YAML).toContain(`- path: /${routeDir(route)}\n        name: Cache-Control\n        value: no-cache\n`);
    }
    for (const prefix of ["", "/en"]) {
      expect(RENDER_YAML).toContain(`- path: ${prefix}/reisinfo/*\n        name: Cache-Control\n        value: no-cache\n`);
    }
  });

  it("lists exactly the indexed pages in the sitemap, in both languages", () => {
    const locs = [...SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    const expected = [
      ...INDEXED_PAGES.flatMap((p) => [`${BASE}${pagePath(p, "nl")}`, `${BASE}${pagePath(p, "en")}`]),
      ...STATION_PAGES.filter((p) => p.indexed).map((p) => `${BASE}/${p.dir}/`),
    ].sort();
    expect(locs).toEqual(expected);
    // No lastmod: nothing records when a page changed, and a wrong date is noise.
    expect(SITEMAP).not.toContain("<lastmod>");
  });
});

describe("station pages", () => {
  const html = (name: string, lang: "nl" | "en" = "nl") =>
    stationHtml(INDEX, STATION_PAGES.find((p) => p.name === name && p.lang === lang)!);

  it("gives every station one page per language, at a unique short address", () => {
    expect(STATION_PAGES).toHaveLength(STATION_NAMES.length * 2);
    const slugs = STATION_NAMES.map(stationSlug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs).toContain("zuid");
    expect(slugs).toContain("bijlmer-arena");
    expect(slugs).toContain("centraal-station");
    for (const n of STATION_NAMES) expect(stationOfSlug(stationSlug(n))).toBe(n);
  });

  it("names the station in title, canonical, hreflang and breadcrumb", () => {
    const page = html("Amsterdam, Station Zuid", "en");
    expect(page).toContain('<html lang="en">');
    expect(page).toContain("<title>Station Zuid — metro 50, 51, 52: departures &amp; step-free access | Amsterdam Metro Live</title>");
    expect(page).toContain(`<link rel="canonical" href="${BASE}/en/reisinfo/zuid/" />`);
    expect(hreflangs(page)).toEqual([`nl ${BASE}/reisinfo/zuid/`, `en ${BASE}/en/reisinfo/zuid/`, `x-default ${BASE}/reisinfo/zuid/`]);
    expect(page).toContain('"@type":"BreadcrumbList"');
    expect(page).toContain(`"item":"${BASE}/en/reisinfo/zuid/"`);
  });

  it("says only stable facts: no live times, no lift faults", () => {
    for (const p of STATION_PAGES) {
      const body = stationBody(p.name, p.lang);
      expect(body).not.toMatch(/\b\d{1,2}:\d{2}\b/);
      expect(body).not.toMatch(/buiten gebruik \(|out of service \(|lift_out/);
    }
  });

  it("gives each station's text its own facts, not a shared paragraph", () => {
    const bodies = STATION_PAGES.filter((p) => p.lang === "nl").map((p) => stationBody(p.name, "nl"));
    expect(new Set(bodies).size).toBe(bodies.length);
    const words = (s: string) => s.replace(/<[^>]+>/g, " ").split(/\s+/).filter((w) => /\w/.test(w)).length;
    for (const b of bodies) expect(words(b)).toBeGreaterThan(60);
  });

  it("tells GVB's rating as GVB gives it, with the station's GVB page", () => {
    // Overamstel's lift is out, but GVB's page says Rolstoelvriendelijk.
    const over = stationBody("Amsterdam, Overamstel", "nl");
    expect(over).toContain("Volgens de haltepagina van GVB is Overamstel rolstoelvriendelijk");
    expect(over).toContain('zoek "Overamstel"');
    expect(over).toContain("https://www.gvb.nl/reisinformatie/halte/NL:Q:30009563");
    expect(stationBody("Amsterdam, Gein", "nl")).toContain("Volgens de haltepagina van GVB is Gein niet rolstoelvriendelijk");
    // Centraal has two metro stops on GVB's site.
    expect(stationBody("Amsterdam, Centraal Station", "en").match(/gvb\.nl\/reisinformatie\/halte\//g)).toHaveLength(2);
  });

  it("links each direction's next station, in the page's language", () => {
    const body = stationBody("Amsterdam, Noord", "en");
    expect(body).toContain('towards Station Zuid: next station <a href="/en/reisinfo/noorderpark/">Noorderpark</a>');
    expect(body.match(/<li>/g)).toHaveLength(1);
  });
});

describe("404 page", () => {
  const page = notFoundHtml();

  it("is kept out of search results and loads no app", () => {
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(page).not.toContain("/src/main.tsx");
    expect(page).toContain('<script src="/404.js"></script>');
  });

  it("has a language button, hidden until its script runs", () => {
    // Without JavaScript both languages show, so the button would do nothing.
    expect(page).toMatch(/<button type="button" class="lang-toggle" data-switch translate="no" hidden>EN<\/button>/);
  });

  it("links every station in both languages", () => {
    for (const n of STATION_NAMES) {
      expect(page).toContain(`href="/reisinfo/${stationSlug(n)}/"`);
      expect(page).toContain(`href="/en/reisinfo/${stationSlug(n)}/"`);
    }
  });

  it("only knows nicknames that point to real stations and aren't real addresses", () => {
    for (const [nick, names] of Object.entries(NICKNAMES)) {
      expect(stationOfSlug(nick), nick).toBeNull();
      for (const n of names) expect(STATION_NAMES).toContain(n);
    }
    expect(NICKNAMES.amstel).toHaveLength(3);
  });
});
