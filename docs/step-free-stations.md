# Step-free stations: data, rule and regular checks

Which metro stations the app calls step-free, where that comes from, and how and when it is checked. **We check this data regularly** (see [Schedule](#schedule)); this file is the checklist and the log.

Related: [`frontend/src/data/accessibility.json`](../frontend/src/data/accessibility.json) (the data), [`frontend/src/data/accessibility.ts`](../frontend/src/data/accessibility.ts) (how the app reads it), [`scripts/seed-accessibility.sh`](../scripts/seed-accessibility.sh) (seeds new stations).

---

## The rule

**A station is step-free only when GVB's own station page says "Rolstoelvriendelijk". Anything not confirmed is "not step-free".**

Telling a wheelchair user "step-free" and being wrong can leave them at the bottom of the stairs. Saying "not step-free" when it is costs them a detour. So every doubt resolves to "no":

- A station not checked yet is `"no"`.
- A station missing from the file (renamed, or new in the timetable) is `"no"`; `stepFree()` falls back to it.
- A station that is step-free by design but whose lift is out of service is `"no"` until GVB no longer lists the fault.
- OpenStreetMap is a hint for checking, never a source: it had 7 of 39 stations wrong.

Tests in [`frontend/src/components/StepFree.test.tsx`](../frontend/src/components/StepFree.test.tsx) fail the build if an unchecked station is ever `"yes"`, or if a station has any value other than `"yes"` or `"no"`.

## Where it shows

- Station cards on the map and on the travel page: "Rolstoeltoegankelijk" / "Niet rolstoeltoegankelijk", or "Lift buiten gebruik (GVB, 29 okt)" for a station marked `lift_out`. Always with a link to GVB's lift faults that says what to search for there: `Liftstoringen bij GVB: zoek "Diemen Zuid"`.
- The date is the day of the last lift check (`lift_check`), never today's date. More than 10 days after it (a missed weekly check), the lift line is no longer shown and the card falls back to the plain state and the link. The app never says a lift works, only that one was seen broken.
- A ♿ after step-free stations in the map's station picker, the travel page's station list and search.
- The journey planner's "Zonder trappen" option: names the stations on a journey (start, changes, end) that are not step-free and says which have a lift out (with the check date). Once above the options: the link to GVB's lift faults, a copy pill per GVB search term for the stations used, and what "0 resultaten" means.
- The station card's lift link also copies its search term, and says "Gekopieerd" next to it (hover text does not show on a phone).
- Three states with their own look everywhere: ♿ step-free, ⚠ step-free but a lift is out (amber), and not step-free. "Not step-free" says why on the station board: GVB's page says so, or the station isn't confirmed yet.
- With a lift out, the board names the nearest step-free station in each direction, and lists the step-free stations reachable without changing trains. The station list has a "step-free only" filter.
- Each station's own page (`/reisinfo/<station>`, see [seo-tidy-plan.md](seo-tidy-plan.md)) has crawlable text with **GVB's own rating** and the date of our last check, and links its GVB station page (`gvb_stops`). It never states a lift fault: those only appear once the page runs, so they still drop off 10 days after a missed check.

## Sources

| Source | Use | Link |
|---|---|---|
| GVB station page, "Over deze halte" | **The source.** "Rolstoelvriendelijk" or "Niet rolstoel vriendelijk", from the national stop register (CHB) | `https://www.gvb.nl/reisinformatie/halte/<code>` (codes in the table below) |
| GVB lift and escalator faults | Lifts out of service right now; a broken lift makes a station "no" | https://www.gvb.nl/reisinformatie/lift-roltrappen |
| OpenStreetMap | Hint only, as `osm_wheelchair` on unchecked stations | via `scripts/seed-accessibility.sh` |

### Why the link cannot open GVB's page on the station

Tested by hand on 2026-10-29:

- GVB's lift-fault page has a search box ("Vul een lijnnummer of halte in") that filters as you type, but the search never appears in the URL, and `?searchValue=…` is ignored. A pre-filtered link is not possible.
- GVB's station pages show some lift faults (Weesperplein's) but not all: Diemen Zuid's page (`NL:S:30009542`) showed "Rolstoelvriendelijk" and no fault while the fault list had its lift broken. **Never use a station page as the lift status.**
- The search only matches text GVB writes: "Station Diemen Zuid" finds nothing, "Diemen Zuid" finds the fault. A wrong term looks exactly like "no fault" ("0 resultaten"). Hence `gvb_search` per station, kept short.
- One station per search: "Weesperplein" found its fault, "Weesperplein Bullewijk" gave "0 resultaten" (2026-10-29). Never copy or suggest several names in one term; the planner gives each its own pill.
- First-time visitors get GVB's cookie banner over the page first; the choice is theirs.
- No open live feed covers GVB's metro lifts yet. ProRail's train-station lifts are in NDOV (SIRI-FM) since January 2025; city operators were "working on it" in May 2026 ([DOVA](https://dova.nu/nieuws/toegankelijkheidsinformatie-het-ov-wordt-steeds-completer)). Once GVB's lifts are in it, the backend can read that instead.

**Check GVB's pages by hand, in a browser, at a normal pace.** GVB's site sits behind bot protection (an Azure WAF challenge). Do not script requests to it, call its internal APIs, or try to get past the challenge: that applies to people and to AI agents alike. Around 30 page loads in a row was enough to trigger it.

## Schedule

| When | What | Who |
|---|---|---|
| **Every week** | Open GVB's [lift faults](https://www.gvb.nl/reisinformatie/lift-roltrappen). For each station marked "lift out of service" below, is its fault still listed? For each step-free station, is a new metro lift fault listed? Update `step_free` and `lift_out`, and **always set `lift_check` to today**, even when nothing changed. Check that each listed fault is found by its station's `gvb_search` term in GVB's search box; fix the term if not. | maintainer |
| **Every month** | Check every station's GVB page against the table below. Set `"source": "checked"` and a dated `note` on each one changed. | maintainer |
| **When the timetable gains or renames a station** | Run the seed script; the station arrives as `"no"`. Check it on GVB's site. | maintainer |
| **From 2027** | GVB replaces all 93 lifts and 177 escalators, starting with line 50 ([NH Nieuws](https://www.nhnieuws.nl/nieuws/350636/gvb-gaat-alle-93-liften-en-177-roltrappen-vervangen)). Stations will lose their lift for weeks at a time: check the lift faults more often while that runs. | maintainer |

Record every check in the [Check log](#check-log), even when nothing changed: the log is the proof the data is current.

## How to check a station

1. Open its GVB page from the table below. For a station without a code, search its name at https://www.gvb.nl/reisinformatie/haltes-en-dienstregeling and pick the **metro** stop (not tram, bus, train or ferry). The page lists metro lines 50–54.
2. Scroll to **"Over deze halte"** and read the label: **Rolstoelvriendelijk** or **Niet rolstoel vriendelijk**.
3. Check the station against GVB's [lift faults](https://www.gvb.nl/reisinformatie/lift-roltrappen). A metro lift listed there makes the station "no" for now.
4. Edit its entry in `frontend/src/data/accessibility.json`:

   ```json
   "Amsterdam, Gein": {
     "step_free": "no",
     "source": "checked",
     "osm": "node/4041640589",
     "note": "GVB station page (CHB): niet rolstoelvriendelijk, 2026-10-27"
   }
   ```

   - `step_free`: `"yes"` only for "Rolstoelvriendelijk" with no metro lift fault; otherwise `"no"`.
   - `source`: `"checked"`, so the seed script never overwrites it.
   - `note`: what you saw, where, and the date (YYYY-MM-DD). For a broken lift, say when to set it back.
   - `gvb_search`: what finds the station in the search box on GVB's lift-fault page, in GVB's spelling. Short beats exact: a term that also matches a neighbour is harmless, one that matches nothing looks like "no fault".
   - `lift_out`: `true` while GVB's lift faults list a lift at a station whose GVB page says "Rolstoelvriendelijk"; remove it when the fault is gone. Not for stations that are "niet rolstoelvriendelijk" anyway (Centraal Station).
   - `gvb_stops`: the station's code(s) from its GVB page address (`NL:S:…` / `NL:Q:…`), as in the table below. The station's page links them; a station without one isn't indexed.
   - Remove `osm_wheelchair` once checked.
5. Run `npm test` in `frontend/`, then add a line to the [Check log](#check-log).

## Seeding new stations

```bash
scripts/seed-accessibility.sh
```

Needs the backend running on `http://localhost:8020` (or pass its URL). It reads station names from `/api/stations` and OSM from the Overpass API. Checked stations are kept as they are; every other station is written as `"no"` with OSM's tag as `osm_wheelchair`. Re-running it changes nothing for checked stations.

## Status per station

As of the last full check, **2026-10-27**, and the lift check of **2026-11-08**: 28 step-free, 11 not.

| Station | Status | Why | GVB page |
|---|---|---|---|
| Amstelstation | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009514](https://www.gvb.nl/reisinformatie/halte/NL:S:30009514) |
| Amstelveenseweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30007343](https://www.gvb.nl/reisinformatie/halte/NL:Q:30007343) |
| Bullewijk | ✅ step-free | GVB: Rolstoelvriendelijk; lift fault gone 2026-10-29 | [NL:S:30009524](https://www.gvb.nl/reisinformatie/halte/NL:S:30009524) |
| Burg. De Vlugtlaan | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30003205](https://www.gvb.nl/reisinformatie/halte/NL:Q:30003205) |
| Centraal Station | ✅ step-free | GVB: Rolstoelvriendelijk (both metro stops); lift faults gone 2026-11-04 | [NL:S:30009500](https://www.gvb.nl/reisinformatie/halte/NL:S:30009500) (51/53/54), [NL:S:30009575](https://www.gvb.nl/reisinformatie/halte/NL:S:30009575) (52) |
| De Pijp | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009581](https://www.gvb.nl/reisinformatie/halte/NL:S:30009581) |
| Europaplein | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:S:30009583](https://www.gvb.nl/reisinformatie/halte/NL:S:30009583) |
| Gaasperplas | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:S:30009550](https://www.gvb.nl/reisinformatie/halte/NL:S:30009550) |
| Ganzenhoef | ❌ not step-free | lift out of service (GVB lift faults, since 2026-11-08) | [NL:S:30009546](https://www.gvb.nl/reisinformatie/halte/NL:S:30009546) |
| Gein | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30009531](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009531) |
| Heemstedestraat | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30004321](https://www.gvb.nl/reisinformatie/halte/NL:Q:30004321) |
| Henk Sneevlietweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30004319](https://www.gvb.nl/reisinformatie/halte/NL:Q:30004319) |
| Isolatorweg | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30002297](https://www.gvb.nl/reisinformatie/halte/NL:Q:30002297) |
| Jan van Galenstraat | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30003203](https://www.gvb.nl/reisinformatie/halte/NL:Q:30003203) |
| Kraaiennest | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009548](https://www.gvb.nl/reisinformatie/halte/NL:S:30009548) |
| Nieuwmarkt | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009502](https://www.gvb.nl/reisinformatie/halte/NL:S:30009502) |
| Noord | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009571](https://www.gvb.nl/reisinformatie/halte/NL:S:30009571) |
| Noorderpark | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009573](https://www.gvb.nl/reisinformatie/halte/NL:S:30009573) |
| Overamstel | ❌ not step-free | lift out of service (GVB lift faults, since 2026-11-02) | [NL:Q:30009563](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009563) |
| Postjesweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30004325](https://www.gvb.nl/reisinformatie/halte/NL:Q:30004325) |
| Reigersbos | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30009529](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009529) |
| Rokin | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009577](https://www.gvb.nl/reisinformatie/halte/NL:S:30009577) |
| Spaklerweg | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:S:30009518](https://www.gvb.nl/reisinformatie/halte/NL:S:30009518) |
| Station Bijlmer ArenA | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30009522](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009522) |
| Station Diemen Zuid | ✅ step-free | GVB: Rolstoelvriendelijk; lift fault gone 2026-11-02 | [NL:S:30009542](https://www.gvb.nl/reisinformatie/halte/NL:S:30009542) |
| Station Duivendrecht | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009551](https://www.gvb.nl/reisinformatie/halte/NL:S:30009551) |
| Station Holendrecht | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30000171](https://www.gvb.nl/reisinformatie/halte/NL:Q:30000171) |
| Station Lelylaan | ✅ step-free | GVB: Rolstoelvriendelijk; lift fault gone 2026-11-07 | [NL:S:30004322](https://www.gvb.nl/reisinformatie/halte/NL:S:30004322) |
| Station RAI | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30007404](https://www.gvb.nl/reisinformatie/halte/NL:Q:30007404) |
| Station Sloterdijk | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30002294](https://www.gvb.nl/reisinformatie/halte/NL:S:30002294) |
| Station Zuid | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30007408](https://www.gvb.nl/reisinformatie/halte/NL:S:30007408) |
| Strandvliet | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30009521](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009521) |
| Van der Madeweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30009517](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009517) |
| Venserpolder | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009540](https://www.gvb.nl/reisinformatie/halte/NL:S:30009540) |
| Verrijn Stuartweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009544](https://www.gvb.nl/reisinformatie/halte/NL:S:30009544) |
| Vijzelgracht | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30009579](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009579) |
| Waterlooplein | ❌ not step-free | lift out of service (GVB lift faults, since 2026-11-07) | [NL:S:30009508](https://www.gvb.nl/reisinformatie/halte/NL:S:30009508) |
| Weesperplein | ✅ step-free | GVB: Rolstoelvriendelijk; lift fault gone 2026-11-01 | [NL:S:30009510](https://www.gvb.nl/reisinformatie/halte/NL:S:30009510) |
| Wibautstraat | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009512](https://www.gvb.nl/reisinformatie/halte/NL:S:30009512) |

Keep this table in step with `accessibility.json` when a station changes.

## Open items

- **Overamstel, Waterlooplein**: set back to "yes" and remove `lift_out` once GVB's lift faults no longer list their lift.
- **Search terms**: checked against a live fault for Weesperplein, Diemen Zuid, Lelylaan, Centraal, Station Zuid, Overamstel and Waterlooplein. The others are GVB's station names, shortened; confirm each when it first shows a fault.

## Check log

Newest first. One line per check, even when nothing changed.

| Date | Kind | Result | By |
|---|---|---|---|
| 2026-11-08 | lift faults | New fault at Ganzenhoef (lift between street and metro platform, updated 8 Nov 12:11) → no, `lift_out`; search term "Ganzenhoef" finds it (1 lift fault, no escalator faults). Waterlooplein (updated 7 Nov 16:49) and Overamstel (updated 6 Nov 10:21) still listed → stay no, `lift_out`. Station Zuid's WTC-side tram/bus lift (updated 2 Nov 21:04) still listed, not a metro-platform lift → stays yes. Escalator faults (Station Noord exit King's Cross, Rokin exit Spui, Rietlandpark) don't change step-free. "Binnenkort": no planned lift or escalator faults. The cookie banner was left for the user. 1 GVB page load, by hand. Now 28 step-free. | maintainer + Claude |
| 2026-11-08 | search test | Amstelstation's term "Amstel" → 1 resultaat: Overamstel's lift (track 2 and 4, updated 6 Nov 10:21), already no + `lift_out`. No fault at Amstelstation → stays yes; the live station card shows "Rolstoeltoegankelijk" as expected. "Amstel" also matches Overamstel and Amstelveenseweg: a hit there is not an Amstelstation fault. No escalator faults. 1 GVB page load, by the user. Data unchanged, still 29 step-free. | maintainer + Claude |
| 2026-11-08 | lift faults | No change. Waterlooplein (updated 7 Nov 16:49) and Overamstel (updated 6 Nov 10:21) still listed → stay no, `lift_out`. Station Zuid's WTC-side tram/bus lift (updated 2 Nov 21:04) still listed, not a metro-platform lift → stays yes. Escalator faults (Centraal Station Noord–Oost, Rietlandpark) don't change step-free. "Binnenkort" not checked: the cookie banner was left for the user. 1 GVB page load, by hand. Still 29 step-free. | maintainer + Claude |
| 2026-11-07 | lift faults | New fault at Waterlooplein (lift between street and station, updated 7 Nov 16:49) → no, `lift_out`; search term "Waterlooplein" finds it (1 resultaat). Lelylaan no longer listed ("Lelylaan" → 0 resultaten); station page NL:S:30004322 still Rolstoelvriendelijk (metro 50/51) → yes, `lift_out` removed. Overamstel (updated 6 Nov 10:21) still listed → stays no. Station Zuid's WTC-side tram/bus lift still listed, not a metro-platform lift → stays yes. Escalator faults (Centraal Station Noord–Oost, Rietlandpark) don't change step-free; nothing under "Binnenkort". 2 GVB page loads, by hand. Still 29 step-free. | maintainer + Claude |
| 2026-11-04 | lift faults | Centraal Station's two metro lifts (hall Stationsplein Oost; busstation IJzijde–IJhal–metro 52) no longer listed; station pages checked Rolstoelvriendelijk on 2026-11-02 → yes, `lift_out` removed. Overamstel (updated 2 Nov 14:05) and Lelylaan (updated 12 Oct) still listed → stay no. New fault at Station Zuid: lift between Zuidplein and the tram and bus station, WTC side (updated 2 Nov 21:04). Not a metro-platform lift, so Zuid stays yes; it only blocks a change to tram or bus on the WTC side. Escalator faults (Kraaiennest, Vijzelgracht, Noorderpark, Rietlandpark) don't change step-free. 2 GVB page loads, by hand. Now 29 step-free. | maintainer + Claude |
| 2026-11-02 | lift faults + open items | New fault at Overamstel (lift street–platform towards Isolatorweg, track 2 and 4, updated 2 Nov 14:05) → no; search term "Overamstel" finds it (1 resultaat). Diemen Zuid's lift no longer listed; station page NL:S:30009542 still Rolstoelvriendelijk → yes. Lelylaan (updated 12 Oct) still listed → stays no. Open items: Duivendrecht is NL:S:30009551 (metro 50/54), Rolstoelvriendelijk, no fault → yes. Centraal Station's metro stops are NL:S:30009500 (51/53/54) and NL:S:30009575 (52), both Rolstoelvriendelijk; the old NL:Q:30009905 was not the metro stop. Centraal stays no for its two listed metro lifts (hall Stationsplein Oost, updated 1 Nov; busstation IJzijde–IJhal–metro 52, updated 28 Oct), now marked `lift_out`. Amstelstation is NL:S:30009514, Rolstoelvriendelijk (unchanged). Sportlaan is a tram stop; escalator faults (Rokin, Noorderpark, Rietlandpark) don't change step-free. 11 GVB page loads, by hand. Now 28 step-free. | maintainer + Claude |
| 2026-11-01 | lift faults | Weesperplein's lift (exit Stadstimmertuin) no longer listed; station page still Rolstoelvriendelijk → yes. Diemen Zuid (updated 28 Oct) and Lelylaan (updated 12 Oct) still listed → stay no. Centraal Station's lift (busstation IJzijde–IJhal–metro 52) still listed (already no). Sportlaan is a tram stop. Escalator faults (Vijzelgracht, Noorderpark, Rietlandpark, Zuid) don't change step-free. Now 27 step-free. | maintainer + Claude |
| 2026-10-29 | search test | GVB's lift-fault search: "Weesperplein" → 1 resultaat (lift exit Stadstimmertuin, updated 28 Oct 20:07), still listed; "Weesperplein Bullewijk" → 0 resultaten. Not a full lift check; data unchanged. | maintainer + Claude |
| 2026-10-29 | lift faults | Bullewijk's lift no longer listed; station page still Rolstoelvriendelijk (metro 50/54) → yes. New fault at Weesperplein (lift street–hall, exit Stadstimmertuin) → no. Diemen Zuid and Lelylaan still listed → stay no. Centraal Station also has a lift fault (already no). Escalator faults (Noorderpark, Rokin, Vijzelgracht, Zuid, Rietlandpark) don't change step-free. Still 26 step-free. | maintainer + Claude |
| 2026-10-27 | full | First check of all 39 stations on GVB's pages. 26 step-free, 13 not (9 "niet rolstoelvriendelijk", 3 lift out of service, Duivendrecht unchecked). OSM had 7 wrong. | maintainer + Claude |
