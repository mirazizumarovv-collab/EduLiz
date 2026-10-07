import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { homeworkService } from "../services/index.js";
import { Row } from "../components/common/UI.jsx";
import { BottomSheet, LoadingSkeleton, ErrorState, EmptyState } from "../components/common/Feedback.jsx";
import { homeworkStats } from "../utils/calculations.js";
import { subj } from "../utils/subjectNames.js";
import { MONTH_NAMES } from "../constants/months.js";
import { daysBetweenISO } from "../../utils/clock.js";

const FILTERS = ["all", "pending", "completed", "lateHw", "overdue"];
const STATUS_COLOR_KEY = { completed: "good", overdue: "bad", pending: "medium" };

// Every item carries its full ISO `due` date ("YYYY-MM-DD"); the month and day
// to show are read straight off that text.
const MONTH_ABBREVS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dueMonthDay(item) {
  return { month: MONTH_ABBREVS[Number(item.due.slice(5, 7)) - 1], day: Number(item.due.slice(8, 10)) };
}
// Whole calendar days from `today` to the due date (negative once it is past).
function daysUntil(item, today) {
  return daysBetweenISO(today, item.due);
}

function HomeworkCard({ item, lang, t, c, onClick }) {
  const { month, day } = dueMonthDay(item);
  const monthLabel = MONTH_NAMES[lang][month] || month;
  const isLateCompleted = item.status === "completed" && item.onTime === false;
  const statusColor = isLateCompleted ? c.medium : c[STATUS_COLOR_KEY[item.status]];
  return (
    <button onClick={onClick} style={{
      display: "block", width: "100%", textAlign: "left", border: "none", cursor: "pointer",
      background: c.surfaceAlt, borderRadius: 10, padding: "12px 14px", marginBottom: 8,
    }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: c.textPrimary, marginBottom: 2 }}>{subj(lang, item.subject)}</div>
      <div style={{ fontSize: 12, color: c.textSecondary, marginBottom: 8 }}>{item.title}</div>
      <div style={{ fontSize: 11.5, color: c.textSecondary, marginBottom: 4 }}>
        📅 {item.status === "overdue" ? t("dueOn") : t("submitBy")}: {monthLabel} {day}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: statusColor, display: "flex", alignItems: "center", gap: 5 }}>
        {item.status === "overdue" && "🔴"} {isLateCompleted ? t("completedLate") : item.status === "pending" ? `${t("status")}: ${t(item.status)}` : t(item.status)}
      </div>
    </button>
  );
}

export default function Homework() {
  const { t, lang, selectedStudent, theme, homeworkRecords, homeworkSubmissions, today } = useApp();
  const c = theme.colors;
  const [filter, setFilter] = useState("all");
  const [openItem, setOpenItem] = useState(null);

  const { data, loading, error, reload } = useAsyncData(() => homeworkService.get(selectedStudent.id), [selectedStudent.id, homeworkRecords, homeworkSubmissions, today]);
  // Live: the canonical store is in the dependency array, so this re-fetches
  // the moment Teacher/Admin/Operator changes it — no remount needed (see Chat.jsx
  // for the same pattern applied directly against context instead of a service).

  if (loading) return <div style={{ padding: 18 }}><LoadingSkeleton rows={5} /></div>;
  if (error) return <ErrorState t={t} message={t("failedToLoad")} onRetry={reload} />;

  const { pending, history } = data;
  const stats = homeworkStats(pending, history);
  const allItems = [...pending, ...history];
  const filtered = filter === "all" ? allItems
    : filter === "lateHw" ? allItems.filter(h => h.status === "completed" && h.onTime === false)
    : filter === "completed" ? allItems.filter(h => h.status === "completed" && h.onTime !== false)
    : allItems.filter(h => h.status === filter);

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2, color: c.textPrimary }}>{t("homeworkTitle")}</div>
      <div style={{ fontSize: 12.5, color: c.textSecondary, marginBottom: 14 }}>{t("homeworkSubtitle")}</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 10, background: c.surfaceAlt }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: c[STATUS_COLOR_KEY.completed] }}>{stats.completionRate}%</div>
          <div style={{ fontSize: 10.5, color: c.textSecondary }}>{t("completionRate")}</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 10, background: c.surfaceAlt }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: c[STATUS_COLOR_KEY.completed] }}>{stats.onTimeRate}%</div>
          <div style={{ fontSize: 10.5, color: c.textSecondary }}>{t("onTimeRate")}</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 10, background: c.surfaceAlt }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: c.accent }}>{stats.total}</div>
          <div style={{ fontSize: 10.5, color: c.textSecondary }}>{t("totalAssignments")}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              border: "none", borderRadius: 20, padding: "8px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
              background: filter === f ? c.surfaceStrong : c.surfaceAlt, color: filter === f ? c.onAccent : c.textPrimary,
            }}
          >
            {t(f)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon="📝" title={t("noHomework")} />
      ) : (
        filtered.map(h => <HomeworkCard key={h.id} item={h} lang={lang} t={t} c={c} onClick={() => setOpenItem(h)} />)
      )}

      <BottomSheet open={!!openItem} onClose={() => setOpenItem(null)} title={openItem ? openItem.title : ""}>
        {openItem && (() => {
          const { month, day } = dueMonthDay(openItem);
          const remaining = daysUntil(openItem, today);
          const remainingLabel = remaining === 0 ? t("dueTodayCountdown") : remaining === 1 ? t("dueTomorrowCountdown")
            : remaining > 1 ? t("daysLeft", { n: remaining }) : t("daysOverdue", { n: Math.abs(remaining) });
          return (
            <>
              <Row label={t("subject")} value={subj(lang, openItem.subject)} />
              <Row label={t("dueDateFull")} value={`${MONTH_NAMES[lang][month] || month} ${day}`} />
              <Row
                label={t("timeRemaining")} value={remainingLabel}
                valueColor={openItem.status === "overdue" ? c.bad : openItem.status === "pending" ? c.medium : c.textSecondary}
              />
              <Row
                label={t("status")}
                value={openItem.status === "completed" && openItem.onTime === false ? t("completedLate") : t(openItem.status)}
                valueColor={openItem.status === "completed" && openItem.onTime === false ? c.medium : c[STATUS_COLOR_KEY[openItem.status]]}
              />
            </>
          );
        })()}
      </BottomSheet>
    </div>
  );
}
