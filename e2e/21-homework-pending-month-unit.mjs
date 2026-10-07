// Plain unit check (no browser) for the homework-month bug: a pending
// homework item never carried a `month` field (only history items did),
// so parentAnalytics.js's "which months have homework" filter could never
// match it — pending homework was invisible to Homework Performance,
// Monthly Comparison, Overall Score, Insights, and the PDF report.
import { computeParentAnalytics } from "../src/parent-app/utils/parentAnalytics.js";
import { computeSubjectDerived } from "../src/parent-app/data/grades.js";
import { getMonths } from "../src/utils/clock.js";
// The months in view when "today" is 8 Sep 2026 — passed explicitly, so this check never depends on the real date.
const TODAY = "2026-09-08";
const MONTHS = getMonths(TODAY);

const grades = [computeSubjectDerived({
  name: "Mathematics", score: 80, classAvg: 80, hasClassComparison: false,
  weeklyTrend: [{ week: "Wk 1", score: 80 }],
  lastAssessment: { title: "T", scoreRaw: "80/100", date: "2026-09-08" },
  monthly: MONTHS.map(m => ({ month: m, score: 80, real: m === "Sep" })),
})];
const attendanceData = Object.fromEntries(MONTHS.map(m => [m, []]));

// September: 2 completed + 3 pending (not yet due) = 5 total.
const homework = {
  pending: [
    { id: "p1", month: "Sep", ym: "2026-09", day: 20, subject: "Math", title: "P1", due: "2026-09-20", status: "pending" },
    { id: "p2", month: "Sep", ym: "2026-09", day: 22, subject: "Math", title: "P2", due: "2026-09-22", status: "pending" },
    { id: "p3", month: "Sep", ym: "2026-09", day: 25, subject: "Math", title: "P3", due: "2026-09-25", status: "pending" },
  ],
  history: [
    { id: "h1", month: "Sep", ym: "2026-09", day: 5, subject: "Math", title: "H1", status: "completed", onTime: true },
    { id: "h2", month: "Sep", ym: "2026-09", day: 6, subject: "Math", title: "H2", status: "completed", onTime: true },
  ],
};
const a = computeParentAnalytics({ studentId: "x", grades, attendanceData, homework, today: TODAY });
const sep = (a.hwByMonth || []).find(r => r.month === "Sep");
console.log("September homework stats:", sep, "(expected total=5, completed=2)");
if (!sep || sep.total !== 5 || sep.completed !== 2) {
  console.log("FAIL — pending items are still being dropped from the month's stats");
  process.exit(1);
}
console.log("PASS — pending homework now correctly counted into September's totals");
