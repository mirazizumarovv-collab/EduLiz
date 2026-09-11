import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { attendanceService } from "../services/index.js";
import { Section, Row } from "../components/common/UI.jsx";
import { BottomSheet } from "../components/common/Feedback.jsx";
import { LoadingSkeleton, ErrorState } from "../components/common/Feedback.jsx";
import { MONTHS, MONTH_NAMES } from "../constants/months.js";
import { attendanceRate, longestPresentStreak, scoreColor } from "../utils/calculations.js";
import { subj } from "../utils/subjectNames.js";

// Distinct color AND label/icon per status — never color alone (requirement #12).
const STATUS_META = {
  P: { labelKey: "present", icon: "✓" },
  L: { labelKey: "late", icon: "!" },
  A: { labelKey: "absent", icon: "✕" },
};

export default function Attendance() {
  const { t, lang, selectedStudent, theme } = useApp();
  const c = theme.colors;
  const [monthIdx, setMonthIdx] = useState(MONTHS.length - 1);
  const [openDay, setOpenDay] = useState(null);

  const { data, loading, error, reload } = useAsyncData(() => attendanceService.get(selectedStudent.id), [selectedStudent.id]);

  if (loading) return <div style={{ padding: 18 }}><LoadingSkeleton rows={5} /></div>;
  if (error) return <ErrorState t={t} message={t("failedToLoad")} onRetry={reload} />;

  const monthKey = MONTHS[monthIdx];
  const days = data[monthKey];
  const rate = attendanceRate(days);
  const lastMonthKey = MONTHS[monthIdx - 1];
  const lastMonthRate = lastMonthKey ? attendanceRate(data[lastMonthKey]) : null;
  const streak = longestPresentStreak(data);
  const present = days.filter(d => d.status === "P").length;
  const late = days.filter(d => d.status === "L");
  const absent = days.filter(d => d.status === "A").length;

  const trendMsg = lastMonthRate === null ? null : rate >= lastMonthRate ? t("attendanceGoodMsg") : t("attendanceDropMsg");

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4, color: c.textPrimary }}>{t("attendanceTitle")}</div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <button disabled={monthIdx === 0} onClick={() => setMonthIdx(i => i - 1)} style={{ border: "none", background: "transparent", color: monthIdx === 0 ? c.textSecondary : c.accent, fontSize: 18, opacity: monthIdx === 0 ? 0.4 : 1 }}>‹</button>
        <span style={{ fontSize: 13, color: c.textSecondary }}>{MONTH_NAMES[lang][monthKey]}</span>
        <button disabled={monthIdx === MONTHS.length - 1} onClick={() => setMonthIdx(i => i + 1)} style={{ border: "none", background: "transparent", color: monthIdx === MONTHS.length - 1 ? c.textSecondary : c.accent, fontSize: 18, opacity: monthIdx === MONTHS.length - 1 ? 0.4 : 1 }}>›</button>
      </div>
      <div style={{ fontSize: 11, color: c.textSecondary, marginBottom: 14 }}>{t("tapDayHint")}</div>

      {trendMsg && (
        <Row label={trendMsg} value={`${rate}%`} sub={lastMonthRate !== null ? `${t("lastMonth")}: ${lastMonthRate}%` : undefined} />
      )}

      <div style={{ display: "flex", gap: 8, margin: "10px 0 14px" }}>
        {[[t("present"), present, c.good], [t("late"), late.length, c.medium], [t("absent"), absent, c.bad]].map(([label, n, color]) => (
          <div key={label} style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 10, background: c.surfaceAlt }}>
            <div style={{ fontSize: 18, fontWeight: 800, color }}>{n}</div>
            <div style={{ fontSize: 11, color: c.textSecondary }}>{label}</div>
          </div>
        ))}
      </div>

      <Row label={t("attendanceRate")} value={`${rate}%`} valueColor={scoreColor(theme, rate, [75, 90])} sub={`${t("longestStreak")}: ${streak}`} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, margin: "14px 0 18px" }}>
        {days.map((d, i) => {
          const meta = STATUS_META[d.status];
          const bg = d.status === "P" ? c.good : d.status === "L" ? c.medium : c.bad;
          const fg = d.status === "L" ? "#33270A" : "#FFFFFF";
          return (
            <button
              key={i}
              onClick={() => setOpenDay(d)}
              aria-label={`${d.day}: ${t(meta.labelKey)}`}
              style={{ aspectRatio: "1", borderRadius: 6, background: bg, color: fg, border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, minHeight: 34 }}
            >
              <span>{d.day}</span>
              <span style={{ fontSize: 8, opacity: 0.9 }}>{meta.icon}</span>
            </button>
          );
        })}
      </div>

      <Section title={t("late")}>
        {late.length === 0 ? <div style={{ fontSize: 12.5, color: c.textSecondary }}>—</div> :
          late.map((d, i) => <Row key={i} label={`${MONTH_NAMES[lang][monthKey]} ${d.day}`} value={`${d.lateBy} ${t("minutes")}`} />)}
      </Section>

      <BottomSheet open={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? `${MONTH_NAMES[lang][monthKey]} ${openDay.day}` : ""}>
        {openDay && (
          <>
            <Row label={t("scheduledLesson")} value={openDay.time} sub={`${subj(lang, openDay.subject)} · ${openDay.teacher}`} />
            <Row label={t("topic")} value="" sub={openDay.topic} />
            <Row label={t("status")} value={t(STATUS_META[openDay.status].labelKey)} tone={openDay.status === "A" ? "highlight" : "normal"} />
            {openDay.checkIn && <Row label={t("checkedInAt")} value={openDay.checkIn} sub={openDay.checkedInBy} />}
          </>
        )}
      </BottomSheet>
    </div>
  );
}
