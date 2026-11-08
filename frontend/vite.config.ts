import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { ROUTE_PAGES, STATION_PAGES, routeDir, routeHtml, sitemapXml, stationHtml } from "./src/seo/routeHtml";
import { notFoundHtml } from "./src/seo/notFound";
import { securityHeaders } from "./src/securityHeaders";

/** After the build, write dist/<page>/index.html for every page besides the
 *  Dutch homepage (reisinfo, privacy, en, en/reisinfo, en/privacy, and each
 *  station's page): copies of the entry page whose head already names that
 *  page and language, for crawlers that read the HTML before (or without)
 *  running the app. Also the sitemap and the 404 page. */
function routePages(): Plugin {
  let outDir = "dist";
  return {
    name: "route-pages",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const index = readFileSync(join(outDir, "index.html"), "utf8");
      const write = (dir: string, html: string) => {
        mkdirSync(join(outDir, dir), { recursive: true });
        writeFileSync(join(outDir, dir, "index.html"), html);
      };
      for (const route of ROUTE_PAGES) write(routeDir(route), routeHtml(index, route));
      // One page per station and language: /reisinfo/zuid, /en/reisinfo/zuid.
      for (const page of STATION_PAGES) write(page.dir, stationHtml(index, page));
      writeFileSync(join(outDir, "sitemap.xml"), sitemapXml());
      // Served with status 404 for every address no file or rule matches.
      writeFileSync(join(outDir, "404.html"), notFoundHtml());
    },
  };
}

/**
 * `npm run preview` answers like the live site's routing rules (render.yaml):
 * a page's address serves its built index.html, and an address with no page
 * gets 404.html with status 404. Vite's own fallback would serve the
 * homepage everywhere, hiding exactly what these rules are for.
 */
function liveRouting(): Plugin {
  return {
    name: "live-routing",
    configurePreviewServer(server) {
      const outDir = server.config.build.outDir;
      server.middlewares.use((req, res, next) => {
        const [path, query = ""] = (req.url ?? "/").split("?");
        if (path === "/" || /\.[a-z0-9]+$/i.test(path)) return next();
        const page = `${path.replace(/\/+$/, "")}/index.html`;
        if (existsSync(join(outDir, page))) {
          req.url = page + (query ? `?${query}` : "");
          return next();
        }
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(readFileSync(join(outDir, "404.html")));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), routePages(), liveRouting()],
  server: {
    host: true,
    port: 5183,
    // Native file events are unreliable for this checkout on Windows (edits
    // were missed and stale modules served); polling is cheap at this size.
    watch: process.platform === "win32" ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      "/api": {
        target: "http://localhost:8020",
        changeOrigin: true,
      },
    },
  },
  // `npm run preview` serves the production build with the live site's
  // security headers, so CSP problems show up before a deploy.
  preview: {
    headers: securityHeaders(process.env.VITE_API_URL ?? "https://api.amsterdammetro.nl"),
  },
  build: {
    // MapLibre and deck.gl are ~1.7MB of the bundle and only change on a
    // dependency bump. In their own fingerprinted chunks they stay cached
    // across app deploys, so returning visitors re-download only app code.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Vite's lazy-loading helper is shared by every dynamic import.
            // Left to the groups below it landed in the deck.gl chunk, so the
            // first lazy import fetched all of deck.gl (240 KB) with it, even
            // for the preview still that never draws the map.
            { name: "preload-helper", test: /preload-helper/, priority: 4 },
            { name: "maplibre", test: /node_modules[\\/](maplibre-gl|react-map-gl)[\\/]/, priority: 3 },
            { name: "deckgl", test: /node_modules[\\/](@deck\.gl|@luma\.gl|@loaders\.gl|@math\.gl|@probe\.gl)[\\/]/, priority: 2 },
            { name: "vendor", test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
