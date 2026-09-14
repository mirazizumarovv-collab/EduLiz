import { MONTHS } from "../constants/months.js";
import { bridge } from "./liveBridge.js";

const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthOf = (dateStr) => MONTH_ABBREV[Number(dateStr.slice(5, 7)) - 1];

// Builds one subject's full Mar–Sep monthly series from real assessment
// entries. The chart-friendly `score` carries the last known percentage
// forward into months with no assessment (so a trend line doesn't fake a
// dip to zero) — but each row also carries `real: false` for those months,
// so any UI showing "what happened this specific month" can tell a genuine
// assessment apart from a carried-forward value and never misattribute a
// later month's grade to an earlier one.
function buildMonthlySeries(entries) {
  const byMonth = {};
  entries.forEach(e => {
    const m = monthOf(e.date);
    const pct = Math.round((e.score / e.maxScore) * 100);
    byMonth[m] = pct; // last entry in a month wins — most recent assessment
  });
  let carry = null;
  const monthly = MONTHS.map(m => {
    const isReal = byMonth[m] !== undefined;
    if (isReal) carry = byMonth[m];
    return { month: m, score: carry ?? byMonth[m] ?? 0, real: isReal };
  });
  // Back-fill leading months (before the first real assessment) with the
  // first real score for chart continuity only — still marked `real: false`.
  const firstReal = monthly.find(m => m.real);
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
  const student = bridge.students.find(s => s.id === studentId);
  const group = student ? bridge.groups.find(g => g.id === student.groupId) : null;
  const entries = bridge.gradesRecords[studentId] || [];
  if (entries.length === 0) return [];

  const bySubject = {};
  entries.forEach(e => { (bySubject[e.subject] ||= []).push(e); });

  return Object.entries(bySubject).map(([subject, list]) => {
    const sorted = list.slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const score = Math.round((last.score / last.maxScore) * 100);

    // Real class average: every OTHER student in the same group who has a
    // score for this subject, averaged — not a synthetic benchmark.
    let classAvg = score;
    if (group) {
      const peers = group.studentIds
        .map(sid => (bridge.gradesRecords[sid] || []).filter(e => e.subject === subject))
        .flat();
      if (peers.length > 0) {
        classAvg = Math.round(peers.reduce((sum, e) => sum + (e.score / e.maxScore) * 100, 0) / peers.length);
      }
    }

    return {
      name: subject, score, classAvg,
      weeklyTrend: buildWeeklyTrend(sorted),
      lastAssessment: { title: last.title, scoreRaw: `${last.score}/${last.maxScore}`, date: last.date },
      monthly: buildMonthlySeries(sorted),
    };
  });
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
