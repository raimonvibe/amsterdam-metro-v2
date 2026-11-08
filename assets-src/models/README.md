# 3D models (sources)

Original files, kept out of the published site. The site serves optimized copies from `frontend/public/models/`.

## S1/S2 metro (`s12_metro_for_cities_skylines.glb`)

- **Title:** [S1/2 Metro for Cities Skylines](https://sketchfab.com/3d-models/s12-metro-for-cities-skylines-e5eef97cc78340d49fb6d4b7f6e77c52)
- **Author:** [accessviolation](https://sketchfab.com/accessviolation)
- **License:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/): credit the author, no commercial use, adaptations under the same license.
- **What it is:** the S1/S2 series of the Amsterdam metro (1990–2024), in metro configuration. 3,134 triangles, two 1k PNG textures. Downloaded as GLB from Sketchfab on 8 Nov 2026.
- **Used on:** the 404 page (`frontend/src/notfound/`).

### The optimized copy: `frontend/public/models/s12-metro.glb`

An adaptation, licensed **CC BY-NC-SA 4.0** like the original. Changes: textures re-encoded as WebP, geometry quantized. Shape and textures otherwise unchanged; all 3,134 triangles kept. 532 KB → 153 KB (60 KB gzipped).

No meshopt or Draco geometry compression: both decode with WebAssembly, which the site's Content Security Policy would have to allow (`'wasm-unsafe-eval'`). Meshopt would save ~16 KB gzipped; not worth loosening the policy.

Made with [glTF-Transform](https://gltf-transform.dev/) 4.5.1:

```bash
npx @gltf-transform/cli@4.5.1 optimize s12_metro_for_cities_skylines.glb s12-metro.glb --texture-compress webp --texture-size 1024 --compress quantize --simplify false
```

**Before any commercial use of the site** (ads, paid features, promotion of a paid service), check the NonCommercial condition, or replace the model.

### The still image: `frontend/public/models/s12-metro-poster.webp`

Shown at once on the 404 page, and kept for visitors who don't get the 3D (no WebGL 2, Data Saver, a 2G connection, little memory). Rendered from the 3D scene itself, so the two match: build, run `npm run preview` in `frontend/`, open `http://localhost:4173/reisinfo/x?poster`, wait for the train, run `__capturePoster()` in the console and save the returned WebP data URL as the file. 1280 × 800, transparent background.
