import { getMonths, monthAbbrInWindow, windowStartISO } from "../../utils/clock.js";
import { bridge, bridgeToday } from "./liveBridge.js";

// Builds one subject's monthly series — one row for each month in view (the
// window ending with the current month) — from real assessment entries,
// oldest first. The chart-friendly `score` carries the last known percentage
// forward into months with no assessment (so a trend line doesn't fake a
// dip to zero) — but each row also carries `real: false` for those months,
// so any UI showing "what happened this specific month" can tell a genuine
// assessment apart from a carried-forward value and never misattribute a
// later month's grade to an earlier one.
function buildMonthlySeries(entries, today) {
  const start = windowStartISO(today);
  const byMonth = {};
  let carry = null;
  entries.forEach(e => { // oldest first
    const pct = Math.round((e.score / e.maxScore) * 100);
    // An assessment from BEFORE the window is still this subject's latest known
    // result as the window opens, so it seeds the carry — it just isn't a row.
    if (e.date < start) { carry = pct; return; }
    const m = monthAbbrInWindow(e.date, today); // null for a date after the current month
    if (m) byMonth[m] = pct; // last entry in a month wins — most recent assessment
  });
  const hadEarlierResult = carry !== null;
  const monthly = getMonths(today).map(m => {
    const isReal = byMonth[m] !== undefined;
    if (isReal) carry = byMonth[m];
    return { month: m, score: carry ?? byMonth[m] ?? 0, real: isReal };
  });
  // Back-fill leading months (before the first real assessment) with the
  // first real score for chart continuity only — still marked `real: false`.
  // Not needed when an earlier result already carries into them.
  const firstReal = hadEarlierResult ? null : monthly.find(m => m.real);
  if (firstReal) {
    for (const row of monthly) {
      if (row.real) break;
      row.score = firstReal.score;
    }
  }
  return monthly;
}

function buildWeeklyTrend(entries) {
  const last6 = entries.slice(-6);
  return last6.map((e, i) => ({ week: `Wk ${i + 1}`, score: Math.round((e.score / e.maxScore) * 100) }));
}

export function getGrades(studentId) {
  const entries = bridge.gradesRecords[studentId] || [];
  if (entries.length === 0) return [];

  const bySubject = {};
  entries.forEach(e => { (bySubject[e.subject] ||= []).push(e); });

  const subjects = Object.entries(bySubject).map(([subject, list]) => {
    const sorted = list.slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const score = Math.round((last.score / last.maxScore) * 100);

    // Class average for THIS assessment: everyone ELSE who was graded on it,
    // found by assessmentId. Not by matching a title, and not by looking at
    // who is in the group today — so a retake that reuses a title, two groups
    // that both gave "Quiz 1" on the same day, or a classmate who has since
    // moved to another group all resolve correctly: the people who sat THIS
    // test are exactly the people with a score on it. Nobody else on it means
    // no comparison, never the student measured against themself.
    let classAvg = score;
    let hasClassComparison = false;
    if (last.assessmentId) {
      const peerPcts = [];
      for (const [otherId, otherList] of Object.entries(bridge.gradesRecords)) {
        if (otherId === studentId) continue;
        const theirs = otherList.find(e => e.assessmentId === last.assessmentId);
        if (theirs) peerPcts.push((theirs.score / theirs.maxScore) * 100);
      }
      if (peerPcts.length > 0) {
        classAvg = Math.round(peerPcts.reduce((sum, p) => sum + p, 0) / peerPcts.length);
        hasClassComparison = true;
      }
    }

    return {
      name: subject, score, classAvg, hasClassComparison,
      weeklyTrend: buildWeeklyTrend(sorted),
      lastAssessment: { title: last.title, scoreRaw: `${last.score}/${last.maxScore}`, date: last.date },
      monthly: buildMonthlySeries(sorted, bridgeToday()),
    };
  });

  // Start the reporting period at the earliest month where ANY subject has a
  // real assessment. Months before that are pure back-fill, so showing them
  // would claim "grades since March" (and month chips, trends, "since March"
  // deltas) for a child whose first assessment was in September.
  const firstReal = Math.min(...subjects.map(s => {
    const i = s.monthly.findIndex(m => m.real);
    return i === -1 ? Infinity : i;
  }));
  const from = Number.isFinite(firstReal) ? firstReal : 0;
  return subjects.map(s => ({ ...s, monthly: s.monthly.slice(from) }));
}

export function computeSubjectDerived(subject) {
  const monthly = subject.monthly;
  const realMonths = monthly.filter(m => m.real);
  const pool = realMonths.length > 0 ? realMonths : monthly;
  const best = pool.reduce((a, b) => (b.score > a.score ? b : a));
  const worst = pool.reduce((a, b) => (b.score < a.score ? b : a));
  const monthTrend = monthly.length > 1 ? monthly[monthly.length - 1].score - monthly[monthly.length - 2].score : 0;
  const weekTrend = subject.weeklyTrend.length > 1
    ? subject.weeklyTrend[subject.weeklyTrend.length - 1].score - subject.weeklyTrend[subject.weeklyTrend.length - 2].score
    : 0;
  return { ...subject, best, worst, monthTrend, weekTrend };
}
