import { monthWindow, todayISO } from "../../utils/clock.js";
import { attendanceRate, homeworkStats, groupComparisonLabel } from "./calculations.js";

const BASE_WEIGHTS = { grades: 0.6, attendance: 0.2, homework: 0.2 };

// The single composite formula used for EVERY month (not just the current
// one) — this is what makes the "Overall Score" headline and the "Overall
// Trend" chart underneath it the same metric, computed the same way. When a
// component has no data for a given month (e.g. no homework was assigned,
// or attendance wasn't recorded), its weight is renormalized across
// whichever components DO have data that month, rather than treating
// missing data as a zero.
function compositeScoreForMonth(gradeScore, attPct, hwPct) {
  const parts = [];
  if (gradeScore !== null && gradeScore !== undefined) parts.push({ v: gradeScore, w: BASE_WEIGHTS.grades });
  if (attPct !== null && attPct !== undefined) parts.push({ v: attPct, w: BASE_WEIGHTS.attendance });
  if (hwPct !== null && hwPct !== undefined) parts.push({ v: hwPct, w: BASE_WEIGHTS.homework });
  if (parts.length === 0) return null; // nothing known at all for this month
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  return Math.round(parts.reduce((s, p) => s + p.v * p.w, 0) / totalW);
}

// Combines attendance, grades, and homework into one coherent "parent
// analytics" view — first-to-last-month trends, month-over-month comparison,
// per-subject trends, and a narrative conclusion + recommendations built
// from real computed deltas (nothing invented).
// `today` is the day the report is for (default: the real current day); the months
// it covers are the window ending with that day's month.
export function computeParentAnalytics({ studentId, grades, attendanceData, homework, today = todayISO() }) {
  if (grades.length === 0) {
    // No subject has ever been graded, so there's no defined reporting
    // period to anchor attendance/homework to either (the real function
    // below derives everything from the grades' own month range) — every
    // field here is a safe, neutral default a caller can use directly
    // without crashing, even one that doesn't check hasGrades first.
    const emptySubjectStat = { name: null, score: 0, classAvg: 0, first: 0, firstMonth: null, last: 0, delta: 0 };
    return {
      hasGrades: false,
      firstGradeMonth: null, lastGradeMonth: null, gradeMonths: [],
      subjectTrends: [], academicByMonth: [], academicIsNewByMonth: [], compositeByMonth: [],
      overallFirst: null, overallLast: null, overallLastIsNew: false, overallDeltaSinceFirst: 0, overallPrevMonth: null, overallMoMDelta: 0,
      attByMonth: [], attFirst: null, attLast: null, attPrevMonth: null, attMoMDelta: 0, attFirstMonth: null, attLastMonth: null, attPrevMonthKey: null,
      hwByMonth: [], hwStatsOverall: homeworkStats(homework.pending, homework.history), hwCurrentMonthPct: 0, hwPrevMonthPct: 0, hwMoMDelta: 0, hwFirstMonth: null, hwLastMonth: null, hwPrevMonthKey: null,
      overallScore: null, overallWeights: { grades: 0, attendance: 0, homework: 0 },
      strongest: emptySubjectStat, needsAttention: emptySubjectStat, overallStatus: "stable",
      overallHasPrev: false, attHasPrev: false, hwHasPrev: false,
    };
  }
  const gradeMonths = grades[0].monthly.map(m => m.month);
  const firstGradeMonth = gradeMonths[0];
  const lastGradeMonth = gradeMonths[gradeMonths.length - 1];

  // --- Academic: per-subject first-to-last trend, and the pure grades-only
  // monthly series (used by the Academic Performance section specifically). ---
  const subjectTrends = grades.map(s => {
    const firstRealEntry = s.monthly.find(m => m.real) || s.monthly[0];
    const first = firstRealEntry.score;
    const firstMonth = firstRealEntry.month;
    const last = s.monthly[s.monthly.length - 1].score;
    return { name: s.name, score: s.score, classAvg: s.classAvg, first, firstMonth, last, delta: last - first };
  });
  // Only average subjects that have a REAL assessment for this specific
  // month — a subject's `monthly[i].score` for a month before its first
  // real assessment is a carried-forward placeholder (for chart
  // continuity only, see grades.js), not a genuine grade. Blending that
  // placeholder into this month's academic average would understate or
  // overstate the real picture using data that never happened.
  // "Known by month i" = this subject has had at least one REAL assessment
  // in month i or any earlier tracked month. True from a subject's first
  // real assessment onward (so its legitimately forward-carried score still
  // counts in later gap months with no new tests at all); false before
  // that (so another subject's value never gets backward-projected into
  // this one's average before it has ever actually been assessed).
  const academicByMonth = gradeMonths.map((_, i) => {
    const knownSubjects = grades.filter(s => s.monthly.slice(0, i + 1).some(m => m.real));
    if (knownSubjects.length === 0) return null; // nothing real yet for ANY subject this far
    return Math.round(knownSubjects.reduce((sum, s) => sum + s.monthly[i].score, 0) / knownSubjects.length);
  });
  // True only when at least one subject had a GENUINELY NEW assessment in
  // this exact month — distinct from academicByMonth's value being
  // non-null, which also covers months where every contributing subject's
  // score is carried forward from an earlier month. A display that pairs
  // a month's name with its score (e.g. "September: 80%") should check
  // this first and say "No new assessment" instead when it's false.
  const academicIsNewByMonth = gradeMonths.map((_, i) => grades.some(s => s.monthly[i].real));

  // --- Attendance: same reporting period as grades, but a month with no
  // actual attendance records is `pct: null` ("no data") rather than being
  // silently computed as 0% — those are not the same thing.
  const attByMonth = gradeMonths.map(m => {
    const days = attendanceData[m];
    return { month: m, pct: (days && days.length > 0) ? attendanceRate(days) : null };
  });
  const attWithData = attByMonth.filter(r => r.pct !== null);
  const attFirst = attWithData.length ? attWithData[0].pct : null;
  const attLast = attWithData.length ? attWithData[attWithData.length - 1].pct : null;
  const attPrevMonth = attWithData.length > 1 ? attWithData[attWithData.length - 2].pct : attFirst;
  const attMoMDelta = (attLast !== null && attPrevMonth !== null) ? attLast - attPrevMonth : 0;
  // The real months behind attFirst/attLast/attPrevMonth — NOT assumed to be
  // the same as gradeMonths' boundaries, since attendance can have gaps.
  const attFirstMonth = attWithData.length ? attWithData[0].month : null;
  const attLastMonth = attWithData.length ? attWithData[attWithData.length - 1].month : null;
  const attPrevMonthKey = attWithData.length > 1 ? attWithData[attWithData.length - 2].month : attFirstMonth;

  // --- Homework: sparse by nature (only months with assignments); looked up
  // by month key so composite scoring can skip months with no homework. ---
  const hwAll = [...homework.pending, ...homework.history];
  // Homework is filed under a month AND year (its `ym`, e.g. "2026-10"), so an
  // assignment due in October of a different year never lands in this October.
  const monthsInView = monthWindow(today);
  const monthsWithHw = monthsInView.filter(w => hwAll.some(h => h.ym === w.ym)).map(w => w.abbr);
  const ymOfMonth = new Map(monthsInView.map(w => [w.abbr, w.ym]));
  const hwByMonth = monthsWithHw.map(m => {
    const items = hwAll.filter(h => h.ym === ymOfMonth.get(m));
    const completed = items.filter(h => h.status === "completed").length;
    return { month: m, total: items.length, completed, pct: items.length ? Math.round((completed / items.length) * 100) : 0 };
  });
  const hwPctByMonthKey = new Map(hwByMonth.map(r => [r.month, r.pct]));
  const hwStatsOverall = homeworkStats(homework.pending, homework.history);
  // The window ENDS with the current month, so every month in it is "up to
  // now" by construction — homework due in a later month (or any other year)
  // is simply not in it. "Current" is the window's last month, not "the last
  // entry that happens to have homework", so a month with none doesn't make
  // an earlier month look current.
  const hwByMonthUpToNow = hwByMonth;
  const currentMonthAbbr = monthsInView[monthsInView.length - 1].abbr;
  const hwCurrentEntry = hwByMonthUpToNow.find(r => r.month === currentMonthAbbr) || hwByMonthUpToNow[hwByMonthUpToNow.length - 1] || null;
  const hwCurrentMonthPct = hwCurrentEntry ? hwCurrentEntry.pct : hwStatsOverall.completionRate;
  const hwCurrentIdx = hwCurrentEntry ? hwByMonthUpToNow.indexOf(hwCurrentEntry) : -1;
  const hwPrevEntry = hwCurrentIdx > 0 ? hwByMonthUpToNow[hwCurrentIdx - 1] : null;
  const hwPrevMonthPct = hwPrevEntry ? hwPrevEntry.pct : hwCurrentMonthPct;
  const hwMoMDelta = hwCurrentMonthPct - hwPrevMonthPct;
  const hwFirstMonth = hwByMonthUpToNow.length ? hwByMonthUpToNow[0].month : null;
  const hwLastMonth = hwCurrentEntry ? hwCurrentEntry.month : null;
  const hwPrevMonthKey = hwPrevEntry ? hwPrevEntry.month : hwFirstMonth;
  const hwHasPrev = hwPrevEntry !== null;
  const attHasPrev = attWithData.length > 1;

  // --- ONE composite series across the full reporting period. This is what
  // "Overall Score" and the "Overall Trend" chart both read from, so they
  // can never describe two different things on the same screen again. ---
  const compositeByMonth = gradeMonths.map((m, i) =>
    compositeScoreForMonth(academicByMonth[i], attByMonth[i].pct, hwPctByMonthKey.get(m))
  );
  const overallFirst = compositeByMonth[0];
  const overallLast = compositeByMonth[compositeByMonth.length - 1];
  const overallLastIsNew = academicIsNewByMonth[academicIsNewByMonth.length - 1];
  const overallDeltaSinceFirst = overallLast - overallFirst;
  // With only one month of data there is no earlier period to compare to.
  const overallHasPrev = compositeByMonth.length > 1;
  const overallPrevMonth = overallHasPrev ? compositeByMonth[compositeByMonth.length - 2] : overallLast;
  const overallMoMDelta = overallLast - overallPrevMonth;
  const overallScore = overallLast;

  // Actual weights used for the CURRENT month's score (may be renormalized
  // if attendance or homework had no data this month) — this is what the
  // "Based on grades (X%), attendance (Y%), homework (Z%)" caption reads.
  const currentHwPct = hwPctByMonthKey.get(lastGradeMonth);
  const currentAttPct = attLastMonth === lastGradeMonth ? attLast : null;
  const currentParts = [{ key: "grades", w: BASE_WEIGHTS.grades }];
  if (currentAttPct !== null) currentParts.push({ key: "attendance", w: BASE_WEIGHTS.attendance });
  if (currentHwPct !== undefined) currentParts.push({ key: "homework", w: BASE_WEIGHTS.homework });
  const currentTotalW = currentParts.reduce((s, p) => s + p.w, 0);
  const overallWeights = {
    grades: BASE_WEIGHTS.grades / currentTotalW,
    attendance: currentAttPct !== null ? BASE_WEIGHTS.attendance / currentTotalW : 0,
    homework: currentHwPct !== undefined ? BASE_WEIGHTS.homework / currentTotalW : 0,
  };

  // --- Strongest / needs-attention subject ---
  const strongest = subjectTrends.reduce((a, b) => (b.score > a.score ? b : a));
  const needsAttention = grades.reduce((a, b) => {
    const aBelow = a.score - a.classAvg;
    const bBelow = b.score - b.classAvg;
    return bBelow < aBelow ? b : a;
  });

  // --- A single, unambiguous headline status a parent sees first. ---
  const signals = [overallMoMDelta, attMoMDelta, hwMoMDelta];
  const decliningCount = signals.filter(s => s < -1).length;
  const improvingCount = signals.filter(s => s > 1).length;
  const hasWeakSubject = (needsAttention.score - needsAttention.classAvg) < -5;
  let overallStatus;
  if (overallMoMDelta < -1 || (overallDeltaSinceFirst < -2 && overallMoMDelta <= 0)) overallStatus = "declining";
  else if (decliningCount >= 2 || hasWeakSubject) overallStatus = "needsAttention";
  else if (overallMoMDelta > 1 || improvingCount >= 1 || overallDeltaSinceFirst > 3) overallStatus = "improving";
  else overallStatus = "stable";

  return {
    hasGrades: true,
    firstGradeMonth, lastGradeMonth, gradeMonths,
    subjectTrends, academicByMonth, academicIsNewByMonth, compositeByMonth,
    overallFirst, overallLast, overallLastIsNew, overallDeltaSinceFirst, overallPrevMonth, overallMoMDelta,
    attByMonth, attFirst, attLast, attPrevMonth, attMoMDelta, attFirstMonth, attLastMonth, attPrevMonthKey,
    hwByMonth, hwStatsOverall, hwCurrentMonthPct, hwPrevMonthPct, hwMoMDelta, hwFirstMonth, hwLastMonth, hwPrevMonthKey,
    overallScore, overallWeights, strongest, needsAttention, overallStatus,
    overallHasPrev, attHasPrev, hwHasPrev,
  };
}
