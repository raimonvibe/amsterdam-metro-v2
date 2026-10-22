import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTE_PAGES, routeHtml } from "./routeHtml";

// The real entry page, so a change to its head is caught here too. Vitest
// runs from frontend/ (the test environment is jsdom, so no file: import.meta.url).
const INDEX = readFileSync(join(process.cwd(), "index.html"), "utf8");

describe("routeHtml", () => {
  it("gives each route its own title, description, canonical and social tags", () => {
    for (const page of ROUTE_PAGES) {
      const html = routeHtml(INDEX, page);
      const url = `https://amsterdammetro.nl${page.path}`;
      expect(html).toContain(`<link rel="canonical" href="${url}" />`);
      expect(html).toContain(`<meta property="og:url" content="${url}" />`);
      expect(html).toContain(`<title>${page.title.replace(/&/g, "&amp;")}</title>`);
      expect(html.match(/content="([^"]*)"/g)?.join("\n")).toContain(page.description);
      expect(html).not.toContain('href="https://amsterdammetro.nl/" />');
      expect(html).not.toContain("Live metrokaart &amp; metro map");
    }
  });

  it("leaves the rest of the page alone", () => {
    const html = routeHtml(INDEX, ROUTE_PAGES[0]);
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(html).toContain('<meta property="og:image" content="https://amsterdammetro.nl/social-share.png" />');
  });

  it("fails loudly when the page no longer has a tag it must rewrite", () => {
    const noCanonical = INDEX.replace(/<link rel="canonical"[^>]*>/, "");
    expect(() => routeHtml(noCanonical, ROUTE_PAGES[0])).toThrow(/canonical/);
  });
});
