# English URLs: questions and answers

Written 2 Nov 2026, before building anything. The trigger: in a Dutch
incognito search for "amsterdam metro", amsterdammetro.nl shows up on
page 2 with a "Vertaal deze pagina" link under it, as if the page were
not Dutch.

## Why Google thinks the page is English

`detect()` in `frontend/src/i18n/index.ts` switches the whole UI to
English when the browser doesn't list Dutch. Googlebot usually crawls
from the US and sends no `Accept-Language`, so it runs the app in
English and indexes English text. Google decides a page's language from
the visible text, not from `<html lang>` or the URL, so `lang="nl"` in
`index.html` doesn't help.

## Questions

### 1. Is the audience Dutch or international?

We don't know, and the site has no analytics on purpose (see
`docs/privacy-policy.md`). What we do know:

- Amsterdam had about 9.5 million hotel, campsite and holiday-park
  guests in 2025, and roughly 80% of them came from abroad (my
  calculation from CBS figures, not an official share).
- No public figure exists for the share of tourists on the GVB metro.
  Commuters and residents make up most of its riders.
- The search results themselves are a clue. For "amsterdam metro" in a
  Dutch browser, half of Google's first page is English (amsterdamtips,
  amsterdam.info, iamsterdam, travelguide, discoverholland, English
  Wikipedia). Google treats that search as partly an English one.
- The site already has an English UI and English GVB messages, which
  `docs/feature-options.md` added for visitors.

**The data that decides it is in Search Console:** Performance →
Countries, and Performance → Queries (English vs Dutch search terms).
Look at that before choosing.

### 2. Could a separate English URL fail, and why?

These are real ways it could go wrong:

1. **Google may treat `/en/` as a duplicate.** Google only counts
   localized pages as duplicates when the main content is
   untranslated. Here the main content is a map and a list of station
   names, which are the same in both languages. The UI text, `<noscript>`
   text, title and description will be English, but the page has
   little text overall. Search Console's URL Inspection shows which
   canonical Google picks.
2. **The English page may not rank anyway.** The ranking problem for
   "amsterdam metro" is mostly authority: GVB, Wikipedia and the city
   are above us in both languages. An English page wins nothing
   against iamsterdam unless people link to it.
3. **The Dutch problem can be fixed without it.** Serving Dutch to
   crawlers (the small fix) already removes "Vertaal deze pagina" for
   Dutch searchers.
4. **hreflang mistakes fail silently.** If one side of a pair is
   missing, Google ignores the tags without saying so. Tests are the
   guard here.
5. **Render rewrites live in the dashboard.** If the three rewrites
   aren't added, `/en/reisinfo` serves the Dutch homepage's head. The
   PR has to say so loudly.

### 3. Can't people use Google Translate instead?

Mostly no, for this site:

- **The "Vertaal deze pagina" link in Google Search gives a blank page.**
  Tested 2 Nov 2026: `amsterdammetro-nl.translate.goog` loads, but the
  browser blocks every script and stylesheet from `amsterdammetro.nl`
  (no CORS header) and every API call (`CORS_ORIGINS` only allows
  amsterdammetro.nl). Nothing renders. With only a Dutch page indexed,
  this is what English searchers would get if they clicked "Translate
  this page".
- **Chrome's built-in translation** runs on the real domain, so the app
  loads. But it rewrites text nodes, which is a known cause of React
  crashes (`removeChild`/`insertBefore` errors, facebook/react#11538),
  and this app updates text every few seconds. Not tested here.
- **No translator touches the map.** Labels drawn in WebGL are pixels,
  not text.

So a real English page is the only way to give English searchers a
working site.

### 4. Why not translate "reisinfo" in the URL?

The plan keeps `/en/reisinfo` instead of `/en/travel`. Reasons:

- Google doesn't use the URL to decide a page's language, and words in
  the URL are a very small ranking signal.
- One path table, one prefix: switching language is "add or remove
  `/en`", for the app, the hreflang pairs, the sitemap and the Render
  rewrites.
- A shared link with `?station=…` keeps working when switching.

The cost: English searchers see a Dutch word in the result's URL. If
that matters, `/en/travel` is a small change (a mapping table, one
more rewrite, one more test). It's a style choice, not a technical
requirement.

### 5. Do we show too many pages on Google?

No. Google treats an hreflang pair as one page in two languages: a
searcher sees the version in their language, not both. Indexed pages
go from 2 (`/`, `/reisinfo`) to 4. The privacy pages stay `noindex`.
That's far too small to matter for crawling or ranking.

## Options

| | Crawlers get Dutch | Separate `/en/` URLs |
|---|---|---|
| Removes "Vertaal deze pagina" for Dutch searchers | Yes | Yes |
| English searchers get a working page | No: "Translate this page" is blank | Yes |
| Can rank for English searches | No | Yes, if authority allows |
| Work | A few lines + 1 test | ~10 files + tests + 3 Render rewrites |
| Risk | Very low | Duplicate/hreflang mistakes, caught by tests and URL Inspection |

## Decision

Build `/en/` directly (2 Nov 2026). The code is small, the English UI
already existed, and the small fix would have been thrown away: once the
URL decides the language, crawlers get Dutch at `/` anyway. Current
Search Console data can't settle the audience question either, because
Google has been indexing the English UI.

## How it works

- **The URL decides the language.** `/en/…` is English, every other path
  Dutch (`frontend/src/i18n/paths.ts`). The browser's language never picks
  the language, so Googlebot gets Dutch at `/` and English at `/en/`.
- **A saved choice wins.** Someone who picked a language with the EN/NL
  button is moved to that language's URL on their next visit (same page,
  query and hash). Crawlers have no saved choice.
- **EN/NL is a real link** to the other version (`hreflang` set), so
  crawlers find both; a plain click switches in place.
- **English hint.** A browser that doesn't list Dutch gets a small
  "English ×" pill under the menu button on its first visit. No automatic
  redirect, as Google advises. Tapping it switches; × hides it for good.
  It sits under the menu button rather than top centre, because the LIVE
  badge widens to "Dienstregeling" when the feed is down.
- **Built pages.** The build writes `en/`, `en/reisinfo/` and
  `en/privacy/` next to the Dutch ones, each with its own `lang`, title,
  description, canonical, `og:locale`, `<noscript>` text and the same
  hreflang set as its Dutch twin (`frontend/src/seo/routeHtml.ts`).
- **Sitemap** lists `/`, `/en/`, `/reisinfo`, `/en/reisinfo`. hreflang
  lives in the HTML only (one method, as Google suggests).
- **Render** needs four extra rewrites in the dashboard; see
  [render-deploy-plan.md](render-deploy-plan.md#spa-routing).
- **The WebGL error** is now translated: it was fixed English text.

`routeHtml.test.ts` checks every page's head, the hreflang pairs, that
every built page has a Render rewrite and a no-cache header, and that the
sitemap lists exactly the indexed pages. `i18n.test.tsx` checks that an
English-only browser gets Dutch at `/`.

## After deploy

1. Search Console → URL Inspection → **Test live URL** on `/` and `/en/`.
   The screenshot of `/` should be Dutch, `/en/` English, and Google's
   chosen canonical should be each page itself.
2. Resubmit `sitemap.xml`.
3. Over the next weeks: "Vertaal deze pagina" should go from the Dutch
   result, and Performance → Countries/Queries shows whether `/en/` picks
   up English searches.

## Sources

- Google: [Tell Google about localized versions of your page](https://developers.google.com/search/docs/specialty/international/localized-versions)
- Google: [Managing multi-regional and multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites)
- CBS: [Fewer overnight stays by Dutch guests, more international visitors in 2025](https://www.cbs.nl/en-gb/news/2026/16/fewer-overnight-stays-by-dutch-guests-more-international-visitors-in-2025)
- NL Times: [52 million tourists stayed in Dutch hotels, holiday parks, campsites in 2025](https://nltimes.nl/2026/04/17/52-million-tourists-stayed-dutch-hotels-holiday-parks-campsites-2025)
- React: [Google Translate crashes (facebook/react#11538)](https://github.com/facebook/react/issues/11538)
