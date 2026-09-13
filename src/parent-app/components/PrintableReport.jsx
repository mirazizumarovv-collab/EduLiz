import React from "react";
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MultiLineChart } from "./charts/MultiLineChart.jsx";
import { getAttendance } from "../data/attendance.js";
import { getGrades, computeSubjectDerived } from "../data/grades.js";
import { getHomework } from "../data/homework.js";
import { MONTH_NAMES } from "../constants/months.js";
import { computeParentAnalytics } from "../utils/parentAnalytics.js";
import { subj } from "../utils/subjectNames.js";

const SUBJECT_COLORS = ["#3A6EA5", "#3FA968", "#D4A537", "#C65D4B"];

export function PrintableReport({ student, lang, t, onClose }) {
  const attendanceData = getAttendance(student.id);
  const grades = getGrades(student.id).map(computeSubjectDerived);
  const homework = getHomework(student.id);
  const mn = (key) => MONTH_NAMES[lang][key] || key;

  const a = computeParentAnalytics({ studentId: student.id, grades, attendanceData, homework });

  // One shared dataset — every subject reads its score from the SAME row per
  // month, so Recharts' X-axis and all lines are guaranteed to line up
  // (previously each <Line> had its own `data`, which is fragile/undefined behavior).
  const gradesChartData = a.gradeMonths.map((m, i) => {
    const row = { month: mn(m) };
    grades.forEach(s => { row[s.name] = s.monthly[i].score; });
    return row;
  });
  const attendanceChartData = a.attByMonth.map(r => ({ month: mn(r.month), pct: r.pct }));
  const homeworkChartData = a.hwByMonth.map(r => ({ month: mn(r.month), pct: r.pct }));

  const overallDir = a.overallDeltaSinceFirst >= 0 ? t("trendImproved") : t("trendDeclined");
  const overallTrendText = t("overallTrendSentence", {
    name: student.name, dir: overallDir, first: a.overallFirst, firstMonth: mn(a.firstGradeMonth),
    last: a.overallLast, lastMonth: mn(a.lastGradeMonth), sign: a.overallDeltaSinceFirst >= 0 ? "+" : "", delta: a.overallDeltaSinceFirst,
  });
  const decliningSubject = a.subjectTrends.find(s => {
    const full = grades.find(g => g.name === s.name);
    return full.monthly.slice(-2).reduce((x, y, i, arr) => (i === 1 ? y.score - arr[0].score : 0), 0) < 0;
  });
  const subjectNote = decliningSubject
    ? t("subjectDeclinedNote", { subject: subj(lang, decliningSubject.name) })
    : (a.needsAttention.score - a.needsAttention.classAvg < -2 ? t("subjectBelowAvgNote", { subject: subj(lang, a.needsAttention.name) }) : "");
  const attendanceNote = a.attLast === null ? "" : Math.abs(a.attMoMDelta) < 1
    ? t("attendanceStableNote", { pct: a.attLast })
    : t("attendanceChangedNote", { dir: a.attMoMDelta >= 0 ? t("trendUp") : t("trendDown"), pct: a.attLast, sign: a.attMoMDelta >= 0 ? "+" : "", delta: a.attMoMDelta, prevMonth: mn(a.attByMonth[a.attByMonth.length - 2]?.month || a.attByMonth[0].month) });
  const homeworkNote = a.hwMoMDelta < 0
    ? t("homeworkDecreasedNote", { prevMonth: a.hwByMonth.length > 1 ? mn(a.hwByMonth[a.hwByMonth.length - 2].month) : "" })
    : a.hwMoMDelta > 0 ? t("homeworkIncreasedNote", { prevMonth: a.hwByMonth.length > 1 ? mn(a.hwByMonth[a.hwByMonth.length - 2].month) : "" })
    : t("assignmentsCompletedOf", { completed: a.hwStatsOverall.completed, total: a.hwStatsOverall.total });

  const focusAreas = [];
  if (subjectNote) focusAreas.push(subj(lang, a.needsAttention.name));
  if (a.hwMoMDelta < 0) focusAreas.push(t("homeworkPerformance"));
  const overallConclusion = focusAreas.length > 0
    ? t("overallConclusionMixed", { name: student.name, areas: focusAreas.join(` ${t("and")} `) })
    : t("overallConclusionGood", { name: student.name });

  const statusKey = `status${a.overallStatus.charAt(0).toUpperCase()}${a.overallStatus.slice(1)}`;

  const recommendations = [];
  a.subjectTrends.forEach(s => {
    const full = grades.find(g => g.name === s.name);
    if (full.score - full.classAvg < -3) {
      recommendations.push(t("recTextLow", { subj: subj(lang, s.name), score: full.score, diff: Math.abs(full.score - full.classAvg), avg: full.classAvg }));
    }
  });
  if (a.attMoMDelta < 0) recommendations.push(t("recTextAtt", { delta: a.attMoMDelta }));
  if (a.hwStatsOverall.onTimeRate < 85) recommendations.push(t("recTextHw", { rate: a.hwStatsOverall.onTimeRate }));
  if (recommendations.length === 0) recommendations.push(t("recTextGood", { name: student.name }));

  const overallPrevMonthKey = a.gradeMonths[a.gradeMonths.length - 2];
  const comparisonRows = [
    { label: t("overallLabel"), prev: a.overallPrevMonth, curr: a.overallLast, delta: a.overallMoMDelta, prevMonth: overallPrevMonthKey, currMonth: a.lastGradeMonth },
    { label: t("attendanceRate"), prev: a.attPrevMonth, curr: a.attLast, delta: a.attMoMDelta, prevMonth: a.attPrevMonthKey, currMonth: a.attLastMonth },
    { label: t("homeworkPerformance"), prev: a.hwPrevMonthPct, curr: a.hwCurrentMonthPct, delta: a.hwMoMDelta, prevMonth: a.hwPrevMonthKey, currMonth: a.hwLastMonth },
  ];

  return (
    <div className="print-report" style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 9999, overflowY: "auto", padding: "28px 32px" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-report, .print-report * { visibility: visible; }
          .print-report { position: absolute !important; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 20 }}>
        <button onClick={() => window.print()} style={{ border: "none", background: "#24405F", color: "#fff", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>{t("printBtn")}</button>
        <button onClick={onClose} style={{ border: "1px solid #E4ECF4", background: "transparent", color: "#142238", borderRadius: 8, padding: "10px 18px", fontWeight: 700, cursor: "pointer" }}>{t("closeBtn")}</button>
      </div>

      <div style={{ fontSize: 26, fontWeight: 800, color: "#142238" }}>{t("monthlyProgressReport")}</div>
      <div style={{ fontSize: 14, color: "#6C82A0", marginTop: 4 }}>{student.name} · {student.grade} · {student.group}</div>
      <div style={{ fontSize: 12.5, color: "#6C82A0", marginBottom: 4 }}>
        {t("academicPeriodLabel")}: {mn(a.firstGradeMonth)} – {mn(a.lastGradeMonth)}
      </div>
      <div style={{ fontSize: 12.5, color: "#6C82A0", marginBottom: 4 }}>
        {t("attendancePeriodLabel")}: {a.attFirstMonth ? `${mn(a.attFirstMonth)} – ${mn(a.attLastMonth)}` : t("noAttendanceData")}
      </div>
      <div style={{ fontSize: 12.5, color: "#6C82A0", marginBottom: 22 }}>
        {t("homeworkPeriodLabel")}: {a.hwFirstMonth ? `${mn(a.hwFirstMonth)} – ${mn(a.hwLastMonth)}` : t("noHomework")}
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{
          display: "inline-block", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase",
          color: "#fff", background: "#24405F", borderRadius: 20, padding: "4px 12px",
        }}>
          {t("overallStatusLabel")}: {t(statusKey)}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 8 }}>
        {[
          [t("overallScoreLabel"), `${a.overallScore}/100`, "#3A6EA5"],
          [t("attendanceRate"), a.attLast !== null ? `${a.attLast}%` : t("noAttendanceData"), a.attMoMDelta >= 0 ? "#3FA968" : "#C65D4B"],
          [t("academicAverage"), `${a.academicByMonth[a.academicByMonth.length - 1]}%`, "#3FA968"],
        ].map(([label, val, color]) => (
          <div key={label} style={{ flex: 1, background: "#EAF1F8", borderRadius: 10, padding: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
            <div style={{ fontSize: 11.5, color: "#6C82A0", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 10.5, color: "#6C82A0", marginBottom: 20 }}>
        {t("overallScoreExplainer", { gradesPct: Math.round(a.overallWeights.grades * 100), attPct: Math.round(a.overallWeights.attendance * 100), hwPct: Math.round(a.overallWeights.homework * 100) })}
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#142238", marginBottom: 10 }}>{t("monthlyComparison")}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 26, fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#24405F", color: "#fff" }}>
            <th style={{ padding: 8, textAlign: "left" }}>{t("metricLabel")}</th>
            <th style={{ padding: 8, textAlign: "right" }}>{t("prevLabel")}</th>
            <th style={{ padding: 8, textAlign: "right" }}>{t("currentLabel")}</th>
            <th style={{ padding: 8, textAlign: "right" }}>{t("changeLabel")}</th>
          </tr>
        </thead>
        <tbody>
          {comparisonRows.map(row => (
            <tr key={row.label} style={{ borderBottom: "1px solid #E4ECF4" }}>
              <td style={{ padding: 8 }}>{row.label}</td>
              <td style={{ padding: 8, textAlign: "right", color: "#6C82A0" }}>
                {row.prevMonth ? `${mn(row.prevMonth)} ` : ""}{row.prev !== null ? `${row.prev}%` : t("noData")}
              </td>
              <td style={{ padding: 8, textAlign: "right", fontWeight: 700 }}>
                {row.currMonth ? `${mn(row.currMonth)} ` : ""}{row.curr !== null ? `${row.curr}%` : t("noData")}
              </td>
              <td style={{ padding: 8, textAlign: "right", color: (row.prev !== null && row.curr !== null && row.delta >= 0) ? "#3FA968" : "#C65D4B", fontWeight: 700 }}>
                {(row.prev !== null && row.curr !== null) ? `${row.delta > 0 ? "+" : ""}${row.delta}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#142238", marginBottom: 10 }}>{t("navAttendance")}</div>
      <div style={{ height: 210, marginBottom: 26 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={attendanceChartData}>
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="pct" stroke="#3A6EA5" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#142238", marginBottom: 10 }}>{t("gradesTitle")}</div>
      <div style={{ marginBottom: 26 }}>
        <MultiLineChart
          data={gradesChartData}
          series={grades.map((s, i) => ({ key: s.name, name: subj(lang, s.name), color: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }))}
          height={230}
        />
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#142238", marginBottom: 10 }}>{t("navHomework")}</div>
      {homeworkChartData.length > 0 ? (
        <>
          <div style={{ height: 190, marginBottom: 12 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={homeworkChartData}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="pct" fill="#3FA968" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 13, color: "#142238", marginBottom: 4 }}>
            {t("hwCompletionLabel")}: {a.hwStatsOverall.completionRate}% — {t("assignmentsCompletedOf", { completed: a.hwStatsOverall.completed, total: a.hwStatsOverall.total })}
          </div>
          <div style={{ fontSize: 13, color: "#142238", marginBottom: 4 }}>
            {t("hwOnTimeLabel")}: {a.hwStatsOverall.onTimeRate}%
          </div>
          <div style={{ fontSize: 13, color: "#6C82A0", marginBottom: 26 }}>
            {t("hwStatusBreakdown", { completed: a.hwStatsOverall.completed, pending: a.hwStatsOverall.pending, overdue: a.hwStatsOverall.overdue })}
          </div>
        </>
      ) : (
        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 12, color: "#6C82A0", marginBottom: 26 }}>{t("noData")}</div>
      )}

      <div style={{ fontSize: 17, fontWeight: 800, color: "#142238", marginBottom: 10 }}>{t("perSubjectChange")}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 26, fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#24405F", color: "#fff" }}>
            <th style={{ padding: 8, textAlign: "left" }}>{t("subject")}</th>
            <th style={{ padding: 8, textAlign: "left" }}>{t("scoreLabel")}</th>
            <th style={{ padding: 8, textAlign: "left" }}>{t("classAverageLabel")}</th>
            <th style={{ padding: 8, textAlign: "left" }}>{t("changeLabel")}</th>
          </tr>
        </thead>
        <tbody>
          {grades.map(s => (
            <tr key={s.name} style={{ borderBottom: "1px solid #E4ECF4" }}>
              <td style={{ padding: 8 }}>{subj(lang, s.name)}</td>
              <td style={{ padding: 8 }}>{s.score}%</td>
              <td style={{ padding: 8 }}>{s.classAvg}%</td>
              <td style={{ padding: 8, color: s.monthTrend >= 0 ? "#3FA968" : "#C65D4B", fontWeight: 700 }}>
                {s.monthTrend >= 0 ? "+" : ""}{s.monthTrend}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#142238", marginBottom: 8 }}>🏆 {t("strongestSubjectLabel")}</div>
      <div style={{ fontSize: 13, color: "#142238", marginBottom: 14 }}>{subj(lang, a.strongest.name)} ({a.strongest.score}%)</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#C65D4B", marginBottom: 8 }}>⚠ {t("needsAttentionLabel")}</div>
      <div style={{ fontSize: 13, color: "#142238", marginBottom: 22 }}>{subj(lang, a.needsAttention.name)} ({a.needsAttention.score}%)</div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#142238", marginBottom: 8 }}>{t("conclusionLabel")}</div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#3A6EA5", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("academicPerformance")}</div>
        <div style={{ fontSize: 13, color: "#142238", lineHeight: 1.6 }}>{overallTrendText} {subjectNote}</div>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#3A6EA5", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("navAttendance")}</div>
        <div style={{ fontSize: 13, color: "#142238", lineHeight: 1.6 }}>{attendanceNote}</div>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#3A6EA5", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("homeworkPerformance")}</div>
        <div style={{ fontSize: 13, color: "#142238", lineHeight: 1.6 }}>{homeworkNote}</div>
      </div>
      <div style={{ borderTop: "1px solid #E4ECF4", paddingTop: 12, marginBottom: 22 }}>
        <div style={{ fontSize: 10.5, fontWeight: 800, color: "#6C82A0", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("conclusionLabel")}</div>
        <div style={{ fontSize: 13, color: "#142238", lineHeight: 1.6, fontWeight: 600 }}>{overallConclusion}</div>
      </div>

      <div style={{ fontSize: 17, fontWeight: 800, color: "#142238", marginBottom: 8 }}>{t("recommendationsLabel")}</div>
      {recommendations.map((r, i) => (
        <div key={i} style={{ fontSize: 13, color: "#142238", marginBottom: 6, display: "flex", gap: 6 }}>
          <span>•</span><span>{r}</span>
        </div>
      ))}
    </div>
  );
}
