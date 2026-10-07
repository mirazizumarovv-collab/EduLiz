// The one place the app asks "what day / time is it?".
//
// It reads the REAL clock. There is no demo date any more: tests pin `Date`
// from outside (see e2e/fakeClock.mjs) instead of the app carrying a fixed
// "2026-09-08" inside it.
//
// "Today" is the day in the CENTER'S time zone (APP_TIME_ZONE), not the
// device's and not UTC. A parent travelling abroad, or a phone with the wrong
// zone, still sees the same "today" the center does — payment deadlines,
// attendance and homework due dates are all the center's calendar days. (An
// instant like 19:30 UTC is already 00:30 the next day in Tashkent.)
//
// Dates are passed around as plain "YYYY-MM-DD" strings, and all date
// arithmetic here works on those strings directly. `new Date("2026-09-08")`
// is midnight UTC, which in a zone behind UTC is still the 7th — so Date
// objects are only used to read the current instant, never to do calendar math.

export const APP_TIME_ZONE = "Asia/Tashkent";

// How many calendar months the monthly views span, ending with the current
// month. The month abbreviations (Mar, Apr, …) are only unambiguous inside a
// window of at most 12 months, so this can't exceed 12.
export const WINDOW_MONTHS = 7;

export const MONTH_ABBREVS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ZONED = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE, hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function zoneParts(at) {
  const p = {};
  for (const part of ZONED.formatToParts(at)) p[part.type] = part.value;
  return { y: p.year, mo: p.month, d: p.day, h: String(Number(p.hour) % 24).padStart(2, "0"), mi: p.minute, s: p.second };
}

const pad2 = (n) => String(n).padStart(2, "0");

// The current instant. (A function, not a constant: it must be asked again each time.)
export function now() { return new Date(); }

export function todayISO(at = now()) { const p = zoneParts(at); return `${p.y}-${p.mo}-${p.d}`; }
export function timeHHMM(at = now()) { const p = zoneParts(at); return `${p.h}:${p.mi}`; }
// "2026-09-08T14:30:05" — the center's wall-clock time, same shape as the stored timestamps.
export function timestampISO(at = now()) { const p = zoneParts(at); return `${p.y}-${p.mo}-${p.d}T${p.h}:${p.mi}:${p.s}`; }
export function currentDay(today = todayISO()) { return Number(today.slice(8, 10)); }

// ---------- the rolling window of months ----------
const ymNum = (ym) => Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1);
const ymFromNum = (n) => `${Math.floor(n / 12)}-${pad2((n % 12) + 1)}`;

// "2026-09" shifted by n months ("2026-09", -9 → "2025-12").
export function shiftYM(ym, n) { return ymFromNum(ymNum(ym) + n); }

// The last `count` months ending with the month of `today`, oldest first:
// [{ abbr: "Mar", ym: "2026-03" }, …, { abbr: "Sep", ym: "2026-09" }].
export function monthWindow(today = todayISO(), count = WINDOW_MONTHS) {
  if (count < 1 || count > 12) throw new RangeError("monthWindow: count must be between 1 and 12 (month abbreviations repeat beyond that)");
  const end = ymNum(today.slice(0, 7));
  const out = [];
  for (let n = end - count + 1; n <= end; n++) {
    const ym = ymFromNum(n);
    out.push({ abbr: MONTH_ABBREVS[Number(ym.slice(5, 7)) - 1], ym });
  }
  return out;
}

export function getMonths(today = todayISO(), count = WINDOW_MONTHS) { return monthWindow(today, count).map(m => m.abbr); }
export function currentMonthAbbr(today = todayISO()) { return MONTH_ABBREVS[Number(today.slice(5, 7)) - 1]; }
// First day of the oldest month in the window.
export function windowStartISO(today = todayISO(), count = WINDOW_MONTHS) { return `${monthWindow(today, count)[0].ym}-01`; }

// Which month of the window a date falls in — or null if it is outside. This is
// where the YEAR matters: "2025-05-08" and "2026-05-08" are both "May", but
// only one of them can be in a window. Everything that files a date under a
// month goes through here, so old data never lands in a current month's row.
export function monthAbbrInWindow(dateStr, today = todayISO(), count = WINDOW_MONTHS) {
  const hit = monthWindow(today, count).find(m => m.ym === String(dateStr).slice(0, 7));
  return hit ? hit.abbr : null;
}

// ---------- calendar arithmetic on "YYYY-MM-DD" strings ----------
const toDayNumber = (iso) => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000);

export function addDaysISO(iso, days) {
  const d = new Date((toDayNumber(iso) + days) * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
// Whole days from `from` to `to` (negative if `to` is earlier).
export function daysBetweenISO(from, to) { return toDayNumber(to) - toDayNumber(from); }
