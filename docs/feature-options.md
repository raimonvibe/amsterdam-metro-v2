# What to add next: ten options, weighed against the evidence

Research into where the app could grow, from its own code, the live OVapi feeds, and published work on what transit riders value. Written 24 Oct 2026.

Related: [position-model.md](position-model.md), [`backend/app/realtime.py`](../backend/app/realtime.py)

---

## 1. Method

1. **The app.** README, API routes, frontend and `docs/position-model.md` read for what exists today.
2. **The live data.** OVapi's feeds downloaded at **06:16 CEST, Saturday 24 Oct 2026**, and decoded. One sample, early in the service day.
3. **Online.** Research on what riders value in transit apps, Amsterdam news, and what web apps can do on phones in 2026.

## 2. Where the app stands

Strong at one thing: an estimated, animated picture of the metro, with a solid travel-info page beside it. Three gaps:

- **One live feed.** Only `tripUpdates.pb` (predicted arrival times) is read. OVapi also publishes `alerts.pb` and `vehiclePositions.pb`.
- **Metro only.** Lines 50-54; nothing else GVB runs.
- **Dutch only, minimal PWA.** One language file (`nl.ts`), no service worker, one app icon.

## 3. Findings from the live data

**A. Metro trains are in `vehiclePositions.pb`, but with no GPS.** 13 metro trains across all five lines, every one at coordinates 0,0. Each does carry:

- the stop it is at or heading to (`stop_id`)
- a status: `STOPPED_AT` or `IN_TRANSIT_TO`
- a timestamp; the last report was **3 to 493 seconds** old

This answers the first open check in `position-model.md`: no real metro positions. What there is instead is **the signalling system confirming a train at a platform**, the confidence signal that document's critique asks for.

**B. Trams, buses and ferries carry real GPS** in the same feed (59 GVB vehicles with real coordinates).

**C. GVB publishes KV15 service alerts in Dutch and English**, e.g. "Bus 36 does not serve La Guardiaweg". 38 GVB alerts at sampling time, none for metro.

**D. The timetable has no accessibility data.** `wheelchair_boarding` is empty for all ~400 metro stops in the national GTFS.

## 4. Options

### Tier 1: high value, data already free

**1. Confirmed stops in train positions** (effort S-M). Pin a train reported `STOPPED_AT` to its platform; mark trains without a recent confirmation as estimated. Closes findings 2 and 3 of `position-model.md` without moving any dot somewhere it is not.

**2. Service alerts** (S-M). `alerts.pb` on the station board, the line view and a map banner. Text is already bilingual. Matters most when the network fails: [NH Nieuws](https://www.nhnieuws.nl/nieuws/362526/alle-metros-in-amsterdam-staan-stil-door-storing-verkeersleidingsysteem) reports the whole metro stopping after a signalling-system failure, when the map would otherwise show ghost trains.

### Tier 2: wider audience

**3. English UI** (M). The audience londonunderground.live reaches, plus Amsterdam's visitors. The alerts already carry English.

**4. Trams and ferries** (M-L). Real GPS, no solver needed. Costs map clutter and deck.gl load: needs per-mode toggles and profiling.

**5. Offline PWA and push** (M). "Disruption on my line" or "leave now for the 08:12". iOS web push works only for home-screen apps (16.4+) and is reported as unreliable ([OneSignal](https://documentation.onesignal.com/docs/en/web-push-for-ios)). One source says it does not work in the EU under the DMA ([MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide)); unconfirmed. Push needs server-side subscriptions, so a privacy-policy change.

### Tier 3: insight and delight

**6. Step-free access and lift status** (L, no data source). Lifts were out at [14 of 38 metro stations](https://nos.nl/l/2545215); AT5 cites [388 faults a year averaging 31 h downtime](https://www.at5.nl/artikelen/211660/mogelijk-traplift-als-alternatief-voor-kapotte-liften-op-metrostations); GVB will [replace all 93 lifts and 177 escalators from 2027](https://www.nhnieuws.nl/nieuws/350636/gvb-gaat-alle-93-liften-en-177-roltrappen-vervangen). No open feed was found and the GTFS is empty (finding D), so this needs curated station data plus lift messages from the alerts.

**7. Punctuality history and replay** (M). Delay heatmap per segment and hour; replay of a disruption. Builds on punctuality the app already computes; needs storage the backend lacks.

**8. Crowding** (blocked). Strongest research case: crowding information measurably shifts route choice (Metro Vancouver, *Transportation* 2025); riders will wait 8-23 minutes for a less crowded vehicle ([Napier](https://napier-repository.worktribe.com/OutputFile/3036668)); [Transit's 2020 survey](https://resources.transitapp.com/article/305-transits-rider-survey-about-crowding) found real-time crowding the only kind that would make most ride more (company-run, pandemic-era). GVB's feed has no `occupancy_status`, so anything now would be a schedule guess.

**9. Future network mode** (S). Noord/Zuidlijn to Schiphol is [not settled](https://nos.nl/l/2314372); sources date from around 2022. Low priority.

## 5. Comparison

| # | Option | Impact | Effort | Data ready? | Risk |
|---|---|---|---|---|---|
| 1 | Confirmed stops in positions | High | S-M | yes, live | Low |
| 2 | Service alerts | High | S-M | yes, live | Low |
| 3 | English | Med-High | M | yes | Low |
| 4 | Trams / ferries | High | M-L | yes, GPS | Map load |
| 5 | Offline PWA + push | Medium | M | yes | iOS / EU |
| 6 | Lift status | High (niche) | L | no | Data upkeep |
| 7 | History / replay | Medium | M | needs storage | Hosting cost |
| 8 | Crowding | High | - | no | Guesswork |
| 9 | Future network | Low | S | speculative | Dates fast |

**Recommended order:** 1, 2, 3, 4, then 7. Options 1 and 2 use data already downloaded for free, and fix the app's weakest point: looking certain when it is not.

## 6. Limits

- The feed check is one early-Saturday snapshot; confirmation ages and coverage may differ at rush hour.
- No lift feed was found, but GVB's own app and site were not inspected.
- The EU web-push question is open.
- The Schiphol-extension sources are dated.

## Sources

[NOS: lifts out at 14 stations](https://nos.nl/l/2545215) · [AT5: lift faults](https://www.at5.nl/artikelen/211660/mogelijk-traplift-als-alternatief-voor-kapotte-liften-op-metrostations) · [NH Nieuws: lift replacement](https://www.nhnieuws.nl/nieuws/350636/gvb-gaat-alle-93-liften-en-177-roltrappen-vervangen) · [NH Nieuws: network-wide stoppage](https://www.nhnieuws.nl/nieuws/362526/alle-metros-in-amsterdam-staan-stil-door-storing-verkeersleidingsysteem) · [DOVA KPI report (KV15/KV17)](https://dova.nu/sites/default/files/kpi_jaarrapportage_2018.pdf) · [Transit crowding survey](https://resources.transitapp.com/article/305-transits-rider-survey-about-crowding) · [Mass Transit on occupancy](https://www.masstransitmag.com/technology/passenger-info/article/21154973/occupancy-data-a-real-crowd-pleaser) · [Napier willingness-to-wait](https://napier-repository.worktribe.com/OutputFile/3036668) · [U. Alberta thesis](https://era.library.ualberta.ca/items/540fc004-80f9-4377-a02a-d8e700fe9cce) · [UCITS brief](https://ucits.org/?p=12791) · [MagicBell iOS PWA](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) · [OneSignal iOS push](https://documentation.onesignal.com/docs/en/web-push-for-ios) · [NOS: Schiphol extension](https://nos.nl/l/2314372) · [Treinreiziger: metro to Schiphol](https://www.treinreiziger.nl/in-2030-per-metro-naar-schiphol/)
