import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Lang } from "../i18n";
import { type Page, pagePath } from "../i18n/paths";
import { ROUTE_PAGES, STATION_PAGES, linesHtml, routeDir, routeHtml, sitemapXml, stationBody, stationHtml } from "./routeHtml";
import { MODEL, NICKNAMES, NOT_FOUND_BOOT, RAILS, notFoundHtml } from "./notFound";
import { langOfPath, themeFor } from "../notfound/suggest";
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
  const page = notFoundHtml({ script: "/assets/notfound-test.js", hasPoster: false });

  it("is kept out of search results and loads only its own script", () => {
    expect(page).toContain('<meta name="robots" content="noindex" />');
    expect(page).not.toContain("/src/main.tsx");
    expect(page).toContain('<script type="module" src="/assets/notfound-test.js"></script>');
  });

  it("has a language button, hidden until its script runs", () => {
    // Without JavaScript both languages show, so the button would do nothing.
    expect(page).toMatch(/<button type="button" class="lang-toggle" data-switch translate="no" hidden>EN<\/button>/);
  });

  it("says what happened in both languages, with one heading each", () => {
    expect(page.match(/<h1>/g)).toHaveLength(2);
    expect(page).toContain("Fout 404 · pagina niet gevonden");
    expect(page).toContain("Error 404 · page not found");
  });

  it("links every station in both languages", () => {
    for (const n of STATION_NAMES) {
      expect(page).toContain(`href="/reisinfo/${stationSlug(n)}/"`);
      expect(page).toContain(`href="/en/reisinfo/${stationSlug(n)}/"`);
    }
  });

  it("makes each station one big link, its lines inside it", () => {
    const rows = page.match(/<a class="st-link" href="[^"]+"><span class="st-name">[^<]+<\/span> <span class="lines">(<span class="badge l5\d">5\d<\/span> ?)+<\/span><\/a>/g);
    expect(rows).toHaveLength(STATION_NAMES.length * 2);
    expect(page).toMatch(/\.st-link \{[^}]*min-height: 2\.75rem/);
  });

  it("credits the 3D model as its license asks: title, author, source, license, changes", () => {
    for (const s of [MODEL.source, MODEL.authorUrl, MODEL.licenseUrl, MODEL.title, MODEL.author, "CC BY-NC-SA 4.0"]) {
      expect(page).toContain(s);
    }
    expect(page).toContain("Aangepast: gecomprimeerd voor het web, de rails op maat gebracht en herhaald.");
    expect(page).toContain("Changed: compressed for the web, the rails scaled and repeated.");
  });

  it("credits the rails as CC BY asks: title, author, source, license, changes", () => {
    for (const s of [RAILS.source, RAILS.authorUrl, RAILS.licenseUrl, RAILS.title, RAILS.author, "CC BY 4.0"]) {
      expect(page).toContain(s);
    }
    expect(page).toContain(`data-rails="${RAILS.url}"`);
  });

  it("shows a still image until the 3D loads, and describes it", () => {
    expect(page).toContain(`data-model="${MODEL.url}"`);
    // A group, not an image: it holds the replay button, and an image role
    // would hide that from screen readers.
    expect(page).toMatch(/data-stage[^>]*role="group"[^>]*aria-label="[^"]+"/);
    expect(page).toMatch(/<svg class="stage-still"/);
    expect(notFoundHtml({ script: "/x.js", hasPoster: true })).toContain(`<img class="stage-still" src="${MODEL.poster}"`);
  });

  it("has labelled zoom, reset and full screen buttons in both languages", () => {
    for (const label of ["Inzoomen", "Uitzoomen", "Beeld herstellen", "Volledig scherm", "Zoom in", "Zoom out", "Reset view", "Full screen"]) {
      expect(page).toContain(`aria-label="${label}"`);
    }
    expect(page.match(/data-fullscreen aria-pressed="false"/g)).toHaveLength(2);
    expect(page).toContain('data-exit-label="Volledig scherm sluiten"');
    expect(page).toContain('data-exit-label="Exit full screen"');
    // Hidden until the 3D runs: without it they would do nothing.
    expect(page).toMatch(/\.stage-wrap:not\(\.is-ready\) \.view-tools[^{]*\{ opacity: 0; visibility: hidden; \}/);
  });

  it("loads the head script before the first paint, when given", () => {
    const withBoot = notFoundHtml({ script: "/x.js", boot: "/assets/notfound-boot-abc.js", hasPoster: false });
    const head = withBoot.slice(0, withBoot.indexOf("</head>"));
    expect(head).toContain('<script src="/assets/notfound-boot-abc.js"></script>');
    // Classic and blocking: no defer, no async, no module.
    expect(head).not.toMatch(/notfound-boot[^>]*(defer|async|module)/);
  });

  it("keeps each language in one grid cell, so without JavaScript they stack instead of overlapping", () => {
    expect(page.match(/class="head"/g)).toHaveLength(1);
    expect(page.match(/class="tools"/g)).toHaveLength(1);
  });

  it("puts the 3D controls in a dropdown, closed, in both languages", () => {
    expect(page.match(/<details class="disclosure help"/g)).toHaveLength(2);
    expect(page).not.toMatch(/<details class="disclosure help"[^>]* open/);
    expect(page).toContain("Zo bedien je de 3D-metro");
    expect(page).toContain("How to control the 3D metro");
  });

  it("only knows nicknames that point to real stations and aren't real addresses", () => {
    for (const [nick, names] of Object.entries(NICKNAMES)) {
      expect(stationOfSlug(nick), nick).toBeNull();
      for (const n of names) expect(STATION_NAMES).toContain(n);
    }
    expect(NICKNAMES.amstel).toHaveLength(3);
  });
});

describe("404 page head script", () => {
  /** Runs NOT_FOUND_BOOT against a stand-in document. */
  function boot(path: string, style: string | null) {
    const attrs: Record<string, string> = {};
    const meta = { content: "light", setAttribute: (_: string, v: string) => (meta.content = v) };
    const root = { lang: "", className: "", setAttribute: (k: string, v: string) => (attrs[k] = v) };
    const doc = { documentElement: root, querySelector: () => meta };
    const storage = { getItem: () => style };
    new Function("document", "location", "localStorage", NOT_FOUND_BOOT)(doc, { pathname: path }, storage);
    return { lang: root.lang, classes: root.className.trim().split(/\s+/), theme: attrs["data-theme"] ?? "light", meta: meta.content };
  }

  it.each(["/", "/nope", "/en", "/en/", "/en/nope", "/english", "/reisinfo/x/"])("agrees with langOfPath for %s", (path) => {
    const r = boot(path, null);
    expect(r.lang).toBe(langOfPath(path));
    expect(r.classes).toEqual(["js", `lang-${langOfPath(path)}`]);
  });

  it.each([null, "light", "dark", "fiord", "positron", "constructor"])("agrees with themeFor for style %s", (style) => {
    const r = boot("/x", style);
    expect(r.theme).toBe(themeFor(style));
    expect(r.meta).toBe(themeFor(style));
  });

  it("expects the 3D only where page.ts can run it, and never with reduced motion", () => {
    const run = (win: object, nav: object, reduced: boolean) => {
      const root = { lang: "", className: "", setAttribute() {} };
      const doc = { documentElement: root, querySelector: () => null };
      const mm = () => ({ matches: reduced });
      new Function("document", "location", "localStorage", "window", "navigator", "matchMedia", NOT_FOUND_BOOT)(
        doc, { pathname: "/" }, { getItem: () => null }, win, nav, mm,
      );
      return root.className.includes("will-3d");
    };
    const gl = { WebGL2RenderingContext: class {} };
    expect(run(gl, {}, false)).toBe(true);
    expect(run(gl, {}, true)).toBe(false);
    expect(run({}, {}, false)).toBe(false);
    expect(run(gl, { connection: { saveData: true } }, false)).toBe(false);
    expect(run(gl, { connection: { effectiveType: "slow-2g" } }, false)).toBe(false);
    expect(run(gl, { connection: { effectiveType: "4g" } }, false)).toBe(true);
    expect(run(gl, { deviceMemory: 1 }, false)).toBe(false);
  });

  it("survives blocked site data", () => {
    const doc = { documentElement: { lang: "", className: "", setAttribute() {} }, querySelector: () => null };
    const storage = { getItem: () => { throw new Error("blocked"); } };
    expect(() => new Function("document", "location", "localStorage", NOT_FOUND_BOOT)(doc, { pathname: "/" }, storage)).not.toThrow();
  });
});
