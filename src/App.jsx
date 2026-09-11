import React, { useState, useEffect } from "react";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import { getNotifications } from "./data/notifications.js";
import { getAttendance } from "./data/attendance.js";
import { attendanceRate, getAlertableUnreadCount } from "./utils/calculations.js";
import { CURRENT_MONTH, CURRENT_TIME_STR } from "./constants/months.js";
import { loadPersisted, savePersisted } from "./utils/persistence.js";
import { AppShell } from "./components/layout/AppShell.jsx";
import { Header } from "./components/layout/Header.jsx";
import { BottomNav } from "./components/layout/BottomNav.jsx";
import { BottomSheet } from "./components/common/Feedback.jsx";
import { Toast } from "./components/common/Feedback.jsx";
import { Row } from "./components/common/UI.jsx";

import Onboarding from "./screens/Onboarding.jsx";
import Registration from "./screens/Registration.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import Attendance from "./screens/Attendance.jsx";
import Grades from "./screens/Grades.jsx";
import Homework from "./screens/Homework.jsx";
import Payments from "./screens/Payments.jsx";
import Insights from "./screens/Insights.jsx";
import Notifications from "./screens/Notifications.jsx";
import Chat from "./screens/Chat.jsx";
import Settings from "./screens/Settings.jsx";
import Profile from "./screens/Profile.jsx";
import ConnectChild from "./screens/ConnectChild.jsx";
import More from "./screens/More.jsx";
import { PrintableReport } from "./components/PrintableReport.jsx";

const SCREEN_MAP = {
  dashboard: Dashboard, attendance: Attendance, grades: Grades, homework: Homework,
  payments: Payments, insights: Insights, notifications: Notifications, chat: Chat,
  settings: Settings, profile: Profile, connectChild: ConnectChild, more: More,
};

function PinLockScreen() {
  const { t, theme, pin, setLocked } = useApp();
  const c = theme.colors;
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    if (entry === pin) setLocked(false);
    else { setError(true); setEntry(""); }
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 28px", background: c.surface }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 16, textAlign: "center" }}>{t("enterYourPin")}</div>
      <input
        value={entry} onChange={(e) => { setEntry(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(false); }}
        type="text" inputMode="numeric" maxLength={4} placeholder="••••"
        style={{ width: "100%", maxWidth: 220, textAlign: "center", letterSpacing: 6, fontSize: 18, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 10, background: c.surfaceAlt, color: c.textPrimary }}
      />
      {error && <div style={{ color: c.danger, fontSize: 12, marginBottom: 10 }}>{t("wrongPin")}</div>}
      <button onClick={submit} style={{ width: "100%", maxWidth: 220, border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        {t("unlock")}
      </button>
    </div>
  );
}

function ChildSwitcherSheet({ open, onClose }) {
  const { t, studentList, selectedStudentId, setSelectedStudentId, setScreen, notifPrefs, quietHours, readNotifIds, deletedNotifIds } = useApp();
  return (
    <BottomSheet open={open} onClose={onClose} title={t("switchChild")}>
      {studentList.map(s => {
        const sDays = getAttendance(s.id)[CURRENT_MONTH] || [];
        const sRate = sDays.length ? attendanceRate(sDays) : null;
        const sUnread = getAlertableUnreadCount(getNotifications(s.id), notifPrefs, quietHours, CURRENT_TIME_STR, readNotifIds, deletedNotifIds);
        const subParts = [`${s.grade} · ${s.group}`];
        if (sRate !== null) subParts.push(`${t("attendanceRate")}: ${sRate}%`);
        if (sUnread > 0) subParts.push(`${sUnread} ${t("navNotifications").toLowerCase()}`);
        return (
          <Row
            key={s.id}
            label={s.name}
            sub={subParts.join(" · ")}
            tone={s.id === selectedStudentId ? "highlight" : "normal"}
            onClick={() => { setSelectedStudentId(s.id); onClose(); }}
          />
        );
      })}
      <Row label={`👤  ${t("navProfile")}`} onClick={() => { setScreen("profile"); onClose(); }} />
      <Row label={t("connectAnotherChild")} onClick={() => { setScreen("connectChild"); onClose(); }} />
    </BottomSheet>
  );
}

function MainApp() {
  const { screen, setScreen, locked, toast, registered, setRegistered, setParentPhone, selectedStudent, notifPrefs, quietHours, readNotifIds, deletedNotifIds, lang, t } = useApp();
  const [onboarded, setOnboarded] = useState(() => loadPersisted("onboarded", false));
  useEffect(() => savePersisted("onboarded", onboarded), [onboarded]);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [printReportOpen, setPrintReportOpen] = useState(false);

  if (!onboarded) {
    return <Onboarding onFinish={() => setOnboarded(true)} />;
  }
  if (!registered) {
    return <Registration onRegister={(phone) => { setParentPhone(phone); setRegistered(true); setScreen("dashboard"); }} />;
  }
  if (locked) {
    return <PinLockScreen />;
  }

  const ScreenComponent = SCREEN_MAP[screen] || Dashboard;
  const hasUnreadNotifications = getAlertableUnreadCount(getNotifications(selectedStudent.id), notifPrefs, quietHours, CURRENT_TIME_STR, readNotifIds, deletedNotifIds) > 0;

  return (
    <AppShell
      header={
        <Header
          onOpenSwitcher={() => setSwitcherOpen(true)}
          onOpenNotifications={() => setScreen("notifications")}
          hasUnreadNotifications={hasUnreadNotifications}
        />
      }
      bottomNav={
        <BottomNav
          active={screen}
          onSelect={(id) => setScreen(id)}
        />
      }
    >
      <ScreenComponent onNavigate={setScreen} onOpenPrintReport={() => setPrintReportOpen(true)} />
      <ChildSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <Toast text={toast} />
      {printReportOpen && (
        <PrintableReport student={selectedStudent} lang={lang} t={t} onClose={() => setPrintReportOpen(false)} />
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
