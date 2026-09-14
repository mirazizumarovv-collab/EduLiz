import React from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { attendanceService, gradeService, homeworkService } from "../services/index.js";
import { Section, Row } from "../components/common/UI.jsx";
import { LoadingSkeleton, ErrorState } from "../components/common/Feedback.jsx";
import { TrendLineChart } from "../components/charts/TrendLineChart.jsx";
import { MultiLineChart } from "../components/charts/MultiLineChart.jsx";
import { computeSubjectDerived } from "../data/grades.js";
import { computeParentAnalytics } from "../utils/parentAnalytics.js";
import { subj } from "../utils/subjectNames.js";
import { MONTH_NAMES } from "../constants/months.js";

const SUBJECT_COLORS = ["#3A6EA5", "#3FA968", "#D4A537", "#C65D4B"];

function DeltaTag({ delta, c, positiveIsGood = true }) {
  const good = positiveIsGood ? delta >= 0 : delta <= 0;
  const color = delta === 0 ? c.textSecondary : good ? c.good : c.bad;
  const arrow = delta > 0 ? "▲" : delta < 0 ? "▼" : "—";
  return <span style={{ color, fontWeight: 700, fontSize: 12.5 }}>{arrow} {delta > 0 ? "+" : ""}{delta}%</span>;
}

export default function Insights({ onOpenPrintReport }) {
  const { t, lang, selectedStudent, theme } = useApp();
  const c = theme.colors;

  const attendanceQ = useAsyncData(() => attendanceService.get(selectedStudent.id), [selectedStudent.id]);
  const gradesQ = useAsyncData(() => gradeService.get(selectedStudent.id), [selectedStudent.id]);
  const homeworkQ = useAsyncData(() => homeworkService.get(selectedStudent.id), [selectedStudent.id]);

  const loading = attendanceQ.loading || gradesQ.loading || homeworkQ.loading;
  const error = attendanceQ.error || gradesQ.error || homeworkQ.error;
  if (loading) return <div style={{ padding: 18 }}><LoadingSkeleton rows={6} /></div>;
  if (error) return <ErrorState t={t} message={t("failedToLoad")} onRetry={() => { attendanceQ.reload(); gradesQ.reload(); homeworkQ.reload(); }} />;

  if (gradesQ.data.length === 0) {
    return (
      <div style={{ padding: "18px 16px 8px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2, color: c.textPrimary }}>{t("overallProgress")}</div>
        <div style={{ fontSize: 12.5, color: c.textSecondary, marginBottom: 20 }}>{selectedStudent.name}</div>
        <div style={{ fontSize: 13, color: c.textSecondary }}>{t("insightsNeedGrades")}</div>
      </div>
    );
  }

  const grades = gradesQ.data.map(computeSubjectDerived);
  const a = computeParentAnalytics({ studentId: selectedStudent.id, grades, attendanceData: attendanceQ.data, homework: homeworkQ.data });
  const mn = (key) => MONTH_NAMES[lang][key] || key;

  // --- Conclusion, built from real computed signals (nothing invented) ---
  const overallDir = a.overallDeltaSinceFirst >= 0 ? t("trendImproved") : t("trendDeclined");
  const overallTrendText = t("overallTrendSentence", {
    name: selectedStudent.name, dir: overallDir, first: a.overallFirst, firstMonth: mn(a.firstGradeMonth),
    last: a.overallLast, lastMonth: mn(a.lastGradeMonth), sign: a.overallDeltaSinceFirst >= 0 ? "+" : "", delta: a.overallDeltaSinceFirst,
  });
  const decliningSubject = a.subjectTrends.find(s => (gradesQ.data.find(g => g.name === s.name).monthly.slice(-2).reduce((x, y, i, arr) => i === 1 ? y.score - arr[0].score : 0, 0)) < 0);
  const subjectNote = decliningSubject
    ? t("subjectDeclinedNote", { subject: subj(lang, decliningSubject.name) })
    : (a.needsAttention.score - a.needsAttention.classAvg < -2 ? t("subjectBelowAvgNote", { subject: subj(lang, a.needsAttention.name) }) : "");
  const attendanceNote = a.attLast === null ? "" : Math.abs(a.attMoMDelta) < 1
    ? t("attendanceStableNote", { pct: a.attLast })
    : t("attendanceChangedNote", { dir: a.attMoMDelta >= 0 ? t("trendUp") : t("trendDown"), pct: a.attLast, sign: a.attMoMDelta >= 0 ? "+" : "", delta: a.attMoMDelta, prevMonth: mn(a.attByMonth[a.attByMonth.length - 2]?.month || a.attByMonth[0].month) });
  const homeworkNote = a.hwMoMDelta < 0
    ? t("homeworkDecreasedNote", { prevMonth: a.hwByMonth.length > 1 ? mn(a.hwByMonth[a.hwByMonth.length - 2].month) : "" })
    : a.hwMoMDelta > 0 ? t("homeworkIncreasedNote", { prevMonth: a.hwByMonth.length > 1 ? mn(a.hwByMonth[a.hwByMonth.length - 2].month) : "" }) : "";

  const focusAreas = [];
  if (subjectNote) focusAreas.push(subj(lang, a.needsAttention.name));
  if (a.hwMoMDelta < 0) focusAreas.push(t("homeworkPerformance"));
  const overallConclusion = focusAreas.length > 0
    ? t("overallConclusionMixed", { name: selectedStudent.name, areas: focusAreas.join(` ${t("and")} `) })
    : t("overallConclusionGood", { name: selectedStudent.name });

  const recommendations = [];
  if (subjectNote) recommendations.push(t("focusReviewSubject", { subject: subj(lang, a.needsAttention.name), diff: Math.abs(a.needsAttention.score - a.needsAttention.classAvg) }));
  if (a.hwMoMDelta < 0) recommendations.push(t("focusHomeworkSchedule", { delta: Math.abs(a.hwMoMDelta) }));
  if (a.attMoMDelta < 0) recommendations.push(t("focusAttendance", { delta: Math.abs(a.attMoMDelta) }));
  if (recommendations.length === 0) recommendations.push(t("focusKeepGoing", { subject: subj(lang, a.strongest.name) }));

  const overallPrevMonthKey = a.gradeMonths[a.gradeMonths.length - 2];
  const comparisonRows = [
    { label: t("overallLabel"), prev: a.overallPrevMonth, curr: a.overallLast, delta: a.overallMoMDelta, prevMonth: overallPrevMonthKey, currMonth: a.lastGradeMonth },
    { label: t("attendanceRate"), prev: a.attPrevMonth, curr: a.attLast, delta: a.attMoMDelta, prevMonth: a.attPrevMonthKey, currMonth: a.attLastMonth },
    { label: t("homeworkPerformance"), prev: a.hwPrevMonthPct, curr: a.hwCurrentMonthPct, delta: a.hwMoMDelta, prevMonth: a.hwPrevMonthKey, currMonth: a.hwLastMonth },
  ];

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      {/* OVERALL PROGRESS */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2, color: c.textPrimary }}>{t("overallProgress")}</div>
          <div style={{ fontSize: 12.5, color: c.textSecondary, marginBottom: 16 }}>{selectedStudent.name}</div>
        </div>
        {onOpenPrintReport && (
          <button
            onClick={onOpenPrintReport}
            style={{ border: "none", background: c.surfaceAlt, color: c.accent, borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
          >
            {t("downloadPdf")}
          </button>
        )}
      </div>
      <div style={{ background: c.surfaceStrong, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <div style={{
          display: "inline-block", fontSize: 10.5, fontWeight: 800, letterSpacing: 0.5, textTransform: "uppercase",
          color: c.onAccent, background: "rgba(255,255,255,0.18)", borderRadius: 20, padding: "3px 10px", marginBottom: 10,
        }}>
          {t("overallStatusLabel")}: {t(`status${a.overallStatus.charAt(0).toUpperCase()}${a.overallStatus.slice(1)}`)}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 30, fontWeight: 800, color: c.onAccent }}>{a.overallScore}</span>
          <span style={{ fontSize: 14, color: c.onAccent, opacity: 0.75 }}>/ 100</span>
        </div>
        <div style={{ fontSize: 12.5, color: a.overallDeltaSinceFirst >= 0 ? "#BFE8CE" : "#F3C6BA", fontWeight: 700, marginTop: 2 }}>
          {a.overallDeltaSinceFirst >= 0 ? "▲" : "▼"} {a.overallDeltaSinceFirst >= 0 ? "+" : ""}{a.overallDeltaSinceFirst}% {t("sinceMonth", { month: mn(a.firstGradeMonth) })}
        </div>
        <div style={{ fontSize: 10.5, color: c.onAccent, opacity: 0.7, marginTop: 6 }}>
          {t("overallScoreExplainer", { gradesPct: Math.round(a.overallWeights.grades * 100), attPct: Math.round(a.overallWeights.attendance * 100), hwPct: Math.round(a.overallWeights.homework * 100) })}
        </div>
        <div style={{ marginTop: 10 }}>
          <TrendLineChart data={a.compositeByMonth.map((score, i) => ({ month: mn(a.gradeMonths[i]), score }))} dataKey="score" xKey="month" domain={[40, 100]} stroke={c.onAccent} tickColor={c.onAccent} />
        </div>
      </div>

      {/* MONTHLY COMPARISON */}
      <Section title={t("monthlyComparison")}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>
              <td style={{ padding: "4px 4px", color: c.textSecondary, fontSize: 11 }}>{t("metricLabel")}</td>
              <td style={{ padding: "4px 4px", color: c.textSecondary, fontSize: 11, textAlign: "right" }}>{t("prevLabel")}</td>
              <td style={{ padding: "4px 4px", color: c.textSecondary, fontSize: 11, textAlign: "right" }}>{t("currentLabel")}</td>
              <td style={{ padding: "4px 4px", color: c.textSecondary, fontSize: 11, textAlign: "right" }}>{t("changeLabel")}</td>
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map(row => (
              <tr key={row.label} style={{ borderTop: `1px solid ${c.border}` }}>
                <td style={{ padding: "8px 4px", fontWeight: 600, color: c.textPrimary }}>{row.label}</td>
                <td style={{ padding: "8px 4px", textAlign: "right", color: c.textSecondary }}>
                  {row.prevMonth ? `${mn(row.prevMonth)} ` : ""}{row.prev !== null ? `${row.prev}%` : t("noData")}
                </td>
                <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: 700, color: c.textPrimary }}>
                  {row.currMonth ? `${mn(row.currMonth)} ` : ""}{row.curr !== null ? `${row.curr}%` : t("noData")}
                </td>
                <td style={{ padding: "8px 4px", textAlign: "right" }}>{(row.prev !== null && row.curr !== null) ? <DeltaTag delta={row.delta} c={c} /> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* ACADEMIC PERFORMANCE */}
      <Section title={t("academicPerformance")}>
        <div style={{ background: c.surfaceAlt, borderRadius: 10, padding: "12px 12px 4px", marginBottom: 12 }}>
          <MultiLineChart
            data={a.gradeMonths.map((m, i) => {
              const row = { month: mn(m) };
              grades.forEach(s => { row[s.name] = s.monthly[i].score; });
              return row;
            })}
            series={grades.map((s, i) => ({ key: s.name, name: subj(lang, s.name), color: SUBJECT_COLORS[i % SUBJECT_COLORS.length] }))}
            domain={[40, 100]}
          />
        </div>
        {a.subjectTrends.map(s => (
          <div key={s.name} style={{ background: c.surfaceAlt, borderRadius: 10, padding: "12px 14px", marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: c.textPrimary }}>{subj(lang, s.name)}</div>
            <div style={{ fontSize: 12, color: c.textSecondary }}>
              {mn(s.firstMonth)} {s.first}% ───── {mn(a.lastGradeMonth)} {s.last}%
            </div>
            <DeltaTag delta={s.delta} c={c} />
          </div>
        ))}
      </Section>

      {/* ATTENDANCE */}
      <Section title={t("navAttendance")}>
        <div style={{ background: c.surfaceAlt, borderRadius: 10, padding: "12px 12px 4px" }}>
          <TrendLineChart data={a.attByMonth.map(r => ({ month: mn(r.month), pct: r.pct }))} dataKey="pct" xKey="month" domain={[0, 100]} />
          <div style={{ padding: "4px 4px 10px" }}>
            <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 4 }}>
              {a.attFirstMonth ? mn(a.attFirstMonth) : ""} {a.attFirst !== null ? `${a.attFirst}%` : t("noAttendanceData")} → {a.attLastMonth ? mn(a.attLastMonth) : ""} {a.attLast !== null ? `${a.attLast}%` : t("noAttendanceData")}
            </div>
            {a.attFirst !== null && a.attLast !== null && <DeltaTag delta={a.attLast - a.attFirst} c={c} />}
          </div>
        </div>
      </Section>

      {/* HOMEWORK */}
      <Section title={t("homeworkPerformance")}>
        <div style={{ background: c.surfaceAlt, borderRadius: 10, padding: "12px 12px 4px" }}>
          {a.hwByMonth.length > 1 ? (
            <TrendLineChart data={a.hwByMonth.map(r => ({ month: mn(r.month), pct: r.pct }))} dataKey="pct" xKey="month" domain={[0, 100]} />
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0", fontSize: 12, color: c.textSecondary }}>{t("noData")}</div>
          )}
          <div style={{ padding: "10px 4px 10px" }}>
            <Row label={t("hwCompletionLabel")} value={`${a.hwStatsOverall.completionRate}%`} sub={t("assignmentsCompletedOf", { completed: a.hwStatsOverall.completed, total: a.hwStatsOverall.total })} />
            <Row label={t("hwOnTimeLabel")} value={`${a.hwStatsOverall.onTimeRate}%`} />
            <Row label={t("hwStatusLabel")} value="" sub={t("hwStatusBreakdown", { completed: a.hwStatsOverall.completed, pending: a.hwStatsOverall.pending, overdue: a.hwStatsOverall.overdue })} />
            {a.hwByMonth.length > 1 && (
              <div style={{ marginTop: 6 }}>
                <DeltaTag delta={a.hwMoMDelta} c={c} /> <span style={{ fontSize: 11.5, color: c.textSecondary }}>{t("vsLastMonth", { month: mn(a.hwByMonth[a.hwByMonth.length - 2].month) })}</span>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* OVERALL CONCLUSION — broken into clearly labeled parts, not one long paragraph */}
      <Section title={t("conclusionLabel")}>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: c.accent, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("academicPerformance")}</div>
          <div style={{ fontSize: 12.5, color: c.textPrimary, lineHeight: 1.6 }}>{overallTrendText} {subjectNote}</div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: c.accent, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("navAttendance")}</div>
          <div style={{ fontSize: 12.5, color: c.textPrimary, lineHeight: 1.6 }}>{attendanceNote}</div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: c.accent, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("homeworkPerformance")}</div>
          <div style={{ fontSize: 12.5, color: c.textPrimary, lineHeight: 1.6 }}>{homeworkNote || t("assignmentsCompletedOf", { completed: a.hwStatsOverall.completed, total: a.hwStatsOverall.total })}</div>
        </div>
        <div style={{ borderTop: `1px solid ${c.border}`, paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: c.textSecondary, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 3 }}>{t("conclusionLabel")}</div>
          <div style={{ fontSize: 12.5, color: c.textPrimary, lineHeight: 1.6, fontWeight: 600 }}>{overallConclusion}</div>
        </div>
      </Section>

      {/* FOCUS AREAS */}
      <Section title={t("focusAreasTitle")}>
        {recommendations.map((r, i) => (
          <div key={i} style={{ fontSize: 12.5, color: c.textPrimary, marginBottom: 6, display: "flex", gap: 6 }}>
            <span>{i + 1}.</span><span>{r}</span>
          </div>
        ))}
      </Section>
    </div>
  );
}
