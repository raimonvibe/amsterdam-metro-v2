# 🧹 SEO plan: station pages that tidy the web instead of cluttering it

Written 7 Nov 2026, before anything is built. amsterdammetro.nl averages position **7.7** in Google. The data the site shows was checked the same day and is correct (lift statuses fixed in #221). This plan is about what Google can find, not about the data.

**The worry this plan takes seriously:** adding 39 thin, near-identical pages is clutter, the kind Google calls *doorway pages*. So the rule for every step below is:

> 🧭 **Only add something to the web if it removes a duplicate, fixes a mistake, or answers a question no other page on this site answers.**

Only the safest options are in this plan. Ideas with more risk are listed at the end under [Not in this plan](#-not-in-this-plan-and-why) with the reason.

---

## 🔎 What is wrong today

| # | Finding | Why it matters |
|---|---|---|
| 1 | Google can find only **4 URLs**: `/`, `/en/`, `/reisinfo`, `/en/reisinfo` ([`frontend/public/sitemap.xml`](../frontend/public/sitemap.xml)). | A search like "metro Waterlooplein" or "lift Waterlooplein" has no page to land on. |
| 2 | A station view is `/reisinfo?station=Waterlooplein`, and the served HTML has the generic `/reisinfo` title and `canonical`. | To Google every station view is a copy of `/reisinfo`. |
| 3 | The app adds `&lijn=51`, `&van=…&naar=…` to the address. | Many accidental URLs for the same content: real clutter, already there. |
| 4 | Any path, e.g. `/reisinfo/whatever`, returns **200** with the home page, via the `/*` → `/index.html` rewrite in [`render.yaml`](../render.yaml). | Google can treat made-up URLs as real pages (*soft 404s*). |
| 5 | The sitemap's `lastmod` is written by hand (2026-11-02) and goes stale. | A sitemap that's wrong is noise for search engines. |

---

## ✅ The plan

### Phase 1: cleanup only, nothing new on the web 🧽

**1.1 🚧 A real 404 page**
- Remove the catch-all `/*` → `/index.html` rewrite; keep the rewrites for the real pages.
- Add one `404.html` to the build. It covers every wrong URL, so there's nothing to "count for".
- Look: metro-themed, "Dit station staat niet op de kaart" / "This stop isn't on the map", the line colours, a dead-end track.
- Help: "Bedoelde je Waterlooplein?" from the existing typo-tolerant station search, a station search box, links to the map and Reisinformatie.
- Dutch and English, picked from the `/en/` prefix.
- `<meta name="robots" content="noindex">` and a real **404** status.
- ⚠️ First confirm in Render's docs that a static site serves `404.html` with status 404 when no rule matches. Test with `curl -I` on a preview before merging.
- `?station=` links keep working: query strings are not part of the path, so they still match `/reisinfo`.

**1.2 🗺️ A generated sitemap**
- Build the sitemap from the real pages at build time, not by hand.
- `lastmod` only changes when the page's content really changes, e.g. a station's step-free data or lift check.

**1.3 ⏱️ Keep short-lived content out of Google**
- Departure times, delays and planner results are out of date within minutes.
- Planner URLs (`van`/`naar`) get `noindex` or a canonical to the station page.
- Live times are never put in the prerendered HTML, titles or descriptions, so Google never shows "next metro 21:14" the next day.

**1.4 ✍️ Better titles and descriptions for the pages that exist**
- Use Search Console: find searches where the site is shown but rarely clicked, and rewrite the title and description of `/` and `/reisinfo` for those.
- No new pages.

### Phase 2: one address per station, replacing the duplicates 🚉

**2.1 🔗 One clean URL per station**
- `/reisinfo/waterlooplein` and `/en/reisinfo/waterlooplein`, with `hreflang` between them, for all 39 stations.
- This is **not new content**: it is the station view the app already has, given its own address.
- Every variant (`?station=…`, `&lijn=…`, `&van=…&naar=…`) points to it with `rel="canonical"`. 39 clean URLs replace hundreds of accidental ones.

**2.2 📄 Only station-specific facts in the page, no filler**
- Prerendered: the station's own title, description and canonical, the lines that stop there, step-free status from [`accessibility.json`](../frontend/src/data/accessibility.json), and the link to GVB's lift faults with the search term.
- No generic paragraphs repeated on 39 pages. If a station has nothing of its own to say, it gets `noindex`.
- 🦽 Step-free rules from [`step-free-stations.md`](step-free-stations.md) apply unchanged: never "lift works", only "a lift was seen broken on <date>"; the lift line drops off after 10 days without a check.

**2.3 ↪️ Nicknames forward to the real station**
- "amstel", "bijlmer", "zuid-wtc", "cs" and similar get a permanent 301 redirect to the one real station URL.
- A short, fixed list, kept in the repo. No new pages; anything not on the list lands on the 404 page.

**2.4 🏷️ Structured data on the station page**
- ~~schema.org `SubwayStation` with name and coordinates.~~ Changed 8 Nov: Google has no feature for it. `BreadcrumbList` (Reisinformatie › station) instead.
- Only facts that are already on the page. Accessibility in structured data only with the same "no" default and check date as the page text.

**2.5 🌐 Link to the sources instead of copying them**
- Each station page links to its GVB station page (codes are in [`step-free-stations.md`](step-free-stations.md)).
- No copied text from GVB or anyone else.

### Phase 3: measure, keep or roll back 📊

- After **4–6 weeks**, check Search Console per station URL: indexed, impressions, clicks.
- Stations Google ignores or flags as duplicate get `noindex`, so nothing stays on the web that doesn't help someone.
- If the whole change doesn't help, roll it back: remove the station rewrites and keep the canonicals to `/reisinfo`. Phase 1 stays, since it is cleanup either way.

---

## 🔬 Research, 8 Nov 2026: what makes these pages useful

Done before building, to answer one question: **how do we make the station pages user-friendly?** Three rounds: what works in transit apps worldwide, the software and design behind them, and other angles. Sources are at the end of this section; claims from blogs or vendors are marked as such.

### What works worldwide

- **Departures first, everything else short.** Transit's 6.0 redesign made the next departures big and tappable because small times were hard to read. A widely shared critique of the MTA app: too much information; riders want the station's times and a few details.
- **Lift faults say where, and what to do instead.** TfL's pattern: "[Station]: no step-free access between X and Y due to a faulty lift", often with a workaround, and "check before you travel".
- **Google already shows a station's lines (and sometimes departures) in search.** Departure times alone won't earn a click. Checked step-free status and lift faults in one place are what others don't offer.
- **Per-stop pages work only with real, crawlable content.** Transit's site reportedly grew to ~21,000 programmatic pages (vendor claim). MobilityData saw JavaScript-only pages classed as low quality and left out. AI crawlers often skip JavaScript entirely.
- **Google's spam policies** (scaled content abuse, doorway abuse) judge purpose, not method: pages must differ in substance, not just swap a name. This plan's "only station-specific facts" rule already meets that.

### What Amsterdam's own research says

- The city's **"All Aboard"** project (openresearch.amsterdam, 2023–24) tested trips with wheelchair users: GVB's lift information was **hard to find, unreliable and not fully accessible**; a broken lift can leave someone **stuck on the platform**; planners suggested routes that didn't work.
- In NH Nieuws one wheelchair user said GVB's app is wrong about lifts "nine times out of ten" (one person, not a measurement). NOS quotes GVB: an on-demand minibus can be called when a lift is out.
- GVB replaces all 93 lifts and 177 escalators **from mid-2027**, line 50 first. Stations will lose lifts for weeks; these pages will matter most then.

### Software and design in this field

| Source | Lesson for us |
|---|---|
| **Digitransit** (Helsinki, open source) | A stop's URL opens straight to its board and works as a bookmark or home-screen icon. |
| **OpenTripPlanner** | Accessibility data is mostly yes/no and often incomplete. Our rule (unknown = "no") is stricter than most apps, so say so on the page. |
| **UnlockedMaps** (UW research, 44-person field study) | Three states: step-free, step-free but a lift is out, not step-free. Filtering for accessible stations was the most-used feature. |
| **Transit app** | Shows lift outages as disruptions next to departures, before you travel. |
| **STIB app** (Brussels) | Per station: which stations you can reach by lift. |
| **WMATA screens** (D.C.) | Cycling through outages one at a time was called "a remarkably bad way" to show them: list all of a station's faults at once. |
| **Departure boards** (passenger.tech) | A pause for auto-refresh, with "last updated" shown when paused, helps people with cognitive disabilities and screen-reader users (WCAG 2.2.2). Announce updates politely; reserve assertive announcements for cancellations. |
| **BrokenLifts.org** (Berlin) | Works because operators supply a live feed. Our trigger to stop hand checks: GVB's lifts in NDOV (SIRI-FM). |

### Tech checks

- **Prerendering:** most Vite prerender plugins run a headless browser and would bake live times into the HTML. Keep the existing build step ([`routeHtml.ts`](../frontend/src/seo/routeHtml.ts)) and generate station HTML from the same data the app uses.
- **Render:** docs confirm rules are skipped when a file exists at the path, and Blueprint routes don't remove rules set in the dashboard. Not stated: whether `/x/y` serves `x/y/index.html`, and whether an unmatched path gets `404.html` with status 404 (the community forum says it does). **Both must be tested on the live site after deploy.** Routing rules are typed into the dashboard by hand ([render-deploy-plan.md](render-deploy-plan.md)), so the design needs few rules: one placeholder rule per language, not 78.
- **Structured data:** Google's search gallery has no feature for `SubwayStation`, `TrainStation` or `Place`. Dropped. `BreadcrumbList` is supported and fits.
- **Not needed:** NS's design system (Tractie; its licence is unclear and it's NS branding) and Transitous/MOTIS (a routing engine; we don't route on a server).

### ✏️ Changes to the plan from this research

1. **Station page layout, in order of what people come for:** name and lines → step-free status → live departures per direction → actions → fixed facts (neighbouring stations per line, GVB station page, lift-fault search term).
2. **Three visible states**, the same everywhere (station page, lists, planner): ✅ step-free, ⚠️ step-free but a lift is out, ❌ not step-free.
3. **"Niet stapvrij" explains itself:** it also covers "not confirmed by GVB".
4. **A lift out comes with an alternative:** the nearest step-free station on the same line, in each direction.
5. **Step-free reachable from here:** on each station page, the step-free stations reachable without a change.
6. **A "step-free only" filter** in the station list, instead of a separate step-free page (no new URLs).
7. **Live departures:** a pause button for auto-refresh, the "bijgewerkt" time, polite announcements.
8. **Static HTML says only the stable facts:** lines, neighbours, GVB's own rating and the link to GVB's lift faults. Lift faults load in the browser, so they still disappear 10 days after a missed check.
9. **Nicknames:** no redirect for ambiguous ones ("amstel" is 3 stations).
10. **Structured data:** `BreadcrumbList` instead of `SubwayStation`.
11. **Routing:** `/reisinfo/:station` → `/reisinfo/:station/index.html`, one rule per language; unknown stations get the 404 page.
12. **Sitemap:** generated, without `lastmod`. A missing date is better than a wrong one, and nothing per station records when its content changed.
13. **Phase 3:** besides Search Console, ask wheelchair users (for example via the All Aboard team) to try the pages.

<details>
<summary>Sources</summary>

[Transit 6.0](https://help.transitapp.com/article/546-transit-6-0-quick-start-guide) ·
[MTA app critique](https://unpixelated.substack.com/p/the-official-mta-app-is-disappointing) ·
[TfL step-free data](https://techforum.tfl.gov.uk/t/new-data-step-free-lift-status-and-accessible-routes-in-stations/1609) ·
[TfL lifts & closures](https://tfl.gov.uk/status-updates/stations-lifts-and-escalators-works-and-closures) ·
[Google: departures](https://support.google.com/maps/answer/6142130?hl=en) ·
[Transit SEO case study (vendor)](https://aioseo.com/trends/transit-seo-case-study/) ·
[MobilityData](https://dev.to/feed/mobilitydata) ·
[Doorway pages](https://ppc.land/doorway-pages/) ·
[Scaled content abuse](https://ppc.land/scaled-content-abuse/) ·
[All Aboard workshop](https://openresearch.amsterdam/image/2024/5/22/research_workshop_all_aboard.pdf) ·
[All Aboard field study](https://openresearch.amsterdam/image/2024/5/22/field_study_all_aboard.pdf) ·
[NOS](https://nos.nl/l/2545215) ·
[NH Nieuws](https://www.nhnieuws.nl/nieuws/342884/de-lift-nemen-bij-de-amsterdamse-metro-bij-een-ruim-derde-van-stations-kan-het-niet) ·
[NH Nieuws: lift replacement](https://www.nhnieuws.nl/nieuws/350636/gvb-gaat-alle-93-liften-en-177-roltrappen-vervangen) ·
[Digitransit](https://digitransit.fi/en/accessibility) ·
[OpenTripPlanner](https://docs.opentripplanner.org/en/latest/Accessibility/) ·
[UnlockedMaps](https://www.newswise.com/pdf_docs/166602228297733_assets-2022-unlockedmaps.pdf) ·
[Transit NY](https://medium.com/transit-new-york/theres-not-an-app-for-that-83fbdadedd7b) ·
[STIB](https://brusselstimes.com/85516/updated-stib-app-will-show-which-metro-stations-elevators-are-broken-mivb-tram) ·
[GGWash](https://ggwash.org/view/38808/metros-inefficient-info-displays-worsen-crowding) ·
[Pausing departure boards](https://releases.passenger.tech/2022/07/19/pausing-auto-refresh-for-website-departure-boards/) ·
[BrokenLifts](https://www.europeandataportal.eu/fi/news/better-travel-planning-brokenliftsorg) ·
[Render rewrites](https://render.com/docs/redirects-rewrites) ·
[Render 404 (forum)](https://community.render.com/t/custom-404-error-page/746) ·
[Google search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)

</details>

---

## 🚫 Not in this plan, and why

| Idea | Why it's left out for now |
|---|---|
| ✏️ Fix OpenStreetMap's wrong wheelchair tags (7 of 39) | Editing someone else's data is a separate responsibility with its own rules. Do it by hand, as its own task, if at all. |
| 📦 Publish the step-free list as open data | People could build on it as if it were live. Lift data is checked by hand weekly and can be days old. |
| 📝 Station "guides" or text written for SEO | That is exactly the clutter this plan avoids. |
| 🔁 Automated lift checks against gvb.nl | Not allowed: [`AGENTS.md`](../AGENTS.md) forbids scripting requests to gvb.nl. |
| 🤖 Pages per line, per exit, per neighbourhood | More thin pages. Reconsider only if Phase 3 shows the station pages help. |
| ♿ A separate step-free overview page | A filter in the existing station list does the same without a new URL. |
| 🚪 Exits and best carriage (Citymapper-style) | Tourists like it, but there's no reliable data for Amsterdam yet; it would be filler. |
| 🏷️ `SubwayStation` structured data | Google has no feature for it (search gallery, checked 8 Nov). |

---

## 🧪 Done means

- [ ] `curl -I https://amsterdammetro.nl/does-not-exist` returns **404**, and the page has `noindex`. *Built and checked locally with `npm run preview`; on the live site after deploy and after deleting the `/*` rule in Render's dashboard ([render-deploy-plan.md](render-deploy-plan.md#routing-dashboard)).*
- [ ] `curl https://amsterdammetro.nl/reisinfo/waterlooplein` shows a station-specific `<title>`, description and canonical without JavaScript. *Built and checked locally; live after deploy.*
- [x] `?station=Waterlooplein&lijn=51` has a canonical to `/reisinfo/waterlooplein`: the app moves the station into the path and sets the canonical without the query.
- [x] The sitemap is generated and lists only real, indexable URLs (82, no `lastmod`).
- [x] No live times in any prerendered HTML (tested in `routeHtml.test.ts`).
- [x] `npm test` and the type check (`tsc -b`) pass in `frontend/`.
- [ ] A Search Console check is noted below 4–6 weeks after release.
- [ ] Wheelchair users (for example via the All Aboard team) have tried a station page.

## 🗒️ Log

| Date | What | Result |
|---|---|---|
| 2026-11-07 | Plan written | Nothing built yet |
| 2026-11-08 | Research added (UX, software, tech), plan refined | See "Changes to the plan from this research" |
| 2026-11-08 | Phases 1 and 2 built, with research changes 1–12 | Station pages for 39 stations × 2 languages, generated sitemap, standalone 404 page with "did you mean", no catch-all, step-free details on the board (three states, alternatives, reachable stations), pause button, step-free filter. Not yet deployed; 1.4 (titles from Search Console data) still to do. Nicknames are handled by the 404 page's suggestions instead of 301s: no dashboard rules needed. |
