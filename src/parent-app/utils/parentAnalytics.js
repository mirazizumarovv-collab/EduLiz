import { MONTHS, CURRENT_MONTH } from "../constants/months.js";
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
  const parts = [{ v: gradeScore, w: BASE_WEIGHTS.grades }];
  if (attPct !== null && attPct !== undefined) parts.push({ v: attPct, w: BASE_WEIGHTS.attendance });
  if (hwPct !== null && hwPct !== undefined) parts.push({ v: hwPct, w: BASE_WEIGHTS.homework });
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  return Math.round(parts.reduce((s, p) => s + p.v * p.w, 0) / totalW);
}

// Combines attendance, grades, and homework into one coherent "parent
// analytics" view — first-to-last-month trends, month-over-month comparison,
// per-subject trends, and a narrative conclusion + recommendations built
// from real computed deltas (nothing invented).
export function computeParentAnalytics({ studentId, grades, attendanceData, homework }) {
  const gradeMonths = grades[0].monthly.map(m => m.month);
  const firstGradeMonth = gradeMonths[0];
  const lastGradeMonth = gradeMonths[gradeMonths.length - 1];

  // --- Academic: per-subject first-to-last trend, and the pure grades-only
  // monthly series (used by the Academic Performance section specifically). ---
  const subjectTrends = grades.map(s => {
    const first = s.monthly[0].score;
    const last = s.monthly[s.monthly.length - 1].score;
    return { name: s.name, score: s.score, classAvg: s.classAvg, first, last, delta: last - first };
  });
  const academicByMonth = gradeMonths.map((_, i) =>
    Math.round(grades.reduce((sum, s) => sum + s.monthly[i].score, 0) / grades.length)
  );

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
  const monthsWithHw = MONTHS.filter(m => hwAll.some(h => h.month === m));
  const hwByMonth = monthsWithHw.map(m => {
    const items = hwAll.filter(h => h.month === m);
    const completed = items.filter(h => h.status === "completed").length;
    return { month: m, total: items.length, completed, pct: items.length ? Math.round((completed / items.length) * 100) : 0 };
  });
  const hwPctByMonthKey = new Map(hwByMonth.map(r => [r.month, r.pct]));
  const hwStatsOverall = homeworkStats(homework.pending, homework.history);
  // Anchor "current"/"previous" to CURRENT_MONTH explicitly rather than
  // trusting "last item in the array" — a future-dated homework entry
  // should never be mistaken for the current month's data.
  const currentMonthIdx = MONTHS.indexOf(CURRENT_MONTH);
  const hwByMonthUpToNow = hwByMonth.filter(r => MONTHS.indexOf(r.month) <= currentMonthIdx);
  const hwCurrentEntry = hwByMonthUpToNow.find(r => r.month === CURRENT_MONTH) || hwByMonthUpToNow[hwByMonthUpToNow.length - 1] || null;
  const hwCurrentMonthPct = hwCurrentEntry ? hwCurrentEntry.pct : hwStatsOverall.completionRate;
  const hwCurrentIdx = hwCurrentEntry ? hwByMonthUpToNow.indexOf(hwCurrentEntry) : -1;
  const hwPrevEntry = hwCurrentIdx > 0 ? hwByMonthUpToNow[hwCurrentIdx - 1] : null;
  const hwPrevMonthPct = hwPrevEntry ? hwPrevEntry.pct : hwCurrentMonthPct;
  const hwMoMDelta = hwCurrentMonthPct - hwPrevMonthPct;
  const hwFirstMonth = hwByMonthUpToNow.length ? hwByMonthUpToNow[0].month : null;
  const hwLastMonth = hwCurrentEntry ? hwCurrentEntry.month : null;
  const hwPrevMonthKey = hwPrevEntry ? hwPrevEntry.month : hwFirstMonth;

  // --- ONE composite series across the full reporting period. This is what
  // "Overall Score" and the "Overall Trend" chart both read from, so they
  // can never describe two different things on the same screen again. ---
  const compositeByMonth = gradeMonths.map((m, i) =>
    compositeScoreForMonth(academicByMonth[i], attByMonth[i].pct, hwPctByMonthKey.get(m))
  );
  const overallFirst = compositeByMonth[0];
  const overallLast = compositeByMonth[compositeByMonth.length - 1];
  const overallDeltaSinceFirst = overallLast - overallFirst;
  const overallPrevMonth = compositeByMonth[compositeByMonth.length - 2];
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
    firstGradeMonth, lastGradeMonth, gradeMonths,
    subjectTrends, academicByMonth, compositeByMonth,
    overallFirst, overallLast, overallDeltaSinceFirst, overallPrevMonth, overallMoMDelta,
    attByMonth, attFirst, attLast, attPrevMonth, attMoMDelta, attFirstMonth, attLastMonth, attPrevMonthKey,
    hwByMonth, hwStatsOverall, hwCurrentMonthPct, hwPrevMonthPct, hwMoMDelta, hwFirstMonth, hwLastMonth, hwPrevMonthKey,
    overallScore, overallWeights, strongest, needsAttention, overallStatus,
  };
}
