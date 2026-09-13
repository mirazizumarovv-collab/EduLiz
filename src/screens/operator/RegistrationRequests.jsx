import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function RegistrationRequests() {
  const { t, theme, requests, groups, approveRequest, rejectRequest } = useApp();
  const c = theme.colors;
  const [groupChoice, setGroupChoice] = useState({});

  const pending = requests.filter(r => r.status === "pending");
  const resolved = requests.filter(r => r.status !== "pending");

  const handleApprove = (reqId) => {
    const groupId = groupChoice[reqId] || groups[0]?.id;
    if (!groupId) return;
    approveRequest(reqId, groupId);
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 18 }}>{t("registrationRequests")}</div>

      {pending.length === 0 ? (
        <div style={{ fontSize: 13, color: c.textSecondary, marginBottom: 24 }}>{t("noRequests")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {pending.map(r => (
            <div key={r.id} style={{ background: c.surface, borderRadius: 14, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{r.childName} · {r.grade}</div>
                <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>{r.parentName} · {r.parentPhone}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={groupChoice[r.id] || groups[0]?.id || ""}
                  onChange={(e) => setGroupChoice(prev => ({ ...prev, [r.id]: e.target.value }))}
                  style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: "8px 10px", background: c.surfaceAlt, color: c.textPrimary, fontSize: 12.5 }}
                >
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button onClick={() => handleApprove(r.id)} style={{ border: "none", background: c.good, color: c.onAccent, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  {t("approve")}
                </button>
                <button onClick={() => rejectRequest(r.id)} style={{ border: "none", background: c.surfaceAlt, color: c.danger, borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                  {t("reject")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {resolved.map(r => (
            <div key={r.id} style={{ fontSize: 12.5, color: c.textSecondary, background: c.surfaceAlt, borderRadius: 8, padding: "8px 12px" }}>
              {r.childName} — {r.status === "approved" ? t("requestApproved") : t("requestRejected")}
              {r.status === "approved" && r.connectionCode && <span style={{ fontWeight: 700, color: c.accent }}> · {r.connectionCode}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
