import React from "react";
import { AlertTriangle, CreditCard, ClipboardList } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { attendanceService, gradeService, homeworkService, notificationService } from "../services/index.js";
import { Section, Row, AlertCard, StatPill } from "../components/common/UI.jsx";
import { LoadingSkeleton, ErrorState } from "../components/common/Feedback.jsx";
import { CURRENT_MONTH } from "../constants/months.js";
import { attendanceRate, currentPresentStreak, recentLateCount, scoreColor, daysUntilPaymentDue } from "../utils/calculations.js";
import { subj } from "../utils/subjectNames.js";
import { getPayments } from "../data/payments.js";
import { getHomework } from "../data/homework.js";

export default function Dashboard({ onNavigate }) {
  const { t, selectedStudent, lang, theme, notifPrefs, readNotifIds, deletedNotifIds } = useApp();
  const c = theme.colors;

  const attendanceQ = useAsyncData(() => attendanceService.get(selectedStudent.id), [selectedStudent.id]);
  const gradesQ = useAsyncData(() => gradeService.get(selectedStudent.id), [selectedStudent.id]);
  const homeworkQ = useAsyncData(() => homeworkService.get(selectedStudent.id), [selectedStudent.id]);
  const notifQ = useAsyncData(() => notificationService.get(selectedStudent.id), [selectedStudent.id]);

  const loading = attendanceQ.loading || gradesQ.loading || homeworkQ.loading;
  const error = attendanceQ.error || gradesQ.error || homeworkQ.error;

  if (loading) return <div style={{ padding: 18 }}><LoadingSkeleton rows={6} /></div>;
  if (error) return <ErrorState t={t} message={t("failedToLoad")} onRetry={() => { attendanceQ.reload(); gradesQ.reload(); homeworkQ.reload(); }} />;

  const monthDays = attendanceQ.data[CURRENT_MONTH];
  const today = monthDays[monthDays.length - 1];
  const rate = attendanceRate(monthDays);
  const streak = currentPresentStreak(monthDays);
  const lateRecent = recentLateCount(monthDays);
  const subjects = gradesQ.data;
  const topSubject = subjects[0];
  const overallAvg = Math.round(subjects.reduce((a, s) => a + s.score, 0) / subjects.length);
  const pendingHomework = homeworkQ.data.pending;
  const unreadCount = (notifQ.data || []).filter(n =>
    notifPrefs[n.category] && !deletedNotifIds.has(n.id) && !n.read && !readNotifIds.has(n.id)
  ).length;
  const payment = getPayments(selectedStudent.id);

  // Alerts are gathered once so we can show a calm "all clear" state when
  // there's genuinely nothing urgent, instead of an empty section.
  const alerts = [];
  if (today.status === "A") {
    alerts.push({ Icon: AlertTriangle, tone: "warn", label: t("alertAbsentToday", { name: selectedStudent.name }), onClick: () => onNavigate("attendance") });
  }
  if (payment.status !== "paid") {
    const days = daysUntilPaymentDue(payment.deadline, `${new Date().getFullYear()}-09-08`);
    const label = days === 0 ? t("alertPaymentDueToday") : days < 0 ? t("alertPaymentOverdue", { days: Math.abs(days) }) : t("alertPaymentDue", { days });
    alerts.push({ Icon: CreditCard, tone: "caution", label, onClick: () => onNavigate("payments") });
  }
  if (pendingHomework.length > 0) {
    alerts.push({ Icon: ClipboardList, tone: "caution", label: t("alertHomeworkPending", { n: pendingHomework.length }), sub: pendingHomework[0].title, onClick: () => onNavigate("homework") });
  }

  // Recent activity derived from real data (not invented) — most recent
  // resolved homework item and the most recent grade entry.
  const recentHw = [...homeworkQ.data.history].reverse()[0];
  const activity = [];
  if (recentHw) activity.push({ icon: recentHw.status === "completed" ? "📝" : "🔴", text: t("activityHwDone", { title: recentHw.title }) });
  activity.push({ icon: "📊", text: t("activityNewGrade", { subject: subj(lang, topSubject.name), score: topSubject.score }) });
  if (today.status !== "A") activity.push({ icon: "✓", text: t("activityAttended", { subject: subj(lang, today.subject) }) });

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontFamily: "inherit", fontSize: 22, fontWeight: 800, marginBottom: 14, color: c.textPrimary }}>
        {t("dashboardGreeting", { name: "Dilnoza" })}
      </div>

      {/* IMPORTANT ALERTS — visually distinct, never blends in with normal rows */}
      <Section title={t("importantAlerts")}>
        {alerts.length === 0 ? (
          <div style={{ fontSize: 12, color: c.textSecondary, padding: "4px 2px" }}>✅ {t("noAlerts")}</div>
        ) : (
          alerts.map((a, i) => <AlertCard key={i} Icon={a.Icon} label={a.label} sub={a.sub} tone={a.tone} onClick={a.onClick} />)
        )}
      </Section>

      {/* CHILD OVERVIEW — compact glance, not full rows */}
      <Section title={t("childOverview")}>
        <div style={{ display: "flex", gap: 8 }}>
          <StatPill value={`${rate}%`} label={t("attendanceRate")} color={scoreColor(theme, rate, [75, 90])} />
          <StatPill value={`${overallAvg}%`} label={t("currentAverage")} color={scoreColor(theme, overallAvg)} />
          <StatPill value={unreadCount} label={t("navNotifications")} />
        </div>
      </Section>

      {/* RECENT ACTIVITY */}
      <Section title={t("recentActivity")}>
        {activity.map((a, i) => <Row key={i} label={`${a.icon}  ${a.text}`} />)}
      </Section>

      {/* ACADEMIC PROGRESS */}
      <Section title={t("academicProgress")}>
        <Row label={t("currentAverage")} value={`${overallAvg}%`} valueColor={scoreColor(theme, overallAvg)} onClick={() => onNavigate("grades")} />
        <Row label={t("latestResult")} value={`${topSubject.score}%`} valueColor={scoreColor(theme, topSubject.score)} sub={subj(lang, topSubject.name)} onClick={() => onNavigate("grades")} />
      </Section>

      {/* QUICK ACTIONS */}
      <Section title={t("quickActions")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["attendance", t("viewAttendance")], ["homework", t("viewHomework")],
            ["grades", t("viewGrades")], ["payments", t("viewPayments")],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              style={{ border: "none", background: theme.colors.surfaceAlt, borderRadius: 10, padding: "14px 10px", fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left", color: theme.colors.textPrimary, fontFamily: "inherit" }}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* INSIGHTS — short summary only; full detail lives on its own screen */}
      <Section title={t("insightSummary")}>
        <Row label={`✨ ${t("navInsights")}`} value="" sub={t("insightsSubtitle")} onClick={() => onNavigate("insights")} />
      </Section>
    </div>
  );
}
