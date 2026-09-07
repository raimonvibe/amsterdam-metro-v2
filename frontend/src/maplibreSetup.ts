import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

// v6 is ESM-only. Vite must bundle the worker via ?worker&url so production
// builds include maplibre-gl-shared.mjs instead of a bare worker that 404s.
setWorkerUrl(workerUrl);
