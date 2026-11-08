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

### The empty track: `frontend/public/models/s12-track-poster.webp`

The same view without the train (only the site's own track, no part of the model). Shown first where the 3D will run, so the 3D train can roll in on it without the swap showing. Made the same way with `__capturePoster(false)`; `s12-track-poster-dark.webp` likewise, with a dark map style chosen in the app (dark visitors get that one). The two images were last rendered in headless Chrome with software WebGL (`--use-angle=swiftshader`); a GPU gives the same picture.

## Rails (`rails.glb`)

- **Title:** [Rails](https://sketchfab.com/3d-models/rails-09b595cfd94e45fcae81d247f303f88a)
- **Author:** [Daniel Yaroshenko](https://sketchfab.com/yarodan)
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/): credit the author; commercial use allowed.
- **What it is:** one straight segment of standard-gauge track: two rails with fishplates on ten concrete sleepers. 7,048 triangles; base colour, normal and occlusion/roughness/metalness maps. Sketchfab's GLB with 1k textures (4.3 MB), downloaded 8 Nov 2026. The 4k download (53 MB) has the same geometry and isn't needed at this size on screen.
- **Used on:** the 404 page, under the S1/S2 (`frontend/src/notfound/scene.ts`), repeated along the track to the train's scale (standard gauge over the S1/S2's 3.0 m width).

### The web copy: `frontend/public/models/rails.glb`

An adaptation, licensed **CC BY 4.0** like the original. Changes: the node transforms baked in and the segment brought to a unit size (rails along +x ending at x = 0, gauge 1, rail tops at y = 0; its length in gauges in `extras.segment`); tangents dropped (three.js derives them); the specular map dropped; textures re-encoded as WebP, the occlusion/roughness/metalness map at 512 px; geometry quantized (`KHR_mesh_quantization`, which three.js reads without WebAssembly). Shape otherwise unchanged; all 7,048 triangles kept. 4.3 MB → 331 KB (234 KB gzipped).

Made with three.js's own `GLTFExporter` and a small script, as the glTF-Transform CLI wasn't at hand:

1. From the repository root, serve the files: `python3 -m http.server 8790 --bind 127.0.0.1` (with `npm ci` done in `frontend/`).
2. Open `http://127.0.0.1:8790/assets-src/models/rails-web/bake.html` and download `rails-unquantized.glb`.
3. `python3 assets-src/models/rails-web/quantize.py rails-unquantized.glb frontend/public/models/rails.glb`

After a change to the rails or the track, render the three still images again (above).
