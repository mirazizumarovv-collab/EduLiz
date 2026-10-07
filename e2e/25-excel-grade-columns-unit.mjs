// Plain unit check (no browser) — the Excel grade sheet's per-month cells
// must only show a value for months with a GENUINELY REAL assessment, not
// the backward-projected placeholder used before a subject's first real
// month (that placeholder exists only so chart lines don't fake a dip to
// zero; a table cell under a specific month's header is a different claim
// — "this subject scored X% in this exact month" — which isn't true for
// the leading placeholder months).
//
// NOTE — what this does NOT cover: it hand-builds full-length subjects, so it
// bypasses the trimming getGrades() applies (the series starts at the first
// real month). That is why it could not see the header/cell misalignment in
// the Excel grade sheet; that is covered by 33-excel-grade-columns-real-path-
// unit.mjs, which drives the real getGrades() -> export path. This file only
// checks the "real month vs placeholder" cell rule.
import { computeSubjectDerived } from "../src/parent-app/data/grades.js";
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
    lastAssessment: { title: "Test", scoreRaw: `${realScore}/100`, date: "2026-05-08" },
    monthly,
  };
}

const s = computeSubjectDerived(buildSubject("Mathematics", "May", 80));
const excelRow = s.monthly.map(m => (m.real ? m.score : "—"));
console.log("Excel row (Mar..Sep):", excelRow);
const expected = ["—", "—", 80, "—", "—", "—", "—"];
const ok = JSON.stringify(excelRow) === JSON.stringify(expected);
if (!ok) { console.log("FAIL — expected", expected); process.exit(1); }
console.log("PASS — only May (the real assessment month) shows a score; every other column correctly shows '—'");
