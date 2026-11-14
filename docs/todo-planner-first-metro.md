# To do: planner shows the first metro at night (paused 14 Nov 2026)

Branch `feat/planner-first-metro` (pushed, no PR yet). At night the planner said "no connection" because it only looks 90 minutes ahead and the first metro (~05:51) is further away.

Done:
- Backend (`backend/app/travel.py`): when nothing leaves the origin within 90 minutes, `journeys()` looks up to 8 hours ahead for the first metro and returns those journeys with `first_metro: true`. Tests in `backend/tests/test_travel.py` pass.
- Frontend: `first_metro?` on `Journey` (`travel/types.ts`); `firstMetro` sentence in `travel/strings.ts` (nl/en); shown above the list in `JourneyPlanner.tsx`.

Left:
- [ ] Frontend test in `travel/components.test.tsx` next to "explains an empty result": journeys with `first_metro: true` show "De metro rijdt nu niet…".
- [ ] `npx tsc --noEmit` and `npm test` in `frontend/` (not run yet).
- [ ] Check in the browser (local backend + `frontend-preview-local`) at night or with a fixed time.
- [ ] Open the PR. Also still open: #262 (shorter "Metro 53 rijdt vandaag niet.").
