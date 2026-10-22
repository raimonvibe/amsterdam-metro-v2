# Demo clock: seeing trains outside service hours

Proposal, not implemented. Recorded Oct 2026 while building the train hover popup.

## Problem

The metro runs roughly 06:00-00:30. Outside those hours `/api/trains` is empty, so anything that only shows on a train (the hover popup, follow mode, trails, delay pulse) cannot be checked locally at night.

While building the popup this was worked around by hand: trains were solved for a daytime moment from the cached GTFS subset and fed to one browser tab by patching `window.fetch`. That works, but it lives only in that tab, is lost on every reload, and trains stop once they reach their next station.

## Proposal

A dev-only environment variable that shifts the backend's clock:

```bash
DEMO_CLOCK_OFFSET_H=7
```

When set, the trains and departures handlers in [`backend/app/main.py`](../backend/app/main.py) call the solver with `now = time.time() + offset` instead of `time.time()`. Everything downstream already takes `now` as a parameter (`MetroData.trains()`, `MetroData.departures()`), so the change is confined to where `now` is read.

Read it in [`backend/app/config.py`](../backend/app/config.py) next to the other env settings, defaulting to 0.

## Things to get right

- **Timestamps.** Shifted `next_arrival_ts`, `prev_departure_ts` and `final_arrival_ts` would be hours ahead of the browser clock, so the popup would show "420 min" and progress stuck at 0%. Either shift them back by the offset before serialising, or have the client apply the same offset. Shifting back on the server keeps the client unaware of the mode.
- **Realtime.** Live tripUpdates describe the real now, not the shifted one. Ignore realtime while the offset is non-zero, so the map is a clean schedule-only replay.
- **Never in production.** Log a warning at startup when the offset is set, and consider refusing it unless an explicit dev flag is also present. `render.yaml` must not set it.
- **Status badge.** `is_live` should report false while shifted, so the LIVE badge does not claim live data.

## Effort

Small: one config value, two call sites, the timestamp shift, and a startup log line. Best as its own PR, separate from UI work.
