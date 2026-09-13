import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ParentMessages() {
  const { t, theme, students, messageThreads, sendMessage } = useApp();
  const c = theme.colors;
  const [selectedId, setSelectedId] = useState(students[0]?.id || null);
  const [draft, setDraft] = useState("");

  const thread = messageThreads[selectedId] || [];

  const handleSend = () => {
    if (!draft.trim() || !selectedId) return;
    sendMessage(selectedId, draft.trim());
    setDraft("");
  };

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 18 }}>{t("parentMessages")}</div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {students.map(s => {
            const sThread = messageThreads[s.id] || [];
            const last = sThread[sThread.length - 1];
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                style={{
                  textAlign: "left", border: "none", cursor: "pointer", borderRadius: 10, padding: "10px 12px",
                  background: selectedId === s.id ? c.surfaceStrong : c.surface,
                  color: selectedId === s.id ? c.onAccent : c.textPrimary,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {last ? last.text : "—"}
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, minWidth: 260, background: c.surface, borderRadius: 14, padding: 16, display: "flex", flexDirection: "column" }}>
          {thread.length === 0 ? (
            <div style={{ fontSize: 13, color: c.textSecondary }}>{t("noMessageThreads")}</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
              {thread.map(m => (
                <div key={m.id} style={{ display: "flex", justifyContent: m.from === "center" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "75%", background: m.from === "center" ? c.surfaceStrong : c.surfaceAlt, color: m.from === "center" ? c.onAccent : c.textPrimary, borderRadius: 12, padding: "9px 12px" }}>
                    <div style={{ fontSize: 13 }}>{m.text}</div>
                    <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>{formatTime(m.time)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
            <input
              value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={t("replyPlaceholder")}
              style={{ flex: 1, border: `1px solid ${c.border}`, borderRadius: 20, padding: "10px 14px", fontSize: 13, background: c.surfaceAlt, color: c.textPrimary, outline: "none" }}
            />
            <button onClick={handleSend} style={{ border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 20, padding: "0 18px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
              {t("send")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
