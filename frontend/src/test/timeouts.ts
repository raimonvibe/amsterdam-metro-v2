/** Timeout for tests that render the whole travel page in jsdom. Measured
 *  2 Nov 2026 on 8 cores: ~0.3 s per test alone, 2–2.6 s in a full `npm test`
 *  (8 files at once), so Vitest's 5 s default left 2× headroom and timed out
 *  under extra load (a dev server running). 10 s is ~4× the full-run worst
 *  case and still far below a real hang. If these tests creep towards it,
 *  make the page cheaper to render rather than raising this again. */
export const PAGE_TEST_TIMEOUT = 10_000;
