import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { gradeService } from "../services/index.js";
import { Section, Row } from "../components/common/UI.jsx";
import { BottomSheet, LoadingSkeleton, ErrorState, EmptyState } from "../components/common/Feedback.jsx";
import { TrendLineChart } from "../components/charts/TrendLineChart.jsx";
import { computeSubjectDerived } from "../data/grades.js";
import { groupComparisonLabel, scoreColor } from "../utils/calculations.js";
import { subj } from "../utils/subjectNames.js";
import { MONTHS, MONTH_NAMES } from "../constants/months.js";

export default function Grades() {
  const { t, lang, selectedStudent, theme } = useApp();
  const c = theme.colors;
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [period, setPeriod] = useState("all");

  const { data, loading, error, reload } = useAsyncData(() => gradeService.get(selectedStudent.id), [selectedStudent.id]);

  if (loading) return <div style={{ padding: 18 }}><LoadingSkeleton rows={5} /></div>;
  if (error) return <ErrorState t={t} message={t("failedToLoad")} onRetry={reload} />;
  if (!data || data.length === 0) return <EmptyState icon="📊" title={t("noHomework")} />;

  const subjects = data.map(computeSubjectDerived);
  const allAvailableMonths = subjects[0].monthly.map(m => m.month);
  const availableMonths = period === "thisMonth" ? allAvailableMonths.slice(-1)
    : period === "semester" ? allAvailableMonths.slice(-3)
    : allAvailableMonths;

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2, color: c.textPrimary }}>{t("gradesTitle")}</div>
      <div style={{ fontSize: 12.5, color: c.textSecondary, marginBottom: 16 }}>{t("gradesSubtitle")}</div>

      {subjects.map(s => {
        const comparison = groupComparisonLabel(s.score, s.classAvg);
        return (
          <div key={s.name} style={{ background: c.surfaceAlt, borderRadius: 10, padding: 14, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{subj(lang, s.name)}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: scoreColor(theme, s.score) }}>{s.score}%</span>
            </div>
            <div style={{ fontSize: 11.5, color: c.textSecondary, marginBottom: 8 }}>
              {s.lastAssessment.title} · {s.lastAssessment.scoreRaw} · {s.lastAssessment.date}
            </div>
            <div style={{ fontSize: 11.5, color: comparison.key === "belowGroupAverage" ? c.danger : c.accent, fontWeight: 700, marginBottom: 10 }}>
              {t(comparison.key)}{comparison.pct > 0 ? ` (${t("byPercent", { pct: comparison.pct })})` : ""}
            </div>
            <TrendLineChart data={s.weeklyTrend} dataKey="score" xKey="week" height={60} />
            <div style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 10.5, color: c.textSecondary }}>
              <span>{t("bestMonth")}: {MONTH_NAMES[lang][s.best.month]} ({s.best.score})</span>
              <span>{t("lowestMonth")}: {MONTH_NAMES[lang][s.worst.month]} ({s.worst.score})</span>
            </div>
          </div>
        );
      })}

      <Section title={t("monthlyResults")} subtitle={t("tapMonthHint")}>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[["all", t("periodAll")], ["semester", t("periodSemester")], ["thisMonth", t("periodThisMonth")]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)} style={{ border: "none", borderRadius: 20, padding: "7px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", background: period === id ? c.surfaceStrong : c.surfaceAlt, color: period === id ? c.onAccent : c.textPrimary }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {availableMonths.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)} style={{ border: "none", background: c.surfaceAlt, borderRadius: 10, padding: "10px 16px", color: c.accent, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
              {MONTH_NAMES[lang][m]}
            </button>
          ))}
        </div>
      </Section>

      <BottomSheet open={!!selectedMonth} onClose={() => setSelectedMonth(null)} title={selectedMonth ? MONTH_NAMES[lang][selectedMonth] : ""}>
        {selectedMonth && subjects.map(s => {
          const entry = s.monthly.find(m => m.month === selectedMonth);
          return <Row key={s.name} label={subj(lang, s.name)} value={entry ? `${entry.score}%` : "—"} />;
        })}
      </BottomSheet>
    </div>
  );
}
