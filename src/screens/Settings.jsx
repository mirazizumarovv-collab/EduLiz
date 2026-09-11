import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useApp, NAV_POOL } from "../context/AppContext.jsx";
import { Section, Row, Toggle, Button } from "../components/common/UI.jsx";
import { BottomSheet, ConfirmDialog } from "../components/common/Feedback.jsx";
import { SUPPORTED_LANGUAGES } from "../i18n/index.js";
import { useInstallPrompt } from "../hooks/useInstallPrompt.js";

const NOTIF_KEYS = ["attendance", "homework", "grades", "payments", "general"];
const NOTIF_LABEL_KEY = { attendance: "catAttendance", homework: "catHomework", grades: "catGrades", payments: "catPayments", general: "catGeneral" };

export default function Settings({ onNavigate, onOpenPrintReport }) {
  const {
    t, theme, themeMode, setThemeMode, lang, setLang,
    notifPrefs, setNotifPrefs, quietHours, setQuietHours,
    guardians, revokeGuardian, addGuardian, showToast,
    appLockEnabled, setAppLockEnabled, pin, setPin,
    selectedStudent, studentList,
    navItems, toggleNavItem,
    parentPhone, logout,
  } = useApp();
  const { canInstall, installed, promptInstall } = useInstallPrompt();
  const c = theme.colors;

  const [pinSheetOpen, setPinSheetOpen] = useState(false);
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinReveal, setPinReveal] = useState(false);
  const [pinError, setPinError] = useState("");
  const [guardianToRemove, setGuardianToRemove] = useState(null);
  const [inviteSheetOpen, setInviteSheetOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState("Mother");
  const [inviteError, setInviteError] = useState("");

  const submitInvite = () => {
    if (!inviteName.trim()) { setInviteError(t("errorNameRequired")); return; }
    if (!invitePhone.trim()) { setInviteError(t("errorPhoneRequired")); return; }
    addGuardian({ name: inviteName.trim(), phone: invitePhone.trim(), role: inviteRole });
    setInviteName(""); setInvitePhone(""); setInviteRole("Mother"); setInviteError("");
    setInviteSheetOpen(false);
    showToast(t("inviteSent"));
  };

  const savePin = () => {
    if (!/^\d{4}$/.test(pinDraft)) { setPinError(t("enterPin")); return; }
    if (pinDraft !== pinConfirm) { setPinError(t("pinMismatch")); return; }
    setPin(pinDraft);
    setAppLockEnabled(true);
    setPinSheetOpen(false);
    setPinDraft(""); setPinConfirm(""); setPinError("");
  };

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: c.textPrimary }}>{t("settingsTitle")}</div>

      <Section title={t("sectionAccount")}>
        <Row label={t("profile")} onClick={() => onNavigate("profile")} />
        <Row label={t("phoneNumber")} value={parentPhone || "—"} />
        <Row label={t("pinSecurity")} value={appLockEnabled ? t("on") : t("off")} onClick={() => setPinSheetOpen(true)} />
      </Section>

      <Section title={t("sectionChildren")}>
        {studentList.map(s => <Row key={s.id} label={s.name} sub={`${s.grade} · ${s.group}`} />)}
        <Row label={t("connectAnotherChild")} onClick={() => onNavigate("connectChild")} />
        <Row label={t("guardianAccess")} sub={`${guardians.length}`} />
      </Section>

      <Section title={t("sectionPreferences")}>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: c.textPrimary }}>{t("language")}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {SUPPORTED_LANGUAGES.map(l => (
            <button key={l.id} onClick={() => setLang(l.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", background: lang === l.id ? c.surfaceStrong : c.surfaceAlt, color: lang === l.id ? c.onAccent : c.textPrimary, fontWeight: 700, fontSize: 12 }}>
              {l.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: c.textPrimary }}>{t("theme")}</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["light", t("day")], ["dark", t("night")]].map(([mode, label]) => (
            <button key={mode} onClick={() => setThemeMode(mode)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", background: themeMode === mode ? c.surfaceStrong : c.surfaceAlt, color: themeMode === mode ? c.onAccent : c.textPrimary, fontWeight: 700, fontSize: 12 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: c.textPrimary }}>{t("notifications")}</div>
        {NOTIF_KEYS.map(k => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 2px" }}>
            <span style={{ fontSize: 13, color: c.textPrimary }}>{t(NOTIF_LABEL_KEY[k])}</span>
            <Toggle isOn={notifPrefs[k]} onChange={(v) => setNotifPrefs({ ...notifPrefs, [k]: v })} />
          </div>
        ))}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 2px 4px" }}>
          <div>
            <div style={{ fontSize: 13, color: c.textPrimary }}>{t("quietHours")}</div>
            <div style={{ fontSize: 10.5, color: c.textSecondary }}>{t("quietHoursDesc")}</div>
          </div>
          <Toggle isOn={quietHours.enabled} onChange={(v) => setQuietHours({ ...quietHours, enabled: v })} />
        </div>
        {quietHours.enabled && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 2px" }}>
            <span style={{ fontSize: 11, color: c.textSecondary }}>{t("from")}</span>
            <input type="time" value={quietHours.start} onChange={(e) => setQuietHours({ ...quietHours, start: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, background: c.surfaceAlt, color: c.textPrimary }} />
            <span style={{ fontSize: 11, color: c.textSecondary }}>{t("to")}</span>
            <input type="time" value={quietHours.end} onChange={(e) => setQuietHours({ ...quietHours, end: e.target.value })} style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 12, background: c.surfaceAlt, color: c.textPrimary }} />
          </div>
        )}
      </Section>

      <Section title={t("customizeNavTitle")}>
        <div style={{ fontSize: 11, color: c.textSecondary, marginBottom: 10, lineHeight: 1.5 }}>{t("customizeNavHint")}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 2px", opacity: 0.6 }}>
          <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: c.textPrimary }}><NAV_POOL.dashboard.Icon size={15} /> {t(NAV_POOL.dashboard.key)} · {t("alwaysShown")}</span>
          <Toggle isOn={true} onChange={() => {}} />
        </div>
        {Object.entries(NAV_POOL).filter(([id]) => id !== "dashboard").map(([id, item]) => (
          <div key={id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 2px" }}>
            <span style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 8, color: c.textPrimary }}><item.Icon size={15} /> {t(item.key)}</span>
            <Toggle isOn={navItems.includes(id)} onChange={() => toggleNavItem(id)} />
          </div>
        ))}
      </Section>

      <Section title={t("sectionPrivacy")}>
        <div style={{ fontSize: 11.5, color: c.textSecondary, lineHeight: 1.6, marginBottom: 10 }}>{t("privacyStatement")}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: c.textPrimary }}>{t("guardiansTitle")}</div>
        {guardians.map(g => (
          <div key={g.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 2px" }}>
            <div>
              <div style={{ fontSize: 13, color: c.textPrimary }}>{g.name}{g.isSelf ? ` (${t("you")})` : ""}</div>
              <div style={{ fontSize: 10.5, color: c.textSecondary }}>{t(`role${g.role}`)}{g.phone ? ` · ${g.phone}` : ""}</div>
            </div>
            {!g.isSelf && (
              <button onClick={() => setGuardianToRemove(g)} style={{ border: "none", background: "transparent", color: c.danger, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                {t("removeAccess")}
              </button>
            )}
          </div>
        ))}
        <Row label={t("addGuardian")} onClick={() => setInviteSheetOpen(true)} />
        {canInstall && <Row label={t("installApp")} sub={t("installAppDesc")} onClick={() => promptInstall().then(o => o === "accepted" && showToast(t("installAppDone")))} />}
        {installed && <Row label={t("installApp")} sub={t("installAppAlready")} />}
        <Row label={t("printReport")} sub={t("printReportDesc")} onClick={onOpenPrintReport} />
      </Section>

      <Section title={t("sectionApplication")}>
        <Row label={t("appVersion")} value="1.0.0" />
        <Row label={t("help")} />
        <Row label={t("about")} />
        <Row label={t("logout")} onClick={logout} />
      </Section>

      <BottomSheet open={pinSheetOpen} onClose={() => setPinSheetOpen(false)} title={t("setPin")}>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input type={pinReveal ? "text" : "password"} inputMode="numeric" maxLength={4} value={pinDraft} onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" style={{ width: "100%", textAlign: "center", letterSpacing: 4, fontSize: 16, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 40px", background: c.surfaceAlt, color: c.textPrimary, boxSizing: "border-box" }} />
        </div>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <input type={pinReveal ? "text" : "password"} inputMode="numeric" maxLength={4} value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" style={{ width: "100%", textAlign: "center", letterSpacing: 4, fontSize: 16, border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 40px", background: c.surfaceAlt, color: c.textPrimary, boxSizing: "border-box" }} />
          <button
            type="button" onClick={() => setPinReveal(r => !r)} aria-label={pinReveal ? t("hidePin") : t("showPin")}
            style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: c.textSecondary, cursor: "pointer", padding: 4, display: "flex" }}
          >
            {pinReveal ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {pinError && <div style={{ color: c.danger, fontSize: 12, marginBottom: 8 }}>{pinError}</div>}
        <Button onClick={savePin} style={{ width: "100%" }}>{t("save")}</Button>
      </BottomSheet>

      <BottomSheet open={inviteSheetOpen} onClose={() => setInviteSheetOpen(false)} title={t("inviteGuardianTitle")}>
        <label style={{ fontSize: 11, color: c.textSecondary, marginBottom: 4, display: "block" }}>{t("fullName")}</label>
        <input
          value={inviteName} onChange={(e) => { setInviteName(e.target.value); if (inviteError) setInviteError(""); }} placeholder="Sardor Aliyev"
          style={{ width: "100%", border: `1px solid ${c.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 13.5, background: c.surfaceAlt, color: c.textPrimary, marginBottom: 12, boxSizing: "border-box" }}
        />
        <label style={{ fontSize: 11, color: c.textSecondary, marginBottom: 4, display: "block" }}>{t("phoneNumber")}</label>
        <input
          value={invitePhone} onChange={(e) => {
            let val = e.target.value;
            if (!val.startsWith("+998")) {
              const digitsOnly = val.replace(/\D/g, "");
              val = digitsOnly.length === 0 ? "" : `+998 ${digitsOnly}`;
            }
            setInvitePhone(val);
            if (inviteError) setInviteError("");
          }} inputMode="numeric" placeholder="+998 90 123 45 67"
          style={{ width: "100%", border: `1px solid ${c.border}`, borderRadius: 10, padding: "11px 14px", fontSize: 13.5, background: c.surfaceAlt, color: c.textPrimary, marginBottom: 12, boxSizing: "border-box" }}
        />
        <label style={{ fontSize: 11, color: c.textSecondary, marginBottom: 4, display: "block" }}>{t("relationship")}</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {["Mother", "Father", "Guardian"].map(r => (
            <button key={r} onClick={() => setInviteRole(r)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", background: inviteRole === r ? c.surfaceStrong : c.surfaceAlt, color: inviteRole === r ? c.onAccent : c.textPrimary, fontWeight: 700, fontSize: 12 }}>
              {t(`role${r}`)}
            </button>
          ))}
        </div>
        {inviteError && <div style={{ color: c.danger, fontSize: 12, marginBottom: 12 }}>{inviteError}</div>}
        <Button onClick={submitInvite} style={{ width: "100%" }}>{t("invite")}</Button>
      </BottomSheet>

      <ConfirmDialog
        open={!!guardianToRemove}
        title={t("removeGuardianTitle")}
        body={guardianToRemove ? t("removeGuardianBody", { name: guardianToRemove.name, child: selectedStudent.name }) : ""}
        confirmLabel={t("removeAccess")}
        cancelLabel={t("cancel")}
        onCancel={() => setGuardianToRemove(null)}
        onConfirm={() => { revokeGuardian(guardianToRemove.id); showToast(t("accessRevoked")); setGuardianToRemove(null); }}
      />
    </div>
  );
}
