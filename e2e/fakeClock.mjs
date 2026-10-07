// A controllable clock for tests.
//
// The app reads the real clock (src/utils/clock.js) — there is no "demo date"
// in it any more. Tests pin `Date` to a chosen instant so every result is
// reproducible, and can move it forward to simulate time passing.
//
// installFixedDate is deliberately self-contained (it only touches globalThis
// and its argument) so the SAME function runs in two places: called directly
// in Node for plain unit tests, and handed to Playwright's addInitScript so it
// runs in the page before the app's code does.
export function installFixedDate(isoInstant) {
  const g = globalThis;
  if (!g.__RealDate) g.__RealDate = g.Date;
  const RealDate = g.__RealDate;
  g.__fakeNowMs = new RealDate(isoInstant).getTime();
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(g.__fakeNowMs);
      else super(...args);
    }
    static now() { return g.__fakeNowMs; }
  }
  g.Date = FixedDate;
}

// Move the pinned clock to another instant (Node side).
export function setFixedNow(isoInstant) {
  globalThis.__fakeNowMs = new globalThis.__RealDate(isoInstant).getTime();
}

// The clock every browser test starts from unless it asks for another:
// 8 Sep 2026, 14:30 in Tashkent (UTC+5) — the date the whole suite was written
// against, now supplied from OUTSIDE the app instead of baked into it.
export const DEFAULT_TEST_NOW = "2026-09-08T14:30:00+05:00";
