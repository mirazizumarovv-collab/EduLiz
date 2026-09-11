import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { Button } from "../components/common/UI.jsx";

export default function Registration({ onRegister }) {
  const { theme, t } = useApp();
  const c = theme.colors;
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const handleContinue = () => {
    const trimmed = phone.trim();
    if (!trimmed) { setError(t("errorPhoneRequired")); return; }
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length < 9) { setError(t("errorPhoneInvalid")); return; }
    setError("");
    onRegister(trimmed);
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 28px" }}>
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <div style={{
          width: 60, height: 60, borderRadius: 16, background: c.surfaceStrong, margin: "0 auto 16px",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: c.onAccent, fontWeight: 800,
        }}>
          P
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: c.textPrimary }}>{t("registerTitle")}</div>
        <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 6 }}>{t("registerSubtitle")}</div>
      </div>
      <label style={{ fontSize: 11, color: c.textSecondary, marginBottom: 4 }}>{t("phoneNumber")}</label>
      <input
        value={phone}
        onChange={(e) => { setPhone(e.target.value); if (error) setError(""); }}
        placeholder="+998 90 123 45 67"
        style={{ border: `1px solid ${error ? c.danger : c.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, background: c.surfaceAlt, color: c.textPrimary, marginBottom: error ? 6 : 18, outline: "none", boxSizing: "border-box" }}
      />
      {error && <div style={{ fontSize: 11.5, color: c.danger, marginBottom: 14 }}>{error}</div>}
      <Button onClick={handleContinue} style={{ width: "100%" }}>{t("continueLabel")}</Button>
    </div>
  );
}
