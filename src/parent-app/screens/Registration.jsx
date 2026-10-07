import React, { useState } from "react";
import { formatUzPhone, isValidUzPhone } from "../../utils/phone.js";
import { ArrowLeft } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { Button } from "../components/common/UI.jsx";

export default function Registration({ onRegister, onBack }) {
  const { theme, t } = useApp();
  const c = theme.colors;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("Guardian");
  const [error, setError] = useState("");
  // Demo OTP: the code is generated here and shown on screen, since no SMS
  // provider exists. The flow (form -> code -> verified) is what a real
  // backend would keep; only where the code comes from would change.
  const [step, setStep] = useState("form"); // "form" | "otp"
  const [demoCode, setDemoCode] = useState("");
  const [codeEntry, setCodeEntry] = useState("");
  const [codeError, setCodeError] = useState("");

  const newCode = () => String(Math.floor(1000 + Math.random() * 9000));

  const handleContinue = () => {
    if (!name.trim()) { setError(t("errorNameRequired")); return; }
    const trimmed = phone.trim();
    if (!trimmed) { setError(t("errorPhoneRequired")); return; }
    if (!isValidUzPhone(trimmed)) { setError(t("errorPhoneInvalid")); return; }
    setError("");
    setDemoCode(newCode());
    setCodeEntry("");
    setCodeError("");
    setStep("otp");
  };

  const handleVerify = () => {
    if (codeEntry === demoCode) onRegister(phone.trim(), name.trim(), role);
    else setCodeError(t("wrongCode"));
  };

  const handleResend = () => {
    setDemoCode(newCode());
    setCodeEntry("");
    setCodeError("");
  };

  // One step back: from the code screen return to the form (keeping what
  // was typed); from the form, leave registration.
  const handleBack = () => (step === "otp" ? setStep("form") : onBack && onBack());

  const handlePhoneChange = (e) => {
    setPhone(formatUzPhone(e.target.value));
    if (error) setError("");
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px", position: "relative" }}>
      {(onBack || step === "otp") && (
        <button onClick={handleBack} aria-label={t("back")} style={{ position: "absolute", top: 18, left: 18, border: "none", background: "transparent", color: c.textSecondary, cursor: "pointer", padding: 4, display: "flex" }}>
          <ArrowLeft size={20} />
        </button>
      )}
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16, background: c.surfaceStrong, margin: "0 auto 16px",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: c.onAccent, fontWeight: 800,
        }}>
          P
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: c.textPrimary }}>{step === "otp" ? t("otpTitle") : t("registerTitle")}</div>
        {step === "form" && <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 6 }}>{t("registerSubtitle")}</div>}
      </div>
      {step === "otp" ? (
        <>
          <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 6, lineHeight: 1.6, textAlign: "center" }}>{t("codeSentTo", { phone })}</div>
          <div style={{ fontSize: 11.5, color: c.accent, marginBottom: 16, lineHeight: 1.5, textAlign: "center" }}>{t("demoCodeNote", { code: demoCode })}</div>
          <input
            value={codeEntry}
            onChange={(e) => { setCodeEntry(e.target.value.replace(/\D/g, "").slice(0, 4)); setCodeError(""); }}
            onKeyDown={(e) => e.key === "Enter" && codeEntry.length === 4 && handleVerify()}
            inputMode="numeric" maxLength={4} placeholder="0000" autoFocus
            style={{ textAlign: "center", letterSpacing: 8, fontSize: 20, border: `1px solid ${codeError ? c.danger : c.border}`, borderRadius: 10, padding: 12, marginBottom: 8, background: c.surfaceAlt, color: c.textPrimary, outline: "none", boxSizing: "border-box" }}
          />
          {codeError && <div style={{ color: c.danger, fontSize: 12, marginBottom: 8, textAlign: "center" }}>{codeError}</div>}
          <Button onClick={handleVerify} disabled={codeEntry.length !== 4} style={{ width: "100%", marginTop: 6 }}>{t("verifyCode")}</Button>
          <button onClick={handleResend} style={{ border: "none", background: "transparent", color: c.textSecondary, fontSize: 12.5, marginTop: 14, cursor: "pointer", textDecoration: "underline" }}>{t("resendCode")}</button>
        </>
      ) : (
        <>
      <label style={{ fontSize: 11, color: c.textSecondary, marginBottom: 4 }}>{t("yourName")}</label>
      <input
        value={name}
        onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
        placeholder={t("yourNamePlaceholder")}
        style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, background: c.surfaceAlt, color: c.textPrimary, marginBottom: 14, outline: "none", boxSizing: "border-box" }}
      />
      <label style={{ fontSize: 11, color: c.textSecondary, marginBottom: 4 }}>{t("phoneNumber")}</label>
      <input
        value={phone}
        onChange={handlePhoneChange}
        inputMode="numeric"
        placeholder="+998 90 123 45 67"
        style={{ border: `1px solid ${error ? c.danger : c.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, background: c.surfaceAlt, color: c.textPrimary, marginBottom: 14, outline: "none", boxSizing: "border-box" }}
      />
      <label style={{ fontSize: 11, color: c.textSecondary, marginBottom: 6, display: "block" }}>{t("relationship")}</label>
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {["Mother", "Father", "Guardian"].map(r => (
          <button key={r} type="button" onClick={() => setRole(r)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", cursor: "pointer", background: role === r ? c.surfaceStrong : c.surfaceAlt, color: role === r ? c.onAccent : c.textPrimary, fontWeight: 700, fontSize: 12 }}>
            {t(`role${r}`)}
          </button>
        ))}
      </div>
      {error && <div style={{ fontSize: 11.5, color: c.danger, marginBottom: 14 }}>{error}</div>}
      <Button onClick={handleContinue} style={{ width: "100%" }}>{t("continueLabel")}</Button>
        </>
      )}
    </div>
  );
}
