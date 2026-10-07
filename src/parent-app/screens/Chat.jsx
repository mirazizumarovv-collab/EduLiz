import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { EmptyState } from "../components/common/Feedback.jsx";
import { formatTime, formatShortDate } from "../utils/formatters.js";
import { CENTER_REPLY_TIME_HOURS } from "../constants/config.js";
import { addDaysISO } from "../../utils/clock.js";

function isSameDay(isoA, isoB) {
  return isoA.slice(0, 10) === isoB.slice(0, 10);
}
function dayLabel(iso, lang, t, today) {
  if (isSameDay(iso, today)) return t("today").toUpperCase();
  if (isSameDay(iso, addDaysISO(today, -1))) return t("yesterday").toUpperCase();
  return formatShortDate(iso, lang).toUpperCase();
}

export default function Chat() {
  const { t, theme, lang, selectedStudent, messageThreads, sendMessage, today } = useApp();
  const c = theme.colors;
  const [draft, setDraft] = useState("");

  // Reads directly from shared context state — the SAME array Operator's
  // Messages screen reads and writes — so this re-renders immediately
  // whenever a new message arrives, with the chat screen already open, not
  // just after a remount or reload.
  const list = messageThreads[selectedStudent?.id] || [];

  const send = () => {
    if (!draft.trim() || !selectedStudent) return;
    sendMessage(selectedStudent.id, draft.trim(), "parent");
    setDraft("");
  };

  // Build a render list: a date-separator pill whenever the day changes, and
  // a "showTime" flag only on the last message of a consecutive same-sender run.
  const renderItems = [];
  let lastDayKey = null;
  list.forEach((m, i) => {
    const dayKey = m.time.slice(0, 10);
    if (dayKey !== lastDayKey) {
      renderItems.push({ type: "separator", label: dayLabel(m.time, lang, t, today) });
      lastDayKey = dayKey;
    }
    const next = list[i + 1];
    const showTime = !next || next.from !== m.from || next.time.slice(0, 10) !== dayKey;
    renderItems.push({ type: "message", data: m, showTime });
  });

  return (
    <div>
      <div style={{ padding: "18px 16px 8px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 2, color: c.textPrimary }}>{t("navChat")}</div>
        <div style={{ fontSize: 12, color: c.textSecondary }}>{t("chatSubtitle")}</div>
        <div style={{ fontSize: 10.5, color: c.textSecondary, marginTop: 4 }}>{t("replyTimeNote", { hours: CENTER_REPLY_TIME_HOURS })}</div>
      </div>

      {/* Bottom padding reserves room for the fixed input bar below, so the
          last message is never hidden behind it. */}
      <div style={{ padding: "0 16px 76px" }}>
        {list.length === 0 ? (
          <EmptyState icon="💬" title={t("noMessages")} />
        ) : renderItems.map((item, i) => {
          if (item.type === "separator") {
            return (
              <div key={`sep-${i}`} style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: c.textSecondary, background: c.surfaceAlt, padding: "4px 12px", borderRadius: 20, letterSpacing: 0.5 }}>
                  {item.label}
                </span>
              </div>
            );
          }
          const m = item.data;
          return (
            <div key={m.id} style={{ display: "flex", justifyContent: m.from === "parent" ? "flex-end" : "flex-start", marginBottom: item.showTime ? 8 : 3 }}>
              <div style={{ maxWidth: "78%", padding: "9px 12px", borderRadius: 12, background: m.from === "parent" ? c.surfaceStrong : c.surfaceAlt, color: m.from === "parent" ? c.onAccent : c.textPrimary }}>
                <div style={{ fontSize: 13 }}>{m.textKey ? t(m.textKey, m.vars) : m.text}</div>
                {item.showTime && (
                  <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>
                    {formatTime(m.time, lang)}
                    {m.status === "sending" && ` · ${t("loading")}`}
                    {m.status === "queued" && ` · ${t("messageQueued")}`}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fixed (not sticky) — sticky only pins while scrolling PAST the
          element, so it does nothing when the message list is shorter than
          the viewport. Fixed always pins, regardless of content length.
          Positioned above the bottom nav (76px) and matched to AppShell's
          own centered max-480px container so it aligns correctly on wider
          screens instead of spanning the full browser width. */}
      <div style={{
        position: "fixed", bottom: "calc(76px + env(safe-area-inset-bottom))", left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480, boxSizing: "border-box",
        display: "flex", gap: 8, padding: "10px 16px", background: c.surface, borderTop: `1px solid ${c.border}`, zIndex: 15,
      }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("chatPlaceholder")}
          style={{ flex: 1, border: `1px solid ${c.border}`, borderRadius: 20, padding: "11px 14px", fontSize: 13, background: c.surfaceAlt, color: c.textPrimary, outline: "none" }}
        />
        <button onClick={send} style={{ border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 20, padding: "0 18px", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
          {t("send")}
        </button>
      </div>
    </div>
  );
}
