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
- The journey planner's "Zonder trappen" option: names the stations on a journey (start, changes, end) that are not step-free, says which have a lift out (with the check date), and adds one line with the GVB search terms for the stations used and what "0 resultaten" means.

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
   - Remove `osm_wheelchair` once checked.
5. Run `npm test` in `frontend/`, then add a line to the [Check log](#check-log).

## Seeding new stations

```bash
scripts/seed-accessibility.sh
```

Needs the backend running on `http://localhost:8020` (or pass its URL). It reads station names from `/api/stations` and OSM from the Overpass API. Checked stations are kept as they are; every other station is written as `"no"` with OSM's tag as `osm_wheelchair`. Re-running it changes nothing for checked stations.

## Status per station

As of the last full check, **2026-10-27**: 26 step-free, 13 not.

| Station | Status | Why | GVB page |
|---|---|---|---|
| Amstelstation | ✅ step-free | GVB: Rolstoelvriendelijk | search on GVB |
| Amstelveenseweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30007343](https://www.gvb.nl/reisinformatie/halte/NL:Q:30007343) |
| Bullewijk | ✅ step-free | GVB: Rolstoelvriendelijk; lift fault gone 2026-10-29 | [NL:S:30009524](https://www.gvb.nl/reisinformatie/halte/NL:S:30009524) |
| Burg. De Vlugtlaan | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30003205](https://www.gvb.nl/reisinformatie/halte/NL:Q:30003205) |
| Centraal Station | ❌ not step-free | GVB: niet rolstoelvriendelijk; **recheck that this code is the metro stop** | [NL:Q:30009905](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009905) |
| De Pijp | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009581](https://www.gvb.nl/reisinformatie/halte/NL:S:30009581) |
| Europaplein | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:S:30009583](https://www.gvb.nl/reisinformatie/halte/NL:S:30009583) |
| Gaasperplas | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:S:30009550](https://www.gvb.nl/reisinformatie/halte/NL:S:30009550) |
| Ganzenhoef | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009546](https://www.gvb.nl/reisinformatie/halte/NL:S:30009546) |
| Gein | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30009531](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009531) |
| Heemstedestraat | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30004321](https://www.gvb.nl/reisinformatie/halte/NL:Q:30004321) |
| Henk Sneevlietweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30004319](https://www.gvb.nl/reisinformatie/halte/NL:Q:30004319) |
| Isolatorweg | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30002297](https://www.gvb.nl/reisinformatie/halte/NL:Q:30002297) |
| Jan van Galenstraat | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30003203](https://www.gvb.nl/reisinformatie/halte/NL:Q:30003203) |
| Kraaiennest | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009548](https://www.gvb.nl/reisinformatie/halte/NL:S:30009548) |
| Nieuwmarkt | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009502](https://www.gvb.nl/reisinformatie/halte/NL:S:30009502) |
| Noord | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009571](https://www.gvb.nl/reisinformatie/halte/NL:S:30009571) |
| Noorderpark | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009573](https://www.gvb.nl/reisinformatie/halte/NL:S:30009573) |
| Overamstel | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30009563](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009563) |
| Postjesweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30004325](https://www.gvb.nl/reisinformatie/halte/NL:Q:30004325) |
| Reigersbos | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30009529](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009529) |
| Rokin | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009577](https://www.gvb.nl/reisinformatie/halte/NL:S:30009577) |
| Spaklerweg | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:S:30009518](https://www.gvb.nl/reisinformatie/halte/NL:S:30009518) |
| Station Bijlmer ArenA | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30009522](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009522) |
| Station Diemen Zuid | ❌ not step-free | lift out of service (GVB lift faults, since Nov 2023) | [NL:S:30009542](https://www.gvb.nl/reisinformatie/halte/NL:S:30009542) |
| Station Duivendrecht | ❌ not step-free | **not checked yet** | search on GVB |
| Station Holendrecht | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30000171](https://www.gvb.nl/reisinformatie/halte/NL:Q:30000171) |
| Station Lelylaan | ❌ not step-free | lift out of service (GVB lift faults) | [NL:S:30004322](https://www.gvb.nl/reisinformatie/halte/NL:S:30004322) |
| Station RAI | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30007404](https://www.gvb.nl/reisinformatie/halte/NL:Q:30007404) |
| Station Sloterdijk | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30002294](https://www.gvb.nl/reisinformatie/halte/NL:S:30002294) |
| Station Zuid | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30007408](https://www.gvb.nl/reisinformatie/halte/NL:S:30007408) |
| Strandvliet | ❌ not step-free | GVB: niet rolstoelvriendelijk | [NL:Q:30009521](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009521) |
| Van der Madeweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30009517](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009517) |
| Venserpolder | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009540](https://www.gvb.nl/reisinformatie/halte/NL:S:30009540) |
| Verrijn Stuartweg | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009544](https://www.gvb.nl/reisinformatie/halte/NL:S:30009544) |
| Vijzelgracht | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:Q:30009579](https://www.gvb.nl/reisinformatie/halte/NL:Q:30009579) |
| Waterlooplein | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009508](https://www.gvb.nl/reisinformatie/halte/NL:S:30009508) |
| Weesperplein | ❌ not step-free | lift out of service (GVB lift faults, exit Stadstimmertuin, since 2026-10-28) | [NL:S:30009510](https://www.gvb.nl/reisinformatie/halte/NL:S:30009510) |
| Wibautstraat | ✅ step-free | GVB: Rolstoelvriendelijk | [NL:S:30009512](https://www.gvb.nl/reisinformatie/halte/NL:S:30009512) |

Keep this table in step with `accessibility.json` when a station changes.

## Open items

- **Duivendrecht**: not checked yet, so "no". Find its metro stop on GVB's site.
- **Centraal Station**: checked via `NL:Q:30009905`, which may be the ferry stop rather than the metro. Recheck on a page that lists lines 51–54.
- **Amstelstation**: has no GVB code here yet; add it at the next check.
- **Weesperplein, Diemen Zuid, Lelylaan**: set back to "yes" and remove `lift_out` once GVB's lift faults no longer list their lift.
- **Search terms**: checked against a live fault for Weesperplein, Diemen Zuid, Lelylaan, Centraal and Station Zuid. The others are GVB's station names, shortened; confirm each when it first shows a fault.

## Check log

Newest first. One line per check, even when nothing changed.

| Date | Kind | Result | By |
|---|---|---|---|
| 2026-10-29 | lift faults | Bullewijk's lift no longer listed; station page still Rolstoelvriendelijk (metro 50/54) → yes. New fault at Weesperplein (lift street–hall, exit Stadstimmertuin) → no. Diemen Zuid and Lelylaan still listed → stay no. Centraal Station also has a lift fault (already no). Escalator faults (Noorderpark, Rokin, Vijzelgracht, Zuid, Rietlandpark) don't change step-free. Still 26 step-free. | maintainer + Claude |
| 2026-10-27 | full | First check of all 39 stations on GVB's pages. 26 step-free, 13 not (9 "niet rolstoelvriendelijk", 3 lift out of service, Duivendrecht unchecked). OSM had 7 wrong. | maintainer + Claude |
