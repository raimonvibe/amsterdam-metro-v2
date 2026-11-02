# Adaptive 3D: full map everywhere, with a fallback that holds

Written 2 Nov 2026. The goal: the 3D map with buildings, trails and the
opening flight on every device that can draw it, and a fast, still-3D
experience on those that can't, without changing what search engines read.

## What decides it

`frontend/src/quality.ts`:

| Situation | What the visitor gets |
|---|---|
| Graphics chip (almost every phone and laptop) | **Full**: 3D buildings, motion trails, opening flight |
| Same, but the map can't keep up (median frame over 50 ms while it settles) | First 1 pixel per CSS pixel, then **Light** |
| Browser asks to save data | **Light** from the start |
| No graphics chip (SwiftShader, llvmpipe, Basic Render Driver) | A **still of the 3D map**, with "Start the live 3D map" |
| No WebGL at all | A short note and a button to the travel page |
| Visitor picked Full or Light in the menu | That, always |

**Light** is still the tilted 3D map with the trains and their glow. It
leaves out the extruded buildings (hidden, so MapLibre skips them when it
builds tiles), the motion trails and the opening flight, draws at 1 pixel
per CSS pixel, updates trains 4 times a second instead of 30, and doesn't
fade tiles in.

The frame-rate watch runs only on "auto", for 15 s after the map is ready,
on the device. Nothing is sent or stored. It never steps back up by itself,
so the map doesn't flip between modes.

## Why a still for GPU-less browsers

Measured with Lighthouse 13.5 and a CPU profile in headless Chrome
(SwiftShader), 2 Nov 2026:

- The page **hung**: Lighthouse gave up ("page appears to be hung").
- The cost was not the buildings or the frame rate: Light and Full blocked
  the page equally (16–21 s in the first 20 s).
- A CPU profile showed why: 16.8 s inside the browser and 1.6 s in deck.gl's
  `createRenderPipeline`, i.e. **compiling the map's shaders**. With a
  graphics chip that takes milliseconds; in software it is one block of
  10–17 s. luma.gl compiles in the background only where the browser offers
  `KHR_parallel_shader_compile`, which software rendering doesn't.

No setting of the live map avoids that, so those browsers open on a still
(`components/MapPoster.tsx`): the real map, rendered at its opening view,
per map style, landscape and portrait (`frontend/public/poster/`, made by
`scripts/render-posters.mjs`). The map's code isn't even downloaded until
the visitor starts it.

## Result

Lighthouse 13.5, mobile, headless Chrome without a graphics chip (as
PageSpeed Insights and Googlebot render), local build, 2 Nov 2026:

| | Before | After |
|---|---|---|
| Page | **hung** (Lighthouse gave up) | loads |
| Performance | – (26 when it got through) | **57–66** |
| First Contentful Paint | 4.6 s | **1.8 s** |
| Speed Index | 28–31 s | **1.8 s** |
| Total Blocking Time | 96–111 s | **0.6–1.1 s** |
| Downloaded | 3.1 MB | **0.95 MB** |
| Accessibility / SEO | – | 100 / 100 |

Two build fixes made the difference for every visitor, not only the
preview: MapLibre's worker setup moved from `main.tsx` into the map's
module, and Vite's lazy-loading helper got its own chunk (it had landed in
the deck.gl chunk, so any lazy import fetched all of deck.gl). The first
page now loads React, the translations and the app; MapLibre and deck.gl
come with the map.

Still on every visit, worth a separate fix: `favicon.ico` (135 KB),
`social-share.png` (189 KB, as the touch icon) and the preloaded map data
(`/api/shapes`, 190 KB) even when only the still shows.

## Search engines

Googlebot and Bingbot render without a graphics chip, so they get the still.
That isn't cloaking: the browser's capability decides, not who is asking, and
every GPU-less visitor gets the same. The page's text, which is what search
engines index, is the same in every mode (checked: 457 words on `/en/`
without WebGL, none of it from the map). See
[english-urls.md](english-urls.md) and Google's
[spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
(cloaking is showing search engines *different content* to manipulate
rankings).

## Privacy

The 3D choice (Full or Light) is kept in localStorage as `metro-live:3d`;
"auto" keeps nothing. It is in both privacy policies and
`frontend/src/legal/storage.ts`.

## Not measured

How Light feels on a real slow phone *with* a graphics chip: this machine
draws in software. Check on a cheap Android phone before tuning
`SLOW_FRAME_MS` or `LITE_FRAME_MS`.
