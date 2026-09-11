import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { notificationService } from "../services/index.js";
import { Row, Button } from "../components/common/UI.jsx";
import { LoadingSkeleton, ErrorState, EmptyState } from "../components/common/Feedback.jsx";
import { formatTime } from "../utils/formatters.js";
import { isQuietHoursNow, isSuppressedByQuietHours, daysUntilPaymentDue } from "../utils/calculations.js";
import { CURRENT_TIME_STR, CURRENT_DATE_STR } from "../constants/months.js";
import { getPayments } from "../data/payments.js";

const CATEGORIES = ["attendance", "homework", "grades", "payments", "general"];
const CATEGORY_LABEL_KEY = { attendance: "catAttendance", homework: "catHomework", grades: "catGrades", payments: "catPayments", general: "catGeneral" };

export default function Notifications() {
  const {
    t, selectedStudent, theme, lang, notifPrefs, quietHours,
    readNotifIds, markNotifRead, markAllNotifsRead, deletedNotifIds, deleteNotif,
  } = useApp();
  const c = theme.colors;
  const [catFilter, setCatFilter] = useState("all");
  const { data, loading, error, reload } = useAsyncData(() => notificationService.get(selectedStudent.id), [selectedStudent.id]);

  if (loading) return <div style={{ padding: 18 }}><LoadingSkeleton rows={4} /></div>;
  if (error) return <ErrorState t={t} message={t("failedToLoad")} onRetry={reload} />;

  const quietActive = isQuietHoursNow(quietHours, CURRENT_TIME_STR);
  const allVisible = data.filter(n =>
    notifPrefs[n.category] &&
    !deletedNotifIds.has(n.id) &&
    !isSuppressedByQuietHours(n.category, quietHours, CURRENT_TIME_STR)
  );
  const visible = catFilter === "all" ? allVisible : allVisible.filter(n => n.category === catFilter);
  const isRead = (n) => n.read || readNotifIds.has(n.id);
  const markAllRead = () => markAllNotifsRead(allVisible.map(n => n.id));
  const payment = getPayments(selectedStudent.id);
  const resolveVars = (n) => {
    if (n.textKey === "notifPaymentDue" && payment.deadline) {
      return { ...n.vars, days: daysUntilPaymentDue(payment.deadline, CURRENT_DATE_STR) };
    }
    return n.vars;
  };

  // "TODAY" summary — counts per category among today's notifications only.
  const todayCounts = {};
  allVisible.filter(n => n.time.startsWith(CURRENT_DATE_STR)).forEach(n => {
    todayCounts[n.category] = (todayCounts[n.category] || 0) + 1;
  });

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary }}>{t("notificationsTitle")}</div>
        {allVisible.length > 0 && (
          <button onClick={markAllRead} style={{ border: "none", background: "transparent", color: c.accent, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {t("markAllRead")}
          </button>
        )}
      </div>

      {quietActive && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: c.tint, borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 11.5, color: c.textPrimary }}>
          🌙 {t("quietHoursActiveNote", { start: quietHours.start, end: quietHours.end })}
        </div>
      )}

      {Object.keys(todayCounts).length > 0 && (
        <div style={{ background: c.surfaceStrong, borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 10.5, color: c.onAccent, opacity: 0.75, fontWeight: 700, letterSpacing: 0.5, marginBottom: 6 }}>{t("today").toUpperCase()}</div>
          {Object.entries(todayCounts).map(([cat, n]) => (
            <div key={cat} style={{ fontSize: 12.5, color: c.onAccent, marginBottom: 2 }}>
              {n} {t(CATEGORY_LABEL_KEY[cat])}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto" }}>
        {["all", ...CATEGORIES].map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)} style={{
            border: "none", borderRadius: 20, padding: "7px 12px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", flexShrink: 0,
            background: catFilter === cat ? c.surfaceStrong : c.surfaceAlt, color: catFilter === cat ? c.onAccent : c.textPrimary,
          }}>
            {cat === "all" ? t("all") : t(CATEGORY_LABEL_KEY[cat])}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="🔔" title={t("noNotifications")} />
      ) : (
        visible.map(n => {
          const read = isRead(n);
          return (
            <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 14px", background: c.surfaceAlt, borderRadius: 10, marginBottom: 8, opacity: read ? 0.65 : 1 }}>
              {!read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.accent, marginTop: 6, flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, color: c.textSecondary, marginBottom: 2 }}>{t(CATEGORY_LABEL_KEY[n.category])}</div>
                <div style={{ fontSize: 13, fontWeight: read ? 500 : 700, color: c.textPrimary }}>{t(n.textKey, resolveVars(n))}</div>
                <div style={{ fontSize: 10.5, color: c.textSecondary, marginTop: 3 }}>{formatTime(n.time, lang)}</div>
              </div>
              {!read && (
                <button onClick={() => markNotifRead(n.id)} style={{ border: "none", background: "transparent", color: c.accent, fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                  {t("markRead")}
                </button>
              )}
              <button onClick={() => deleteNotif(n.id)} aria-label={t("deleteNotificationAria")} style={{ border: "none", background: "transparent", color: c.textSecondary, fontSize: 13, cursor: "pointer", flexShrink: 0 }}>
                ✕
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
