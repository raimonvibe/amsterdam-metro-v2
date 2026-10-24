# Train position model: interpolation vs. confirmed stops

Why the dot on the map is where it is, what that representation does and does not claim, and which parts of it are worth changing.

Prompted by external feedback (Sep 2026) arguing that interpolating between stops is dishonest, and that the marker should instead be pinned to the last confirmed stop until the next departure. This document records what the code actually does, what the feedback gets right, and what is recommended.

Related: [`backend/app/positions.py`](../backend/app/positions.py), [`backend/app/realtime.py`](../backend/app/realtime.py)

---

## How a position is solved today

`MetroData._solve()` walks the stop list of an active trip and returns the first stop whose window contains `now`:

| Branch | Condition | Result |
|---|---|---|
| **moving** | `now < arr[i]` | Linear interpolation of distance-along-shape from `dist[i-1]` to `dist[i]`, by clock progress from `dep[i-1]` to `arr[i]` |
| **dwelling** | `arr[i] <= now <= dep[i]` | Pinned at `dist[i]`, `speed_m_s = 0.0` |

Times come from `_effective_times()`: static schedule, overridden per stop by GTFS-realtime where present, with the last known delay propagated forward to stops that have no update of their own.

The resulting position is mapped through `Shape.point_at()`, so the train always sits on real track geometry rather than on a straight line between stations.

---

## The critique

> No vehicle positions is the hard constraint. tripUpdates only name the next stops, so the dot on the shape is an interpolation - a train sitting at a platform looks like it's crawling the next segment if you lerp by clock time. Pinning the marker to the last confirmed stop until the next departure reads more honestly.

---

## Findings

### 1. The "no vehicle positions" premise is unverified - and possibly false

OVapi publishes `https://gtfs.ovapi.nl/nl/vehiclePositions.pb`. It is live and updates continuously (observed `last-modified` within 60 s of fetch). A sample pulled **2026-09-22 01:54 CEST** contained 37 vehicles nationally, of which 4 were GVB - routes **285** and **287**, both night buses.

Metro lines 50-54 do not run at that hour, so the sample is **inconclusive for metro**. It does establish that GVB publishes vehicle positions for at least some of its fleet, which makes the constraint worth testing rather than assuming.

Daytime re-check:

```bash
curl -s -A "AmsterdamMetroLive/2.0 (+https://amsterdammetro.nl)" -o vp.pb https://gtfs.ovapi.nl/nl/vehiclePositions.pb
```

If `50`-`54` appear among the GVB entities, real positions should replace the solver for those trips and the rest of this document is largely moot.

### 2. Dwell is modeled - but only as wide as the data makes it

The critique assumes an unconditional lerp. There is a dwell branch: a train whose `now` falls between arrival and departure is pinned at the platform with zero speed. A train at a stop does not crawl.

The caveat is that the branch is only as wide as `dep - arr`. GVB metro stop_times are expected to set `arrival_time == departure_time` at intermediate stops, as most metro and tram feeds do. If so the branch is zero-width in practice, the train never visibly stops, and roughly 20 s of real dwell per station is smeared into the segment interpolation - the same visible symptom the critique describes, arrived at by a different route.

**Unverified.** Confirm against the loaded subset before acting on it.

### 3. `realtime` is per-trip, not per-stop

`TrainOut.realtime` is set from `rt_trip is not None`. A trip whose realtime record covers only stops 1-3 still reports `realtime: true` at stop 18, where the position rests on static schedule plus a stale delay propagated by `_effective_times()`.

Nothing downstream corrects for this. `MetroMap.tsx` uses only `delay_s`, to tint delayed trains; the per-train `status` and `realtime` fields are not read at all, and `LiveBadge` reports feed-level `is_live` rather than per-train confidence. Every train on the map currently renders as equally certain.

This is the substantive gap the critique is circling, and it is independent of how positions are interpolated.

### 4. `times[i - 1]` wraps at `i == 0`

In the moving branch, `i == 0` would index `times[-1]` - the final stop of the trip - and interpolate from the end of the line back to its start.

Normally unreachable: the guard `first_dep <= now <= last_arr` means `now >= dep[0] >= arr[0]`, so `now < arr[0]` is false. But `arr` and `dep` are aligned independently through `_align_rt_epoch()`, so a realtime record yielding `arr[0] > dep[0]` makes it reachable and flings the train across the map. Cheap to close with an explicit guard.

---

## Assessment: pinning is the wrong trade

Pinning the marker to the last confirmed stop is rejected.

A train between Wibautstraat and Weesperplein genuinely *is* between them. Interpolation asserts something true at coarse resolution and guesses only the fine detail - where in the segment. Pinning asserts the train is **at a platform**, which is false for most of the time it is displayed. It is not a more honest claim about position; it is a less honest one. It is only more honest about *confidence*, and it pays for that by discarding the continuous movement the deck.gl layer exists to render.

The correct response to low confidence is to show low confidence, not to relocate the train to somewhere it is not.

---

## Recommended changes

| # | Change | Rationale | Depends on |
|---|---|---|---|
| 1 | Guard `i == 0` in the moving branch | Closes the wraparound in finding 4 | - |
| 2 | Make `realtime` per-segment; render schedule-only trains dimmer or hollow | Surfaces real confidence without moving the marker (finding 3) | - |
| 3 | Reserve a fixed dwell (~20 s) per stop where the feed gives none | Trains actually stop at platforms (finding 2) | Confirm finding 2 |
| 4 | Ease the interpolation instead of lerping linearly | Real metros accelerate at ~1.0-1.3 m/s2; linear motion is most visibly wrong at platform ends, where attention is | - |
| 5 | Consume `vehiclePositions.pb` for metro trips | Removes the guesswork entirely | Confirm finding 1 |

---

## Update, 24 Oct 2026: stop reports are now used

Checked at 06:16 and 06:40 CEST: `vehiclePositions.pb` carries all five metro lines, but **with no GPS** (latitude and longitude 0). Each entry does name the stop a train is at (`STOPPED_AT`) or heading to (`IN_TRANSIT_TO`), with a timestamp. Those reports reach OVapi 26-60 s after the event, and a few were 5-9 minutes old.

So change 5 cannot replace the solver, but the reports are confirmations, and `MetroData._confirm()` now uses them as bounds on the clock estimate:

| Report | Meaning used | Effect |
|---|---|---|
| at X, under `CONFIRM_FRESH_S` (120 s) | at X or beyond | a clock estimate short of X is moved up to X's platform |
| heading to X, under 120 s | left the stop before X | an estimate still before that stop starts on X's segment |
| heading to X, under `HEADING_HOLD_S` (60 s) | not yet at X | an estimate past X is held at X |

An estimate inside the bounds is left alone. Change 3 (a fixed dwell) was tried as "hold at the platform for 25 s after an at-report" and dropped: with the feed lag the train has usually left by the time the report arrives.

Change 2 is done as `TrainOut.confidence`: `confirmed` (a fresh report), `live` (realtime predictions only) or `schedule`. The map draws schedule-only trains fainter, and the train card names the latest report and its age. Change 1 is done as well (the `i == 0` guard in `_estimate()`). In the first live run, 15 of 18 trains were confirmed and 2-3 had their estimate corrected by 100-370 m.

## Open checks

- [x] Does `vehiclePositions.pb` carry GVB routes 50-54 during service hours? Yes, without GPS (see above).
- [ ] Do GVB metro stop_times set `arrival_time == departure_time` at intermediate stops?