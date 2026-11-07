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
- schema.org `SubwayStation` with name and coordinates. Adds no pages, only tells Google precisely what the page is.
- Only facts that are already on the page. Accessibility in structured data only with the same "no" default and check date as the page text.

**2.5 🌐 Link to the sources instead of copying them**
- Each station page links to its GVB station page (codes are in [`step-free-stations.md`](step-free-stations.md)).
- No copied text from GVB or anyone else.

### Phase 3: measure, keep or roll back 📊

- After **4–6 weeks**, check Search Console per station URL: indexed, impressions, clicks.
- Stations Google ignores or flags as duplicate get `noindex`, so nothing stays on the web that doesn't help someone.
- If the whole change doesn't help, roll it back: remove the station rewrites and keep the canonicals to `/reisinfo`. Phase 1 stays, since it is cleanup either way.

---

## 🚫 Not in this plan, and why

| Idea | Why it's left out for now |
|---|---|
| ✏️ Fix OpenStreetMap's wrong wheelchair tags (7 of 39) | Editing someone else's data is a separate responsibility with its own rules. Do it by hand, as its own task, if at all. |
| 📦 Publish the step-free list as open data | People could build on it as if it were live. Lift data is checked by hand weekly and can be days old. |
| 📝 Station "guides" or text written for SEO | That is exactly the clutter this plan avoids. |
| 🔁 Automated lift checks against gvb.nl | Not allowed: [`AGENTS.md`](../AGENTS.md) forbids scripting requests to gvb.nl. |
| 🤖 Pages per line, per exit, per neighbourhood | More thin pages. Reconsider only if Phase 3 shows the station pages help. |

---

## 🧪 Done means

- [ ] `curl -I https://amsterdammetro.nl/does-not-exist` returns **404**, and the page has `noindex`.
- [ ] `curl https://amsterdammetro.nl/reisinfo/waterlooplein` shows a station-specific `<title>`, description and canonical without JavaScript.
- [ ] `?station=Waterlooplein&lijn=51` has a canonical to `/reisinfo/waterlooplein`.
- [ ] The sitemap is generated and lists only real, indexable URLs.
- [ ] No live times in any prerendered HTML.
- [ ] `npm test` and `tsc --noEmit` pass in `frontend/`.
- [ ] A Search Console check is noted below 4–6 weeks after release.

## 🗒️ Log

| Date | What | Result |
|---|---|---|
| 2026-11-07 | Plan written | Nothing built yet |
