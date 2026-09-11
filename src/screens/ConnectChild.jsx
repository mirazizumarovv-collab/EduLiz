import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { Button } from "../components/common/UI.jsx";
import { studentService } from "../services/index.js";

export default function ConnectChild({ onNavigate }) {
  const { t, theme, addStudent, showToast } = useApp();
  const c = theme.colors;
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fieldStyle = { width: "100%", border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, background: c.surfaceAlt, color: c.textPrimary, marginBottom: 12, outline: "none", boxSizing: "border-box" };

  const submit = async () => {
    if (!invitationCode.trim()) { setError(t("connectError")); return; }
    setSubmitting(true);
    setError("");
    try {
      const student = await studentService.connect({ invitationCode });
      addStudent(student);
      showToast(t("connectSuccess"));
      onNavigate("dashboard");
    } catch {
      setError(t("connectError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: c.textPrimary }}>{t("connectChildTitle")}</div>
      <div style={{ fontSize: 12.5, color: c.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>{t("connectChildDesc")}</div>

      <label style={{ fontSize: 11.5, color: c.textSecondary, marginBottom: 4, display: "block" }}>{t("invitationCode")}</label>
      <input value={invitationCode} onChange={(e) => { setInvitationCode(e.target.value); if (error) setError(""); }} style={fieldStyle} placeholder="REG-4821" />

      {error && <div style={{ color: c.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}

      <Button onClick={submit} disabled={submitting} style={{ width: "100%" }}>{t("connect")}</Button>
      <div style={{ fontSize: 10.5, color: c.textSecondary, marginTop: 14, textAlign: "center" }}>{t("tryCodeHint", { code: "REG-4821" })}</div>
    </div>
  );
}
