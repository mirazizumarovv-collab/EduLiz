// Plain unit check (no browser) for the academicByMonth backfill bug:
// a subject's carried-forward placeholder score (before its own first real
// assessment) must never be blended into another month's academic average.
import { computeSubjectDerived } from "../src/parent-app/data/grades.js";
import { computeParentAnalytics } from "../src/parent-app/utils/parentAnalytics.js";
import { getMonths } from "../src/utils/clock.js";
// The months in view when "today" is 8 Sep 2026 — passed explicitly, so this check never depends on the real date.
const TODAY = "2026-09-08";
const MONTHS = getMonths(TODAY);

function buildSubject(name, realMonth, realScore) {
  const monthly = MONTHS.map(m => ({ month: m, score: realScore, real: m === realMonth }));
  let seenReal = false;
  for (const row of monthly) { if (row.month === realMonth) seenReal = true; if (!seenReal) row.score = realScore; }
  return {
    name, score: realScore, classAvg: realScore, hasClassComparison: false,
    weeklyTrend: [{ week: "Wk 1", score: realScore }],
    lastAssessment: { title: "Test", scoreRaw: `${realScore}/100`, date: "2026-09-08" },
    monthly,
  };
}

const grades = [
  computeSubjectDerived(buildSubject("Mathematics", "Apr", 80)),
  computeSubjectDerived(buildSubject("English", "Sep", 60)),
];
const attendanceData = Object.fromEntries(MONTHS.map(m => [m, []]));
const homework = { pending: [], history: [] };
const a = computeParentAnalytics({ studentId: "x", grades, attendanceData, homework, today: TODAY });

const aprIdx = MONTHS.indexOf("Apr");
console.log("April academicByMonth:", a.academicByMonth[aprIdx], "(expected 80 — Mathematics only; English has no real April data)");
if (a.academicByMonth[aprIdx] !== 80) {
  console.log("FAIL — April average is blended with English's fake backfilled 60%");
  process.exit(1);
}
console.log("PASS — April average correctly uses only the subject with real data that month");
