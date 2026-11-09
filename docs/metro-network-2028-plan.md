# 🚇 Plan: the new metro network (M1–M4) from December 2027

Written 9 Nov 2026, before anything is built. This plan covers two changes that are already decided, and when the app has to follow each one.

## 📅 What changes, and when

| When | What | Source |
|---|---|---|
| **From mid-2027** | GVB starts replacing all 93 lifts and 177 escalators, **line 50 first**. Stations will be without a lift for weeks at a time. | [NH Nieuws](https://www.nhnieuws.nl/nieuws/350636/gvb-gaat-alle-93-liften-en-177-roltrappen-vervangen), also in [step-free-stations.md](step-free-stations.md) |
| **Mid-December 2027** (one Vervoerregio page names **12 Dec 2027**) | New network with the 2028 timetable. Lines 50 and 53 become one line, Isolatorweg – Gaasperplas. Line 53 as it runs now disappears. Riders from Gaasperplas to Centraal change at **Van der Madeweg**, which gets an upgrade. Trains run 10 times an hour at peak and 8 times an hour during the day. | [GVB](https://over.gvb.nl/nieuws/metro-50-en-53-worden-een-lijn-sneller-reizen-met-de-metro/), [Vervoerregio](https://vervoerregio.nl/artikel/20251120-nieuw-metronetwerk-bekend-metrolijnen-50-en-53-worde), [Gemeente Amsterdam](https://www.amsterdam.nl/nieuws/nieuwsoverzicht/nieuw-metronetwerk/) |
| **Same moment** (the 2028 timetable) | New line numbers and new colours, chosen so people with low vision or colour blindness can tell them apart. 5 lines become 4, so 5 colours become 4. | [GVB](https://over.gvb.nl/nieuws/nieuwe-lijnnummers-en-kleuren-maken-amsterdamse-metro-overzichtelijker/), [NH Nieuws](https://www.nhnieuws.nl/nieuws/363622/amsterdamse-metros-krijgen-nieuwe-nummers-m1-tm-m4-en-kleuren-makkelijker-onthouden), [Rodi](https://www.rodi.nl/amsterdam-noord/nieuws/507255/amsterdamse-metro-krijgt-nieuwe-lijnnummers-en-kleuren) |

The new numbers:

| Now | From the 2028 timetable | Route |
|---|---|---|
| 52 (Noord/Zuidlijn) | **M1** | Noord – Zuid |
| 51 | **M2** | Centraal Station – Isolatorweg |
| 50 + 53 | **M3** | Gaasperplas – Isolatorweg |
| 54 | **M4** | Centraal Station – Gein |

So **mid-2027 changes only the lifts**. The lines, numbers and colours change in December 2027.

---

## ❓ Still unknown (fill in when known)

- [ ] **The colour of each new line.** No source we read says which colour each line gets. Look it up by hand on GVB's or the Vervoerregio's map, and write the hex values here.
- [ ] **The exact switch date.** Confirm 12 Dec 2027 once GVB publishes the 2028 timetable.
- [ ] **What the GTFS calls the lines.** The backend keeps only routes whose `route_short_name` is `50`–`54` ([`gtfs_static.py`](../backend/app/gtfs_static.py), via `METRO_LINES` in [`config.py`](../backend/app/config.py)). If the new feed says `M1` (or `1`), **the app shows no trains at all** from the switch date. Check the national GTFS as soon as it holds dates after the switch, usually a few weeks before.
- [ ] **M3's exact stops.** Expected: Gaasperplas – Venserpolder – Van der Madeweg – Overamstel – RAI – Zuid – … – Isolatorweg. It probably no longer serves Duivendrecht – Gein, which then only M4 serves. Take the stop order from the new GTFS, not from this guess.
- [ ] **Real-time feed.** Check that the live positions and departures use the same new line ids as the static GTFS.

---

## ✅ The plan

### Phase 0: now – mid-2027, watch 👀

- [ ] Fill in the unknowns above as GVB and the Vervoerregio publish them.
- [ ] Keep the step-free checks as they are ([step-free-stations.md](step-free-stations.md)).

### Phase 1: from mid-2027, lift replacement ♿

Nothing to build. The step-free rule already covers it: a station without a working lift is `"no"`.

- [ ] Check GVB's lift faults **more often** while the replacement runs, line 50's stations first. Every check gets a line in the step-free check log, as usual.
- [ ] If a station is out for weeks, think about whether the station page should say so more clearly than the ♿ status. Decide this then, not now.

### Phase 2: autumn 2027, build the switch 🔧

Build everything behind **one switch date**, so the app shows the old network until the switch and the new one after it, with no deploy needed at midnight.

Places in the code that name the lines today:

| Where | What to change |
|---|---|
| [`backend/app/config.py`](../backend/app/config.py) `METRO_LINES` | New ids, names and colours. `53` goes away. |
| [`backend/app/gtfs_static.py`](../backend/app/gtfs_static.py) | Accept the new `route_short_name`s. Around the switch date the feed holds both networks, so map each trip by its service date. |
| [`backend/app/models.py`](../backend/app/models.py) | Comments say `"50".."54"`. |
| [`frontend/src/data/network.ts`](../frontend/src/data/network.ts) `METRO_LINES` | New lines and stop orders, from the new GTFS. Used by the station pages, sitemap and 404 page. |
| [`frontend/src/seo/notFound.ts`](../frontend/src/seo/notFound.ts) `LINE_COLORS` | New colours. |
| [`frontend/src/components/MetroMap.tsx`](../frontend/src/components/MetroMap.tsx) `LINE_OFFSETS`, `LINE_DRAW_ORDER` | Offsets for the shared tracks: 4 lines instead of 5. |
| [`frontend/src/theme.ts`](../frontend/src/theme.ts) | The contrast fix for line 54's yellow: check every new colour against both themes. |
| [`frontend/src/components/LineBadge.tsx`](../frontend/src/components/LineBadge.tsx) | Badges must fit `M1`–`M4`. |
| [`frontend/src/travel/search.ts`](../frontend/src/travel/search.ts) | Search: `M3`, `lijn 3`. Keep the old numbers as aliases for a while (`53` and `50` → M3, `52` → M1, `51` → M2, `54` → M4), so people who search the old way still find their line. |
| [`frontend/src/travel/TravelInfoPage.tsx`](../frontend/src/travel/TravelInfoPage.tsx) | The default line `"52"` becomes M1. |
| [`frontend/src/seo/site.ts`](../frontend/src/seo/site.ts) | Page titles and texts such as "metro 51, 53 en 54". |
| `frontend/src/i18n` | Texts that name lines, in every language. |
| [`frontend/src/data/accessibility.json`](../frontend/src/data/accessibility.json) | Only if it stores lines per station. Follow [step-free-stations.md](step-free-stations.md) for any change there. |
| Tests and fixtures | `network.test.ts`, `test/fixtures.ts`, `TrainPopup.test.tsx`, `travel/*.test.ts`. |

- [ ] **Shared links:** old addresses with `?lijn=53` (or `50`) open M3, and `51`/`52`/`54` open M2/M1/M4. No link should break.
- [ ] **A short notice** on the site for a few weeks after the switch: "Lijn 50 en 53 zijn nu M3", with the old→new numbers.
- [ ] Run the GTFS check from the unknowns list as soon as the new feed is out, and test the switch with that feed.

### Phase 3: the switch, ~12 Dec 2027 🔀

- [ ] On the day, check the live site: trains on the map, departures per station, the planner from Gaasperplas to Centraal (it should show the change at Van der Madeweg).
- [ ] Check the station pages and sitemap: titles show the new numbers.
- [ ] Van der Madeweg becomes a main transfer station: check its step-free status on GVB's station page after the upgrade.

### Phase 4: after the switch 🧹

- [ ] Remove the old-network code and the switch date.
- [ ] Remove the notice after a few weeks. Keep the old-number search aliases and the `?lijn=` redirects longer.
- [ ] Update the README, the screenshots and `docs/demo.gif` (they show a line 53 train).
- [ ] The 404 page's text about the S1/S2 metro: check it still reads correctly with the new numbers.

---

## 🗒️ Log

| Date | What |
|---|---|
| 9 Nov 2026 | Plan written. Colours per line, exact date and GTFS names still unknown. |
