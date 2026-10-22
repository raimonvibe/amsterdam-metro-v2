import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { ROUTE_PAGES, routeHtml } from "./src/seo/routeHtml";

/** After the build, write dist/reisinfo/index.html and dist/privacy/index.html:
 *  copies of the entry page whose head already names that page, for crawlers
 *  that read the HTML before (or without) running the app. */
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
      for (const page of ROUTE_PAGES) {
        const dir = join(outDir, page.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "index.html"), routeHtml(index, page));
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), routePages()],
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
  build: {
    // MapLibre and deck.gl are ~1.7MB of the bundle and only change on a
    // dependency bump. In their own fingerprinted chunks they stay cached
    // across app deploys, so returning visitors re-download only app code.
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "maplibre", test: /node_modules[\\/](maplibre-gl|react-map-gl)[\\/]/, priority: 3 },
            { name: "deckgl", test: /node_modules[\\/](@deck\.gl|@luma\.gl|@loaders\.gl|@math\.gl|@probe\.gl)[\\/]/, priority: 2 },
            { name: "vendor", test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
});
