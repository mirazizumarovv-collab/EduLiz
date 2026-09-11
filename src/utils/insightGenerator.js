import { CURRENT_MONTH } from "../constants/months.js";
import { attendanceRate, recentLateCount, monthOverMonthDelta, homeworkStats } from "./calculations.js";

// Structured so a real AI/LLM call can later replace the rule engine below
// without changing the shape screens consume: an array of { type, textKey, vars }.
export function generateInsights({ attendanceData, grades, homework }) {
  const insights = [];
  const monthDays = attendanceData[CURRENT_MONTH];
  const rate = attendanceRate(monthDays);
  const lateRecent = recentLateCount(monthDays);

  if (rate >= 95) {
    insights.push({ type: "positive", textKey: "insightAttendanceGood", vars: { pct: rate } });
  } else if (lateRecent >= 2) {
    insights.push({ type: "warning", textKey: "insightRecentLate", vars: { n: lateRecent } });
  }

  grades.forEach(subject => {
    const delta = monthOverMonthDelta(subject.monthly);
    if (delta >= 5) insights.push({ type: "positive", textKey: "insightGradeImproved", vars: { subject: subject.name, pct: delta } });
    if (delta <= -5) insights.push({ type: "warning", textKey: "insightGradeDeclined", vars: { subject: subject.name, pct: Math.abs(delta) } });
  });

  if (grades.length > 0) {
    const strongest = grades.reduce((a, b) => (b.score > a.score ? b : a));
    insights.push({ type: "neutral", textKey: "insightStrongestSubject", vars: { subject: strongest.name } });
  }

  const hwStats = homeworkStats(homework.pending, homework.history);
  if (hwStats.onTimeRate < 80) {
    insights.push({ type: "warning", textKey: "insightHomeworkDeclined", vars: {} });
  }

  return insights.slice(0, 5);
}
