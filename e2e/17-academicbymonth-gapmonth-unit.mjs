// Plain unit check (no browser) for the SECOND academicByMonth bug: when NO
// subject has a real assessment in a given month (a true gap month), the
// previous fix still fell back to averaging EVERY subject's monthly[i]
// score — including a subject whose score there is a backward-projected
// placeholder from a LATER real assessment. Confirms a gap month now
// correctly carries forward only subjects that are already genuinely known
// by that point, excluding the not-yet-real one entirely.
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

// May -> Mathematics 80 (real). July -> English 70 (real). June: a true gap.
const grades = [
  computeSubjectDerived(buildSubject("Mathematics", "May", 80)),
  computeSubjectDerived(buildSubject("English", "Jul", 70)),
];
const attendanceData = Object.fromEntries(MONTHS.map(m => [m, []]));
const homework = { pending: [], history: [] };
const a = computeParentAnalytics({ studentId: "x", grades, attendanceData, homework, today: TODAY });

const mayIdx = MONTHS.indexOf("May"), junIdx = MONTHS.indexOf("Jun"), julIdx = MONTHS.indexOf("Jul");
console.log("May:", a.academicByMonth[mayIdx], "(expected 80 — Mathematics' real month)");
console.log("June:", a.academicByMonth[junIdx], "(expected 80 — Mathematics carried forward; English not real yet, excluded)");
console.log("July:", a.academicByMonth[julIdx], "(expected 75 — Mathematics 80 carried + English's real 70, averaged)");
const ok = a.academicByMonth[mayIdx] === 80 && a.academicByMonth[junIdx] === 80 && a.academicByMonth[julIdx] === 75;
if (!ok) { console.log("FAIL"); process.exit(1); }
console.log("PASS — gap month correctly excludes the not-yet-real subject instead of blending its future backward-projected value");
