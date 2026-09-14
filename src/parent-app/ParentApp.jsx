import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";
import { getNotifications } from "./data/notifications.js";
import { getAttendance } from "./data/attendance.js";
import { attendanceRate, getAlertableUnreadCount } from "./utils/calculations.js";
import { CURRENT_MONTH, CURRENT_TIME_STR } from "./constants/months.js";
import { AppShell } from "./components/layout/AppShell.jsx";
import { Header } from "./components/layout/Header.jsx";
import { BottomNav } from "./components/layout/BottomNav.jsx";
import { BottomSheet, Toast } from "./components/common/Feedback.jsx";
import { Row, Button } from "./components/common/UI.jsx";

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
  const { t, theme, pin, setPin, setLocked, parentPhone } = useApp();
  const c = theme.colors;
  const [entry, setEntry] = useState("");
  const [error, setError] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [step, setStep] = useState("confirm"); // confirm -> code -> newpin
  const [demoCode, setDemoCode] = useState("");
  const [codeEntry, setCodeEntry] = useState("");
  const [codeError, setCodeError] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [newPinError, setNewPinError] = useState("");

  const submit = () => {
    if (entry === pin) setLocked(false);
    else { setError(true); setEntry(""); }
  };

  const openForgot = () => {
    setStep("confirm");
    setCodeEntry(""); setCodeError(""); setNewPin(""); setNewPinConfirm(""); setNewPinError("");
    setForgotOpen(true);
  };
  const sendCode = () => {
    setDemoCode(String(Math.floor(1000 + Math.random() * 9000)));
    setStep("code");
  };
  const verifyCode = () => {
    if (codeEntry === demoCode) { setStep("newpin"); setCodeError(""); }
    else setCodeError(t("wrongCode"));
  };
  const saveNewPin = () => {
    if (!/^\d{4}$/.test(newPin)) { setNewPinError(t("enterPin")); return; }
    if (newPin !== newPinConfirm) { setNewPinError(t("pinMismatch")); return; }
    setPin(newPin);
    setForgotOpen(false);
    setLocked(false);
  };

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "0 28px", background: c.surface }}>
      <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary, marginBottom: 16, textAlign: "center" }}>{t("enterYourPin")}</div>
      <div style={{ position: "relative", width: "100%", maxWidth: 220, marginBottom: 10 }}>
        <input
          value={entry} onChange={(e) => { setEntry(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(false); }}
          type={reveal ? "text" : "password"} inputMode="numeric" maxLength={4} placeholder="••••"
          style={{ width: "100%", textAlign: "center", letterSpacing: 6, fontSize: 18, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 40px 12px 12px", background: c.surfaceAlt, color: c.textPrimary, boxSizing: "border-box" }}
        />
        <button
          type="button" onClick={() => setReveal(r => !r)} aria-label={reveal ? t("hidePin") : t("showPin")}
          style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: c.textSecondary, cursor: "pointer", padding: 4, display: "flex" }}
        >
          {reveal ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <div style={{ color: c.danger, fontSize: 12, marginBottom: 10 }}>{t("wrongPin")}</div>}
      <button onClick={submit} style={{ width: "100%", maxWidth: 220, border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 10, padding: "13px 0", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
        {t("unlock")}
      </button>
      <button onClick={openForgot} style={{ border: "none", background: "transparent", color: c.textSecondary, fontSize: 12.5, marginTop: 16, cursor: "pointer", textDecoration: "underline" }}>
        {t("forgotPin")}
      </button>

      <BottomSheet open={forgotOpen} onClose={() => setForgotOpen(false)} title={t("forgotPinTitle")}>
        {step === "confirm" && (
          <>
            <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 14, lineHeight: 1.6 }}>{t("forgotPinConfirmBody")}</div>
            <div style={{ background: c.surfaceAlt, borderRadius: 10, padding: "12px 14px", marginBottom: 16, fontSize: 15, fontWeight: 700, color: c.textPrimary, textAlign: "center" }}>
              {parentPhone || "—"}
            </div>
            <Button onClick={sendCode} disabled={!parentPhone} style={{ width: "100%" }}>{t("sendCode")}</Button>
          </>
        )}
        {step === "code" && (
          <>
            <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 6, lineHeight: 1.6 }}>{t("codeSentTo", { phone: parentPhone })}</div>
            <div style={{ fontSize: 11.5, color: c.accent, marginBottom: 14, lineHeight: 1.5 }}>{t("demoCodeNote", { code: demoCode })}</div>
            <input
              value={codeEntry} onChange={(e) => { setCodeEntry(e.target.value.replace(/\D/g, "").slice(0, 4)); setCodeError(""); }}
              inputMode="numeric" maxLength={4} placeholder="0000"
              style={{ width: "100%", textAlign: "center", letterSpacing: 6, fontSize: 18, border: `1px solid ${codeError ? c.danger : c.border}`, borderRadius: 10, padding: 12, marginBottom: 8, background: c.surfaceAlt, color: c.textPrimary, boxSizing: "border-box" }}
            />
            {codeError && <div style={{ color: c.danger, fontSize: 12, marginBottom: 8 }}>{codeError}</div>}
            <Button onClick={verifyCode} style={{ width: "100%" }}>{t("verifyCode")}</Button>
          </>
        )}
        {step === "newpin" && (
          <>
            <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 14 }}>{t("setNewPinBody")}</div>
            <input
              value={newPin} onChange={(e) => { setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4)); setNewPinError(""); }}
              type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              style={{ width: "100%", textAlign: "center", letterSpacing: 4, fontSize: 16, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 10, background: c.surfaceAlt, color: c.textPrimary, boxSizing: "border-box" }}
            />
            <input
              value={newPinConfirm} onChange={(e) => { setNewPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4)); setNewPinError(""); }}
              type="password" inputMode="numeric" maxLength={4} placeholder="••••"
              style={{ width: "100%", textAlign: "center", letterSpacing: 4, fontSize: 16, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 10, background: c.surfaceAlt, color: c.textPrimary, boxSizing: "border-box" }}
            />
            {newPinError && <div style={{ color: c.danger, fontSize: 12, marginBottom: 10 }}>{newPinError}</div>}
            <Button onClick={saveNewPin} style={{ width: "100%" }}>{t("saveNewPin")}</Button>
          </>
        )}
      </BottomSheet>
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
        const subParts = [`${s.grade}`];
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

export default function ParentApp() {
  const {
    screen, setScreen, locked, toast, registered, setRegistered, setParentPhone,
    selectedStudent, notifPrefs, quietHours, readNotifIds, deletedNotifIds, lang, t,
    onboarded, setOnboarded, navItems,
  } = useApp();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [printReportOpen, setPrintReportOpen] = useState(false);

  if (!onboarded) {
    return <Onboarding onFinish={() => setOnboarded(true)} />;
  }
  if (!registered) {
    return <Registration onRegister={(phone) => { setParentPhone(phone); setRegistered(true); setScreen("dashboard"); }} onBack={() => setOnboarded(false)} />;
  }
  if (locked) {
    return <PinLockScreen />;
  }
  if (!selectedStudent) {
    return <ConnectChild onNavigate={setScreen} onBack={() => setRegistered(false)} />;
  }

  const ScreenComponent = SCREEN_MAP[screen] || Dashboard;
  const hasUnreadNotifications = getAlertableUnreadCount(getNotifications(selectedStudent.id), notifPrefs, quietHours, CURRENT_TIME_STR, readNotifIds, deletedNotifIds) > 0;
  const isTopLevelScreen = navItems.includes(screen) || screen === "dashboard";

  return (
    <AppShell
      header={
        <Header
          onOpenSwitcher={() => setSwitcherOpen(true)}
          onOpenNotifications={() => setScreen("notifications")}
          hasUnreadNotifications={hasUnreadNotifications}
          showBack={!isTopLevelScreen}
          onBack={() => setScreen("dashboard")}
        />
      }
      bottomNav={
        <BottomNav active={screen} onSelect={(id) => setScreen(id)} />
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
