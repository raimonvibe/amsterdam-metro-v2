import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { ROUTE_PAGES, STATION_PAGES, routeDir, routeHtml, sitemapXml, stationHtml } from "./src/seo/routeHtml";
import { MODEL, NOT_FOUND_BOOT, notFoundHtml } from "./src/seo/notFound";
import { securityHeaders } from "./src/securityHeaders";

/** After the build, write dist/<page>/index.html for every page besides the
 *  Dutch homepage (reisinfo, privacy, en, en/reisinfo, en/privacy, and each
 *  station's page): copies of the entry page whose head already names that
 *  page and language, for crawlers that read the HTML before (or without)
 *  running the app. Also the sitemap and the 404 page. */
function routePages(): Plugin {
  let outDir = "dist";
  let publicDir = "public";
  // The 404 page's script, a separate entry (src/notfound/page.ts): its
  // hashed file name is only known once the bundle is written.
  let notFoundScript = "";
  // Its tiny head script, which picks the language and theme before the
  // first paint (a file, not inline: the CSP allows only 'self' scripts).
  let notFoundBoot = "";
  return {
    name: "route-pages",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
      publicDir = config.publicDir;
    },
    generateBundle(_, bundle) {
      const ref = this.emitFile({ type: "asset", name: "notfound-boot.js", source: NOT_FOUND_BOOT });
      notFoundBoot = `/${this.getFileName(ref)}`;
      for (const file of Object.values(bundle)) {
        if (file.type === "chunk" && file.isEntry && file.name === "notfound") notFoundScript = `/${file.fileName}`;
      }
    },
    closeBundle() {
      if (!notFoundScript) throw new Error("route-pages: the 404 page's script (entry 'notfound') was not built");
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
      writeFileSync(
        join(outDir, "404.html"),
        notFoundHtml({
          script: notFoundScript,
          boot: notFoundBoot,
          hasPoster: existsSync(join(publicDir, MODEL.poster)),
          hasTrackPoster: existsSync(join(publicDir, MODEL.trackPoster)),
        }),
      );
    },
  };
}

/**
 * `npm run preview` answers like the live site's routing (render.yaml, and
 * Render's own behaviour as tested on 8 Nov 2026): a page's address serves
 * its built index.html, and an address with no page gets 404.html with
 * status 404. Vite's own fallback would serve the
 * homepage everywhere, hiding exactly what these rules are for.
 */
function liveRouting(): Plugin {
  return {
    name: "live-routing",
    configurePreviewServer(server) {
      const outDir = server.config.build.outDir;
      server.middlewares.use((req, res, next) => {
        const [path, query = ""] = (req.url ?? "/").split("?");
        const notFound = () => {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(readFileSync(join(outDir, "404.html")));
        };
        // Page addresses are plain: letters, digits, dashes, slashes. Anything
        // else ("..", "%2f", "\\") gets the 404 page without touching the disk,
        // so the preview can't be used to probe or reach files outside dist.
        if (!/^[a-z0-9/_-]*$/i.test(path) || path.includes("//")) {
          // Files (/assets/x.js, /sitemap.xml) may have dots, but no "..".
          const plainFile = /^[a-z0-9/_.-]*\.[a-z0-9]+$/i.test(path) && !path.includes("..") && !path.includes("//");
          return plainFile ? next() : notFound();
        }
        if (path === "/" || /\.[a-z0-9]+$/i.test(path)) return next();
        // Like Render: a folder's index.html is served at its address with a
        // trailing slash (/reisinfo/zuid/), or where a rewrite rule names it
        // (the site pages: /reisinfo, /en/privacy, …). /reisinfo/zuid is not.
        const ruled = ROUTE_PAGES.some((r) => `/${routeDir(r)}` === path);
        const page = `${path.replace(/\/+$/, "")}/index.html`;
        if ((path.endsWith("/") || ruled) && existsSync(join(outDir, page))) {
          req.url = page + (query ? `?${query}` : "");
          return next();
        }
        notFound();
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
      // The app, and the 404 page's own small script (see routePages()).
      input: { index: "index.html", notfound: "src/notfound/page.ts" },
      output: {
        codeSplitting: {
          groups: [
            // Vite's lazy-loading helper is shared by every dynamic import.
            // Left to the groups below it landed in the deck.gl chunk, so the
            // first lazy import fetched all of deck.gl (240 KB) with it, even
            // for the preview still that never draws the map.
            { name: "preload-helper", test: /preload-helper/, priority: 4 },
            // three.js is only for the 404 page's train: never in the shared
            // vendor chunk, which every page of the app loads.
            { name: "three", test: /node_modules[\\/]three[\\/]/, priority: 5 },
            { name: "maplibre", test: /node_modules[\\/](maplibre-gl|react-map-gl)[\\/]/, priority: 3 },
            { name: "deckgl", test: /node_modules[\\/](@deck\.gl|@luma\.gl|@loaders\.gl|@math\.gl|@probe\.gl)[\\/]/, priority: 2 },
            { name: "vendor", test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
