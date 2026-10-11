import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
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
