// Plain unit checks (no browser) for the clock: what "today" and "now" are, in
// the app's own time zone (not the device's, and not UTC), and how the
// reporting window of months and the date arithmetic behave — across month,
// year and leap-day boundaries.
import { spawnSync } from "child_process";
import { installFixedDate, setFixedNow, DEFAULT_TEST_NOW } from "./fakeClock.mjs";
import {
  APP_TIME_ZONE, WINDOW_MONTHS, now, todayISO, timeHHMM, timestampISO, currentDay,
  monthWindow, getMonths, currentMonthAbbr, windowStartISO, monthAbbrInWindow,
  addDaysISO, daysBetweenISO,
} from "../src/utils/clock.js";

let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) { failures++; console.log(`FAIL — ${name}${detail ? "  → " + detail : ""}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

check("the app's time zone is Asia/Tashkent", APP_TIME_ZONE === "Asia/Tashkent");

// ---------- "now" is read from the clock, in the app's zone ----------
installFixedDate(DEFAULT_TEST_NOW);
check("a pinned instant: today / time / timestamp", todayISO() === "2026-09-08" && timeHHMM() === "14:30" && timestampISO() === "2026-09-08T14:30:00", `${todayISO()} ${timeHHMM()} ${timestampISO()}`);
check("currentDay", currentDay() === 8);
check("now() is the pinned instant", now().getTime() === new Date("2026-09-08T09:30:00Z").getTime());

// 19:30 UTC is already 00:30 the NEXT day in Tashkent — "today" follows the app's zone, not UTC
setFixedNow("2026-09-08T19:30:00Z");
check("00:30 Tashkent time is the next calendar day, even though UTC is still the 8th", todayISO() === "2026-09-09" && timeHHMM() === "00:30", `${todayISO()} ${timeHHMM()}`);
setFixedNow("2026-09-08T18:59:59Z");
check("23:59:59 Tashkent time is still the 8th", todayISO() === "2026-09-08" && timeHHMM() === "23:59" && timestampISO() === "2026-09-08T23:59:59");
setFixedNow("2026-12-31T19:00:00Z");
check("across a year boundary (midnight Tashkent = 1 Jan)", todayISO() === "2027-01-01" && timeHHMM() === "00:00", `${todayISO()} ${timeHHMM()}`);

// the SAME instant gives the SAME answer whatever time zone the device is set to
{
  const script = `
    import { installFixedDate } from ${JSON.stringify(new URL("./fakeClock.mjs", import.meta.url).href)};
    import { todayISO, timeHHMM } from ${JSON.stringify(new URL("../src/utils/clock.js", import.meta.url).href)};
    installFixedDate("2026-09-08T14:30:00+05:00");
    console.log(todayISO() + " " + timeHHMM());`;
  const results = ["UTC", "America/Los_Angeles", "Pacific/Auckland", "Asia/Tashkent"].map(tz =>
    spawnSync(process.execPath, ["--input-type=module", "-e", script], { env: { ...process.env, TZ: tz }, encoding: "utf8" }).stdout.trim());
  check("device time zone makes no difference (UTC, Los Angeles, Auckland, Tashkent all agree)", results.every(r => r === "2026-09-08 14:30"), JSON.stringify(results));
}

// ---------- the reporting window of months ----------
const win = (today, n) => monthWindow(today, n).map(m => m.abbr + "=" + m.ym);
check("window ending in September 2026 is Mar–Sep (the range the app always showed)",
  eq(win("2026-09-08"), ["Mar=2026-03", "Apr=2026-04", "May=2026-05", "Jun=2026-06", "Jul=2026-07", "Aug=2026-08", "Sep=2026-09"]));
check("window ending 6 Oct 2026 is Apr–Oct", eq(getMonths("2026-10-06"), ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"]));
check("window crossing a year boundary keeps each month's real year", eq(win("2027-01-10"), ["Jul=2026-07", "Aug=2026-08", "Sep=2026-09", "Oct=2026-10", "Nov=2026-11", "Dec=2026-12", "Jan=2027-01"]));
check("the window always has WINDOW_MONTHS months and ends on the current month",
  WINDOW_MONTHS === 7 && ["2026-01-01", "2026-12-31", "2028-02-29", "2026-09-08"].every(d => monthWindow(d).length === 7 && monthWindow(d).at(-1).ym === d.slice(0, 7)));
check("months in a window are all different abbreviations (a 12-month window is the limit)", new Set(getMonths("2026-09-08", 12)).size === 12);
let threw = false; try { monthWindow("2026-09-08", 13); } catch { threw = true; }
check("a window longer than 12 months is refused (abbreviations would repeat)", threw);
check("currentMonthAbbr", currentMonthAbbr("2026-10-06") === "Oct" && currentMonthAbbr("2027-01-10") === "Jan");
check("windowStartISO is the first day of the first month", windowStartISO("2026-09-08") === "2026-03-01" && windowStartISO("2027-01-10") === "2026-07-01" && windowStartISO("2026-10-06") === "2026-04-01");

// ---------- a date belongs to the window only with its YEAR ----------
check("a date inside the window maps to its month", monthAbbrInWindow("2026-05-08", "2026-09-08") === "May" && monthAbbrInWindow("2026-09-08", "2026-09-08") === "Sep");
check("the whole current month counts, including days still to come (e.g. homework due later this month)", monthAbbrInWindow("2026-09-30", "2026-09-08") === "Sep");
check("the SAME month name in another year is NOT in the window (no May-2025-as-May-2026 mix-up)", monthAbbrInWindow("2025-05-08", "2026-09-08") === null && monthAbbrInWindow("2027-05-08", "2026-09-08") === null);
check("before the window / after the current month → null", monthAbbrInWindow("2026-02-28", "2026-09-08") === null && monthAbbrInWindow("2026-10-01", "2026-09-08") === null);
check("across New Year: Jan 2027 is in, Jan 2026 is not", monthAbbrInWindow("2027-01-05", "2027-01-10") === "Jan" && monthAbbrInWindow("2026-01-05", "2027-01-10") === null && monthAbbrInWindow("2026-07-01", "2027-01-10") === "Jul");

// ---------- date arithmetic on plain date strings (no time zones involved) ----------
check("addDaysISO across a month end", addDaysISO("2026-09-08", 30) === "2026-10-08" && addDaysISO("2026-09-30", 1) === "2026-10-01");
check("addDaysISO across a year end and backwards", addDaysISO("2026-12-31", 1) === "2027-01-01" && addDaysISO("2027-01-01", -1) === "2026-12-31");
check("addDaysISO knows leap years", addDaysISO("2028-02-28", 1) === "2028-02-29" && addDaysISO("2027-02-28", 1) === "2027-03-01" && addDaysISO("2026-03-01", -1) === "2026-02-28");
check("daysBetweenISO counts whole days, signed", daysBetweenISO("2026-09-08", "2026-09-13") === 5 && daysBetweenISO("2026-09-13", "2026-09-08") === -5 && daysBetweenISO("2026-09-08", "2026-09-08") === 0);
check("daysBetweenISO across a year end and a leap day", daysBetweenISO("2026-12-30", "2027-01-02") === 3 && daysBetweenISO("2028-02-28", "2028-03-01") === 2);

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("PASS — clock: app-zone today/time, device-zone independence, rolling month window across year ends, year-aware window membership, date arithmetic");
