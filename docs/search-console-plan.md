# 🔍 Search Console plan: answer what people search for

Written 8 Nov 2026 from a Google Search Console export of the site's top queries (last 24 hours, 7 days and 28 days). It builds on [seo-tidy-plan.md](seo-tidy-plan.md) and keeps its rule:

> 🧭 **Only add something to the web if it removes a duplicate, fixes a mistake, or answers a question no other page on this site answers.**

---

## 📥 The data

Queries as exported: clicks, then impressions. "—" means the export was cut off before the numbers.

**Last 24 hours**

| Query | Clicks | Impressions |
|---|---:|---:|
| centraal station metro station 1012 ab amsterdam, netherlands | 0 | 2 |
| tijden metro amsterdam | 0 | 1 |
| metro last service time | 0 | 1 |
| hoe laat gaat de laatste metro in amsterdam | 0 | 1 |
| metro 51 centraal station | 0 | 1 |
| metro station | 0 | 1 |
| what time does metro stop in amsterdam | 0 | 1 |
| metro sloterdijk | 0 | 1 |
| reigersbos metro station | — | — |

**Last 7 days**

| Query | Clicks | Impressions |
|---|---:|---:|
| laatste metro amsterdam | 0 | 2 |
| metrotijden | 0 | 2 |
| are the metros running today | 0 | 2 |
| rijd metro 53 vandaag | 0 | 2 |
| amsterdam metro times | 0 | 1 |
| amsterdam centraal live departures | 0 | 1 |
| are metros running today | 0 | 1 |
| amsterdam metro timetable | 0 | 1 |
| info metro | 0 | 1 |
| metro still open today | — | — |

**Last 28 days**

| Query | Clicks | Impressions |
|---|---:|---:|
| metro amsterdam | 1 | 7 |
| m54 amsterdam | 0 | 8 |
| m50 amsterdam | 0 | 8 |
| gvb metro | 0 | 5 |
| amsterdamse metro | 0 | 5 |
| amsterdam metro | 0 | 4 |
| openbaar vervoer amsterdam routeplanner | 0 | 4 |
| m50 metro | 0 | 3 |
| métro amsterdam | 0 | 3 |
| laatste metro amsterdam | — | — |

### ⚠️ How to read it

- **The numbers are tiny.** 1–8 impressions per query is a direction, not proof. Don't add the windows up: the 24 hours are inside the 7 days, which are inside the 28 days.
- **The position is missing.** Zero clicks at position 40 means something else than zero clicks at position 5. Turn on the *Position* column before the next export.
- **Most of this is from before the station pages.** They went live on 8 Nov 2026 (#230, at `/reisinfo/<station>/` since #231). The 28-day window is almost all from before; the 24 hours are the first sign of them.
- **Impressions without clicks are normal at this size.** One click out of the whole export is not yet a problem to fix.

---

## 🗂️ What people are looking for

The queries fall into six groups. The last column says whether the site has a page that answers them today.

| # | They want to know | Queries | On the site today |
|---|---|---|---|
| 1 | 🌙 **When the last (or first) metro goes, and whether it runs today** | laatste metro amsterdam · hoe laat gaat de laatste metro · what time does metro stop · metro last service time · metro still open today · are (the) metros running today · rijd metro 53 vandaag | ❌ The backend knows the first and last train per station and direction (`travel.station_info`, `/api/station`), but only the live app shows it. No page Google reads says it. |
| 2 | 🚇 **A line** | m50 amsterdam · m54 amsterdam · m50 metro · metro 51 centraal station · rijd metro 53 vandaag | ❌ No page per line (left out on purpose in the tidy plan, until the station pages prove themselves). |
| 3 | 🕒 **Times / the timetable** | tijden metro amsterdam · metrotijden · amsterdam metro times · amsterdam metro timetable · info metro | ⚠️ `/reisinfo` has live departures, but its title and description don't use the words people search with ("metrotijden", "timetable"). |
| 4 | 📍 **A station** | metro sloterdijk · reigersbos metro station · centraal station metro station 1012 ab · amsterdam centraal live departures · metro station | ✅ Since #230: a page per station. Too new to judge. |
| 5 | 🏷️ **The metro in general** | metro amsterdam · amsterdam metro · amsterdamse metro · gvb metro · métro amsterdam | ✅ The homepage. The only click so far. |
| 6 | 🧭 **A journey planner** | openbaar vervoer amsterdam routeplanner | ⚠️ `/reisinfo` has one, for the metro only, which is fair to say. |

**The biggest gap is group 1:** it shows up in all three windows, the site can answer it better than most (from the same timetable the app runs on), and no page says it yet.

---

## ✅ The plan

### Step 0: set up the measurement (no code) 📏

- [x] **Sitemap:** resubmitted on 8 Nov 2026. The one from the week before still had the old 4 URLs; Search Console now finds **82** (39 stations × NL/EN, plus `/`, `/en/`, `/reisinfo`, `/en/reisinfo`). Google rereads it by itself from now on: resubmit only after a big change (the line pages of step 3, say).
- [ ] Turn on the *Position* column, and export *Pages* as well as *Queries*.
- [ ] Ask Google to index the pages that matter most, in both languages (below). Day 1 done on 8 Nov 2026; days 2 and 3 on **9 and 10 Nov**.
- [ ] **About 15 Nov:** check which canonical Google picked for `/reisinfo` and `/reisinfo/centraal-station/` (0.2 below).
- [ ] *Pages → Indexing*: how many of the 82 are indexed? Note it with the date in the check log.
- [ ] Save this export as the baseline. Next exports: **6 Dec 2026** (4 weeks) and **3 Jan 2027** (8 weeks), the same windows as [Phase 3 of the tidy plan](seo-tidy-plan.md#phase-3-measure-keep-or-roll-back-).

#### 0.1 Requesting indexing, NL and EN 🗂️

**Is it fine to do?** Yes, within Google's limits ([Ask Google to recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl), [URL Inspection tool](https://support.google.com/webmasters/answer/9012289)):

- URL Inspection is Google's own tool for single URLs. There is a **daily limit per property**; Google gives no number, so plan on a handful a day.
- **Once per URL.** Asking again "won't get it crawled any faster".
- **Many URLs: the sitemap**, not the button. The other stations come that way.
- **No guarantee:** crawling takes "a few days to a few weeks", and a request doesn't promise a place in the results.
- **Not the Indexing API:** it's only for job postings and livestreams, not for pages like these.

**Checked on the live site, 8 Nov 2026:** every URL below answers 200, allows indexing, has itself as canonical and links its other language (`hreflang`); `robots.txt` allows everything and names the sitemap.

**Per URL, the same five steps:**

1. Paste the **full URL** into the inspection bar at the top of Search Console, press Enter.
2. **Test live URL**, wait for the result.
3. Check: "URL is available to Google", indexing allowed, and under **View tested page** the screenshot shows the right page in the right language.
4. **Request indexing**, **once**.
5. Next URL. Don't repeat one.

Already says "URL is on Google"? Nothing to request. A message about the limit? Stop, carry on the next day.

**Day 1: the travel-info pages and Centraal Station** ✅ *done 8 Nov 2026*

| | Nederlands | English |
|---|---|---|
| Travel info | `https://amsterdammetro.nl/reisinfo` | `https://amsterdammetro.nl/en/reisinfo` |
| Centraal Station | `https://amsterdammetro.nl/reisinfo/centraal-station/` | `https://amsterdammetro.nl/en/reisinfo/centraal-station/` |

`/reisinfo` comes first because Google still shows an old snapshot of it (see the check log): a station's title on the general page, from before the station pages had their own URLs. The live page has its own title again; a fresh crawl replaces the old one.

**Day 2: busy stations, Dutch**

- `https://amsterdammetro.nl/reisinfo/zuid/`
- `https://amsterdammetro.nl/reisinfo/sloterdijk/`
- `https://amsterdammetro.nl/reisinfo/bijlmer-arena/`
- `https://amsterdammetro.nl/reisinfo/amstelstation/`
- `https://amsterdammetro.nl/reisinfo/reigersbos/` (in the 24-hour export)

**Day 3: the same stations, English**

- `https://amsterdammetro.nl/en/reisinfo/zuid/`
- `https://amsterdammetro.nl/en/reisinfo/sloterdijk/`
- `https://amsterdammetro.nl/en/reisinfo/bijlmer-arena/`
- `https://amsterdammetro.nl/en/reisinfo/amstelstation/`
- `https://amsterdammetro.nl/en/reisinfo/reigersbos/`

**Exactly these URLs:** stations end in `/`, `/reisinfo` and `/en/reisinfo` don't. Those are the canonicals; the other spelling points to them, and inspecting it inspects the wrong URL.

**Why English too:** Google finds it through `hreflang`, but shows it in English results only once it's indexed. That's where tourists search ("what time does metro stop", "are metros running today").

**Not needed:** the homepages (`/`, `/en/`) are in Google already, and the other 29 stations come through the sitemap.

**After a week:** *Pages → Indexing*, or *Sitemaps → See index coverage*, for how many of the 82 are in. In Google itself: `site:amsterdammetro.nl/reisinfo/` and `site:amsterdammetro.nl/en/reisinfo/`.

#### 0.2 Watch: `/reisinfo` shows Centraal Station's board 👀

Found in the live test's screenshot on 8 Nov. Plain `/reisinfo` opens a board: a favourite or recent station, else **Centraal Station** (`DEFAULT_STATION` in `TravelInfoPage.tsx`). Google has no favourites, so it gets Centraal Station.

- **By design, and the head is right:** the default doesn't take over the page (#232). Address, title and canonical stay `/reisinfo`; the live test confirmed the canonical.
- **The risk:** the main content of `/reisinfo` and `/reisinfo/centraal-station/` is nearly the same. Both declare themselves canonical, but Google may still treat one as a duplicate of the other.
- **Check about 15 Nov:** URL inspection of both URLs, the indexed result (not the live test), *Google-selected canonical*. Also *Pages → Indexing* for "Duplicate, Google chose different canonical than user".
  - Each its own URL: nothing to do.
  - One points to the other: make `/reisinfo` an overview for a first visit (and for Google): the five lines, today's disruptions, all stations as links, and the board only once a station is chosen. Returning visitors keep their own station. That overview is also where step 1's "first and last metro per line" table goes. Then request indexing for `/reisinfo` again.

**Your own browser isn't Google's.** The app reopens the station or trip you last looked at, so `/reisinfo` can open on a station for you (Rokin, here). Google has none of that; a private window shows what it sees.

### Step 1: first and last metro on every station page 🌙

The answer to group 1, on pages that already exist: no new URLs.

- **What:** per direction, the first and last scheduled metro, for a weekday, Saturday and Sunday. For example: "Richting Gein: eerste 6:02, laatste 0:31 (ma–vr)".
- **Where:** in the station page's static HTML, after the live departures, so Google and AI crawlers can read it without running JavaScript.
- **Wording:** "volgens de dienstregeling" / "scheduled", with the date the timetable is valid from. Never presented as live.
- **The service day runs past midnight:** a last metro at 0:31 belongs to the evening before, as `travel.py` already handles (`_service_day`).
- **On `/reisinfo`:** one compact table, "Eerste en laatste metro" per line and direction. That answers "laatste metro amsterdam" without a station in it, on a page that already exists.
- **On the live board:** keep "today" there (it already shows the service hours), with a link to disruptions. That covers "rijdt de metro vandaag?".

**Decision to make first: where the times come from at build time.** The frontend build has no timetable; the backend reads GTFS.

| Option | For | Against |
|---|---|---|
| **A. A generated JSON in the repo** (like `accessibility.json`), written by a backend script from GTFS | Static, testable, readable for every crawler | Has to be regenerated when the timetable changes; stale if forgotten (so print the "valid from" date, and add a test that fails when it's old) |
| **B. Fetched in the browser** from `/api/station` | Always current | Not in the static HTML; AI crawlers and Google's first pass miss it |
| **C. The build fetches it from the live API** | Current at deploy | The build depends on the backend being up |

👉 **Recommendation: A**, with a test that fails when the timetable file is older than its end date, so a stale file can't go unnoticed.

### Step 2: titles and descriptions that use people's words 🏷️

Only after step 1 is live, so every word in them is true.

| Page | Now | Proposal |
|---|---|---|
| `/reisinfo` (NL) | Reisinformatie — vertrektijden, reisplanner & lijnen \| Metro Amsterdam Live | Metrotijden — vertrektijden, eerste en laatste metro & reisplanner \| Metro Amsterdam Live |
| `/en/reisinfo` | Travel info — departures, journey planner & lines \| Amsterdam Metro Live | Amsterdam metro times — departures, first and last metro & journey planner \| Amsterdam Metro Live |
| Station page (NL) | `<Station> — metro 51, 53: vertrektijden & toegankelijkheid` | `<Station> — metro 51, 53: vertrektijden, eerste en laatste metro & toegankelijkheid` |

- Descriptions: mention the first and last metro and live disruptions in one natural sentence. No keyword lists.
- Change one thing at a time, and note the date in the check log, so a change in the numbers can be traced to it.

### Step 3: a page per line, only if the data keeps asking for it 🚇

Group 2 is the first sign of demand for line pages, which the tidy plan left out until the station pages prove themselves. So this step has a gate.

- **Gate (check at the 8-week export):** the station pages are indexed and get impressions, *and* line queries (m50, m54, metro 53 …) still show up.
- **Content, only what's specific to the line:** its route with all stations and their step-free status, frequency by time of day, first and last metro per direction, and live trains on the line in the browser.
- **5 lines × NL/EN = 10 pages.** Their own clean URLs (the address to be decided). Not the old `?lijn=` parameters, which the tidy plan made canonical to `/reisinfo`.

---

## 🚫 Not in this plan, and why

| Idea | Why not |
|---|---|
| 🇫🇷 French pages ("métro amsterdam") | 3 impressions. Not worth a third language with all its upkeep. |
| ❓ FAQ blocks ("Hoe laat gaat de laatste metro?") | Text written for search is the clutter the tidy plan avoids, and Google only shows FAQ rich results for well-known government and health sites (since Aug 2023). The answer in a table on the real page is better. |
| 🔤 Pages for loose words ("metro station", "info metro") | Too vague to answer; the homepage and `/reisinfo` cover them. |
| 🗺️ Routes with bus, tram and train ("openbaar vervoer routeplanner") | The site is about the metro. Saying so honestly beats pretending to be a full planner. |

---

## 📓 Check log

| Date | What | Result |
|---|---|---|
| 8 Nov 2026 | First export (24 h, 7 d, 28 d), this plan written | Baseline above. Position column still missing. |
| 8 Nov 2026 | Sitemap resubmitted | Discovered pages 4 → 82. |
| 8 Nov 2026 | `site:amsterdammetro.nl/reisinfo/` in Google | One result: `/reisinfo` with an old title, "Centraal Station — vertrektijden". The live page has its own title and canonical (checked). No station page indexed yet. |
| 8 Nov 2026 | Indexing requested, day 1 (4 URLs) | `/reisinfo`, `/en/reisinfo`, `/reisinfo/centraal-station/`, `/en/reisinfo/centraal-station/`. Live tests all fine: available to Google, indexing allowed, each its own canonical, the English page in English. Breadcrumbs valid on both station pages, with Dutch ("Reisinformatie") and English ("Travel info") names linking their own language. Before the test, both station pages were "Discovered – currently not indexed" (never crawled). The screenshot of `/reisinfo` shows Centraal Station's board: see 0.2. |
| | Indexing requested, day 2 (5 URLs, NL) | |
| | Indexing requested, day 3 (5 URLs, EN) | |
| | Pages → Indexing, a week later | … of 82 indexed |
| | Canonical check, `/reisinfo` vs `/reisinfo/centraal-station/` (0.2) | |
