// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders, TILE_ORIGIN } from "./securityHeaders";

const PROD_API = "https://api.amsterdammetro.nl";

describe("security headers", () => {
  const csp = contentSecurityPolicy(PROD_API);

  it("lets the map and the API load, and nothing else run", () => {
    expect(csp).toContain("script-src 'self';");
    expect(csp).toContain(`connect-src 'self' ${PROD_API} ${TILE_ORIGIN} data:`);
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("starts as report-only, so nothing is blocked yet", () => {
    const h = securityHeaders(PROD_API);
    expect(h["Content-Security-Policy-Report-Only"]).toBe(csp);
    expect(h).not.toHaveProperty("Content-Security-Policy");
  });

  it("is mirrored exactly in render.yaml", () => {
    // Render's dashboard is the real source in production; render.yaml
    // documents it. This keeps the documentation honest.
    // Line endings normalised: a Windows checkout has CRLF.
    const yaml = readFileSync(join(__dirname, "..", "..", "render.yaml"), "utf8").replace(/\r\n/g, "\n");
    for (const [name, value] of Object.entries(securityHeaders(PROD_API))) {
      expect(yaml).toContain(`name: ${name}\n        value: "${value}"`);
    }
  });
});
