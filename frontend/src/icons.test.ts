import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Vitest runs from frontend/.
const PUBLIC = join(process.cwd(), "public");
const INDEX = readFileSync(join(process.cwd(), "index.html"), "utf8");
const size = (file: string) => statSync(join(PUBLIC, file)).size;

describe("site icons", () => {
  // Every visit fetches the favicon and the touch icon. They were 135 KB and
  // 189 KB (the 1024 px share image doubled as touch icon); sized for where
  // they show, they're a tenth of that.
  it("stay small enough to load on every visit", () => {
    expect(size("favicon.ico")).toBeLessThan(30_000);
    expect(size("apple-touch-icon.png")).toBeLessThan(30_000);
    expect(size("icon-192.png")).toBeLessThan(30_000);
    // Loaded on install, not every visit; still keep it off the 1024 px share image.
    expect(size("icon-512.png")).toBeLessThan(80_000);
  });

  it("keep the favicon at /favicon.ico, with a size over 48 px for Google's result icon", () => {
    // Google asks for a stable favicon URL and recommends more than 48x48.
    expect(INDEX).toContain('<link rel="icon" href="/favicon.ico"');
    const ico = readFileSync(join(PUBLIC, "favicon.ico"));
    const sizes = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + i * 16] || 256);
    expect(sizes).toEqual(expect.arrayContaining([16, 32, 48]));
    expect(Math.max(...sizes)).toBeGreaterThan(48);
  });

  it("point the page and the app manifest at files that exist", () => {
    for (const href of [...INDEX.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="\/([^"]+)"/g)].map((m) => m[1])) {
      expect(existsSync(join(PUBLIC, href)), href).toBe(true);
    }
    const manifest = JSON.parse(readFileSync(join(PUBLIC, "manifest.webmanifest"), "utf8"));
    for (const icon of manifest.icons) expect(existsSync(join(PUBLIC, icon.src.slice(1))), icon.src).toBe(true);
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(["192x192", "512x512"]);
  });

  it("keep the 1024 px image for link previews only", () => {
    expect(INDEX).not.toContain('href="/social-share.png"');
    expect(INDEX).toContain('<meta property="og:image" content="https://amsterdammetro.nl/social-share.png" />');
  });
});
