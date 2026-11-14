# Service notices next to GVB's messages

The map, the station cards and the travel page show GVB's own service messages (KV15, via OVapi). Two more kinds of message go through the same `/api/alerts` list, each marked with its `source`, so the site never passes its own words off as GVB's:

| `source` | What | Label under the message |
|---|---|---|
| `gvb` | GVB's KV15 message | none (the list is GVB's by default) |
| `timetable` | A line with no trips on today's service day, though it has trips the day before or after | "Volgens de dienstregeling" / "From the timetable" |
| `site` | A notice set by hand in [`backend/app/notices.json`](../backend/app/notices.json) | "Melding van amsterdammetro.nl" / "Notice from amsterdammetro.nl" |

## "Metro 53 rijdt vandaag niet"

"Metro 53 rijdt vandaag niet." The label under it says where it comes from. Worked out by the backend (`lines_not_running` in [`travel.py`](../backend/app/travel.py)) from the static timetable it already holds: yesterday, today and tomorrow. Nothing to maintain.

- The service day starts at 04:00, as for first and last trains: at 02:00 on Saturday it is still Friday.
- A line needs trips on another of those days. A line that is gone for good (the old numbers after the switch of December 2027) is not reported every day.
- If the timetable does not cover today, it says nothing rather than guess.
- Once GVB posts its own message naming that line, ours is left out: GVB's word comes first and says more (where to change). Lift and accessibility messages don't count. GVB's test-weekend messages carry no usable effect and name only some stations, so naming the line is what counts.

## Setting a notice by hand

For planned works that GVB announces on its site but not (yet) in its live messages, such as the test weekends of the new metro network. Add an entry to `backend/app/notices.json`, open a PR, and the notice shows from `start` to `end` once the backend is deployed.

```json
{
  "id": "testweekend-2026-11",
  "start": "2026-11-14T04:00",
  "end": "2026-11-16T04:00",
  "lines": ["50", "51", "52", "53", "54"],
  "stations": [],
  "header": { "nl": "…", "en": "…" },
  "description": null,
  "effect": "MODIFIED_SERVICE",
  "source_url": "https://www.gvb.nl/…",
  "added": "2026-11-14"
}
```

- `start`, `end`: Amsterdam time, no offset. A service day ends at 04:00, so a weekend runs from Saturday 04:00 to Monday 04:00.
- `lines`: the lines it concerns. With no `stations`, it is about the whole line(s).
- `stations`: full station names as in the timetable (`"Amsterdam, Waterlooplein"`), for a notice about some stations only.
- `header`: Dutch and English, short. Say only what GVB says; point riders to GVB for the details.
- `source_url`: where GVB announced it. Required, so every notice can be checked.
- Remove a notice some time after it ends; an expired one is ignored but clutters the file.

`backend/tests/test_notices.py` checks the file on every run: unique ids, `start` before `end`, both languages, known lines, a source. A broken file hides only the hand-set notices, never GVB's own.
