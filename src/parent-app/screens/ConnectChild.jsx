import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { Button } from "../components/common/UI.jsx";

export default function ConnectChild({ onNavigate, onBack }) {
  const { t, theme, connectChild, showToast } = useApp();
  const c = theme.colors;
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fieldStyle = { width: "100%", border: `1px solid ${c.border}`, borderRadius: 10, padding: "12px 14px", fontSize: 14, background: c.surfaceAlt, color: c.textPrimary, marginBottom: 12, outline: "none", boxSizing: "border-box" };

  const submit = async () => {
    if (!invitationCode.trim()) { setError(t("connectError")); return; }
    setSubmitting(true);
    setError("");
    // Small delay so the loading state is visible — connectChild itself is
    // a real, synchronous lookup against actual students, not a fake network call.
    await new Promise(r => setTimeout(r, 400));
    const student = connectChild(invitationCode.trim());
    if (!student) {
      setError(t("connectError"));
      setSubmitting(false);
      return;
    }
    showToast(t("connectSuccess"));
    onNavigate("dashboard");
    setSubmitting(false);
  };

  return (
    <div style={{ padding: "18px 16px 8px", position: "relative" }}>
      {onBack && (
        <button onClick={onBack} aria-label={t("back")} style={{ border: "none", background: "transparent", color: c.textSecondary, cursor: "pointer", padding: 4, display: "flex", marginBottom: 10 }}>
          <ArrowLeft size={20} />
        </button>
      )}
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6, color: c.textPrimary }}>{t("connectChildTitle")}</div>
      <div style={{ fontSize: 12.5, color: c.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>{t("connectChildDesc")}</div>

      <label style={{ fontSize: 11.5, color: c.textSecondary, marginBottom: 4, display: "block" }}>{t("invitationCode")}</label>
      <input value={invitationCode} onChange={(e) => { setInvitationCode(e.target.value); if (error) setError(""); }} style={fieldStyle} placeholder="REG-4821" />

      {error && <div style={{ color: c.danger, fontSize: 12, marginBottom: 12 }}>{error}</div>}

      <Button onClick={submit} disabled={submitting} style={{ width: "100%" }}>{t("connect")}</Button>
    </div>
  );
}
