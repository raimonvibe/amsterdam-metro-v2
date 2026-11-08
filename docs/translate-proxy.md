# Plan: the site through Google Translate's website proxy

**Status: planned, not started** (written 2 Nov 2026). Related: [browser-translation.md](browser-translation.md).

## The problem

Google Translate can translate a whole website: paste `amsterdammetro.nl` into translate.google.com, or tap "translate this page" in the Google app or Google Translate on a phone. That opens the site through Google's proxy:

```
https://amsterdammetro-nl.translate.goog/reisinfo?_x_tr_sl=nl&_x_tr_tl=bn&_x_tr_hl=bn
```

**The page stays blank, in every language.** Google's toolbar shows ("Dutch → Bengali"), but the app never starts. The console shows CORS errors:

```
Access to script at 'https://amsterdammetro.nl/assets/i18n-….js' from origin
'https://amsterdammetro-nl.translate.goog' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.

Access to … 'https://api.amsterdammetro.nl/api/stations' from origin
'https://amsterdammetro-nl.translate.goog' has been blocked by CORS policy …
```

Chrome's, Edge's, Safari's and Firefox's **built-in** page translation is not affected: it translates the page in place, on our own origin. Only the proxy breaks.

## Why one fix covers every language

The proxy's origin is **`https://amsterdammetro-nl.translate.goog`** for every target language. The language is only in the query string (`_x_tr_tl=bn`, `uk`, `de`, `ar`, `zh-CN`, … for all 130+ languages Google supports). So allowing that **one origin** fixes the site for all of them. No language list is needed, and none should be added.

(Google forms the host from the domain: dots become `-`, and existing `-` become `--`. `www.amsterdammetro.nl` would be `www-amsterdammetro-nl.translate.goog`. We only serve `amsterdammetro.nl`, so one host.)

## What blocks it, and the fix for each

### 1. Scripts from the static site

The proxy serves our HTML from its origin, but the JavaScript modules and their chunks still come from `https://amsterdammetro.nl/assets/…`. Module scripts and `<link rel="modulepreload">` are always fetched with CORS, so the browser needs `Access-Control-Allow-Origin` on them. We send none.

**Fix:** in `render.yaml`, under `headers`, and in **Render's dashboard** (Settings → Headers: Render does not read `render.yaml`, see the note there):

```yaml
- path: /assets/*
  name: Access-Control-Allow-Origin
  value: https://amsterdammetro-nl.translate.goog
```

These are public, fingerprinted, read-only files, so allowing one more origin to read them exposes nothing. Check whether the manifest, icons or fonts also fail under the proxy. If they do, add the same header for their paths, never for `/*`.

Also add `Vary: Origin` only if we ever allow more than one origin. With one fixed value it isn't needed, and the `immutable` cache on `/assets/*` keeps working.

### 2. The API

The frontend fetches `https://api.amsterdammetro.nl/api/…` (`frontend/src/api.ts`, `API_BASE` from `VITE_API_URL`), plus the live stream (`frontend/src/stream.ts`, EventSource) and the preloads in `index.html` (`<link rel="preload" as="fetch" … crossorigin>`). The backend allows only the origins in `CORS_ORIGINS` (`backend/app/config.py`, used by `CORSMiddleware` in `backend/app/main.py`).

**Fix:** add the proxy origin to `CORS_ORIGINS`:

- `render.yaml`: `value: "https://amsterdammetro.nl,https://www.amsterdammetro.nl,https://amsterdammetro-nl.translate.goog"`
- the same value in Render's dashboard for the API service (Environment)
- `backend/.env.example`, so the documented value matches

The API only allows `GET` (`allow_methods=["GET"]`) and serves public timetable data. One more origin that may read it is no risk. Don't switch to `*` or to a `*.translate.goog` regex: that would let every site proxied by Google read our API.

### 3. Content Security Policy

`frontend/src/securityHeaders.ts` builds the CSP (Report-Only today). Under the proxy, Google serves the page and may send its own headers, so our CSP may not apply there at all. **Check before changing anything:** load the proxied page and see whether a CSP violation report appears for our API or tiles. If our `connect-src` does apply, it already lists `https://api.amsterdammetro.nl` and the tile server by name, which still match under the proxy. `'self'` would mean the proxy then, so nothing should need to change. When the CSP is switched from Report-Only to enforcing (a separate decision), test the proxy again.

`frame-ancestors 'none'` and `X-Frame-Options: DENY` are fine: the proxy shows the page at the top level, not in a frame. If Google ever starts framing it (some app views do), that will show up as a refused frame, and this is where to look.

### 4. What else to check once it loads

- **Language buttons (EN/NL):** under the proxy the page is "translated" by Google, so `pageTranslated()` (`frontend/src/i18n/translated.ts`) should see it and `switchLang` reloads. Check that the reload stays on the proxy URL with its `_x_tr_*` parameters, so the visitor isn't thrown out of their language.
- **Links between pages** (`/reisinfo`, `/en/…`, `/privacy`): the proxy rewrites links in the HTML. The app's own navigation (`history.replaceState`, `pagePath`) builds paths without the `_x_tr_*` query, so check that moving between the map and the travel page keeps the translation.
- **`translate="no"`** (numbers, station names, line badges, GVB search terms): check that the proxy respects it like Chrome does (see browser-translation.md).
- **Map tiles** (`tiles.openfreemap.org`) and the live stream: both should load. Tiles allow any origin.
- **Phones:** Google Translate's website mode on Android and iOS.

## Steps

1. Branch from `main`.
2. API: add the origin to `CORS_ORIGINS` in `render.yaml` and `backend/.env.example`, and add a backend test that a request with `Origin: https://amsterdammetro-nl.translate.goog` gets that origin back in `Access-Control-Allow-Origin`.
3. Static site: add the `/assets/*` header in `render.yaml`. If `securityHeaders.ts` and its test cover `render.yaml`'s headers, add it there too, so they can't drift apart.
4. Open the PR and list what must be set **by hand in Render's dashboard** (the static site's header and the API's `CORS_ORIGINS`). Nothing works until both are set.
5. After deploy, verify (below). Then add a short section to browser-translation.md and a dated note here.

## How to verify

Open these on a phone and on a desktop. Each must show the map or travel page in that language, with live trains and departures:

- Bengali: `https://amsterdammetro-nl.translate.goog/reisinfo?_x_tr_sl=nl&_x_tr_tl=bn&_x_tr_hl=bn`
- Ukrainian: `…&_x_tr_tl=uk&_x_tr_hl=uk`
- Arabic (right to left): `…&_x_tr_tl=ar&_x_tr_hl=ar`
- Chinese: `…&_x_tr_tl=zh-CN&_x_tr_hl=zh-CN`
- The map page: `https://amsterdammetro-nl.translate.goog/?_x_tr_sl=nl&_x_tr_tl=bn`

In the browser console there must be no CORS errors. Then: switch EN/NL, open a station, plan a trip, and go map ⇄ travel page.

## Not in scope

- Our own languages beyond Dutch and English: the browser and Google cover the rest (see browser-translation.md, "Not done, on purpose").
- Making Google's proxy faster or changing how it translates.

## Log

| Date | What |
|---|---|
| 2026-11-02 | Found while checking Bengali on small phones: the proxy shows a blank page (CORS on `/assets/*` and the API). Planned here; not started. |
