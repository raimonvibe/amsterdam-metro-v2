// Renders the preview stills that browsers without a graphics chip see
// instead of the live map (frontend/src/components/MapPoster.tsx): the real
// 3D map at its opening view, per map style, landscape and portrait, saved as
// WebP in frontend/public/poster/. Re-run after a change to the map's look.
//
//   1. Run the backend and the frontend dev server (localhost:5183), so the
//      map has its lines and live trains.
//   2. cd frontend && npm i --no-save puppeteer-core
//   3. node ../scripts/render-posters.mjs            (all styles, ~15 min)
//      node ../scripts/render-posters.mjs dark       (one style)
//
// It uses the installed Google Chrome, which renders headless without a GPU:
// each image takes about 1.5 minutes.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(process.env.PUPPETEER_FROM ?? new URL("../frontend/package.json", import.meta.url));
const puppeteer = require("puppeteer-core");

// fileURLToPath, not .pathname: the checkout path may hold spaces (%20).
const OUT = fileURLToPath(new URL("../frontend/public/poster/", import.meta.url));
const STYLES = process.argv.length > 2 ? process.argv.slice(2) : ["liberty", "bright", "light", "dark", "fiord"];
const SHAPES = {
  landscape: { width: 1600, height: 1000, deviceScaleFactor: 1 },
  portrait: { width: 430, height: 932, deviceScaleFactor: 2 },
};
// Tiles, 3D buildings and the first trains need this long in software.
const SETTLE_MS = 60_000;

mkdirSync(OUT, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
  headless: true,
  protocolTimeout: 300_000,
});
for (const style of STYLES) {
  for (const [shape, viewport] of Object.entries(SHAPES)) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    // Reduced motion: no opening flight, so the map lands on its view at once.
    await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await page.evaluateOnNewDocument((s) => {
      localStorage.setItem("metro-live:3d", "full");
      localStorage.setItem("metro-live:map-style", s);
      localStorage.setItem("metro-lang-hint", "1");
    }, style);
    await page.goto("http://localhost:5183/", { waitUntil: "domcontentloaded", timeout: 120_000 });
    // The map only: no sidebar, buttons, badges or map controls.
    await page.addStyleTag({
      content: `div:has(> aside), nav, main > button, main > div.pointer-events-none, [role="status"],
        .maplibregl-ctrl-bottom-right, .maplibregl-ctrl-bottom-left, .maplibregl-ctrl-top-right { display: none !important; }`,
    });
    await new Promise((r) => setTimeout(r, SETTLE_MS));
    const main = await page.$("main");
    await main.screenshot({ path: `${OUT}${style}-${shape}.webp`, type: "webp", quality: 78 });
    await page.close();
    console.log(`${style}-${shape}.webp`);
  }
}
await browser.close();
