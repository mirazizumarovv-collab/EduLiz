import React, { useState } from "react";
import { useApp } from "../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { messageService } from "../services/index.js";
import { LoadingSkeleton, ErrorState, EmptyState } from "../components/common/Feedback.jsx";
import { formatTime, formatShortDate } from "../utils/formatters.js";
import { CENTER_REPLY_TIME_HOURS } from "../constants/config.js";
import { CURRENT_DATE_STR, CURRENT_TIME_STR } from "../constants/months.js";

function isSameDay(isoA, isoB) {
  return isoA.slice(0, 10) === isoB.slice(0, 10);
}
function dayLabel(iso, lang, t) {
  if (isSameDay(iso, CURRENT_DATE_STR)) return t("today").toUpperCase();
  const yesterday = new Date(CURRENT_DATE_STR);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(iso, yesterday.toISOString())) return t("yesterday").toUpperCase();
  return formatShortDate(iso, lang).toUpperCase();
}

export default function Chat() {
  const { t, theme, lang } = useApp();
  const c = theme.colors;
  const { data, loading, error, reload } = useAsyncData(() => messageService.getThread(), []);
  const [messages, setMessages] = useState(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const list = messages || data || [];

  if (loading && !messages) return <div style={{ padding: 18 }}><LoadingSkeleton rows={4} /></div>;
  if (error) return <ErrorState t={t} message={t("failedToLoad")} onRetry={reload} />;

  const send = async () => {
    if (!draft.trim() || sending) return;
    const text = draft.trim();
    setDraft("");
    setSending(true);
    const queued = { id: `pending-${Date.now()}`, from: "parent", text, time: `${CURRENT_DATE_STR}T${CURRENT_TIME_STR}:00`, status: "sending" };
    setMessages([...list, queued]);
    const result = await messageService.send(text);
    setMessages(prev => prev.map(m => (m.id === queued.id ? result : m)));
    setSending(false);
  };

  // Build a render list: a date-separator pill whenever the day changes, and
  // a "showTime" flag only on the last message of a consecutive same-sender run.
  const renderItems = [];
  let lastDayKey = null;
  list.forEach((m, i) => {
    const dayKey = m.time.slice(0, 10);
    if (dayKey !== lastDayKey) {
      renderItems.push({ type: "separator", label: dayLabel(m.time, lang, t) });
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

      <div style={{ padding: "0 16px", minHeight: "50vh" }}>
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

      <div style={{ position: "sticky", bottom: 0, display: "flex", gap: 8, padding: "10px 16px calc(14px + env(safe-area-inset-bottom))", background: c.surface, borderTop: `1px solid ${c.border}` }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={t("chatPlaceholder")}
          style={{ flex: 1, border: `1px solid ${c.border}`, borderRadius: 20, padding: "11px 14px", fontSize: 13, background: c.surfaceAlt, color: c.textPrimary, outline: "none" }}
        />
        <button onClick={send} disabled={sending} style={{ border: "none", background: c.surfaceStrong, color: c.onAccent, borderRadius: 20, padding: "0 18px", fontWeight: 700, fontSize: 12.5, cursor: sending ? "default" : "pointer", opacity: sending ? 0.6 : 1 }}>
          {t("send")}
        </button>
      </div>
    </div>
  );
}
