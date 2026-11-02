import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Lang } from "../i18n";
import { type Page, pagePath } from "../i18n/paths";
import { ROUTE_PAGES, routeDir, routeHtml } from "./routeHtml";
import { IMAGE_ALT, INDEXED_PAGES, PAGE_META, SITE_NAME } from "./site";

// The real entry page, so a change to its head is caught here too. Vitest
// runs from frontend/ (the test environment is jsdom, so no file: import.meta.url).
const INDEX = readFileSync(join(process.cwd(), "index.html"), "utf8");
const RENDER_YAML = readFileSync(join(process.cwd(), "..", "render.yaml"), "utf8").replace(/\r\n/g, "\n");
const SITEMAP = readFileSync(join(process.cwd(), "public", "sitemap.xml"), "utf8");
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
  it("has a rewrite for every built page, above the catch-all", () => {
    const catchAll = RENDER_YAML.indexOf("source: /*\n");
    expect(catchAll).toBeGreaterThan(0);
    for (const route of ROUTE_PAGES) {
      const dir = routeDir(route);
      const rule = RENDER_YAML.indexOf(`source: /${dir}\n        destination: /${dir}/index.html\n`);
      expect(rule, `rewrite for /${dir}`).toBeGreaterThan(0);
      expect(rule).toBeLessThan(catchAll);
    }
  });

  it("revalidates every page's HTML", () => {
    for (const route of ROUTE_PAGES) {
      expect(RENDER_YAML).toContain(`- path: /${routeDir(route)}\n        name: Cache-Control\n        value: no-cache\n`);
    }
  });

  it("lists exactly the indexed pages in the sitemap, in both languages", () => {
    const locs = [...SITEMAP.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]).sort();
    const expected = INDEXED_PAGES.flatMap((p) => [`${BASE}${pagePath(p, "nl")}`, `${BASE}${pagePath(p, "en")}`]).sort();
    expect(locs).toEqual(expected);
  });
});
