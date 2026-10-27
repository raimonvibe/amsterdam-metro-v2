# Notes for AI agents

Project overview, stack and commands: [README.md](README.md). Design notes live in [`docs/`](docs/).

## Step-free station data

Read **[docs/step-free-stations.md](docs/step-free-stations.md)** before touching [`frontend/src/data/accessibility.json`](frontend/src/data/accessibility.json), the ♿ markers, station-card accessibility lines or the planner's "Zonder trappen" option.

- A station is step-free only when GVB's station page says "Rolstoelvriendelijk"; anything unconfirmed is `"no"`. Never set `"yes"` from OpenStreetMap, memory or a search result.
- A broken metro lift (GVB's lift faults) makes a station `"no"` until the fault is gone.
- Check GVB's site by hand in a browser at a normal pace. Do not script requests to gvb.nl, call its internal APIs, or work around its bot protection.
- Every check, even one that changes nothing, gets a dated line in the doc's check log.
- `npm test` in `frontend/` enforces the rule; keep it passing.
