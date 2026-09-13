import React from "react";
import { MessageCircle, UserPlus } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";

export default function OperatorDashboard({ onNavigate }) {
  const { t, theme, messageThreads, requests } = useApp();
  const c = theme.colors;

  const unreadCount = Object.values(messageThreads).reduce((sum, thread) => sum + thread.filter(m => m.from === "parent").length, 0);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  const cards = [
    { key: "messages", Icon: MessageCircle, label: t("unreadMessages"), value: unreadCount },
    { key: "requests", Icon: UserPlus, label: t("pendingRequests"), value: pendingCount },
  ];

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, marginBottom: 20 }}>{t("operatorGreeting", { name: "Operator" })}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {cards.map(card => (
          <button key={card.key} onClick={() => onNavigate(card.key)} style={{ textAlign: "left", border: "none", background: c.surface, borderRadius: 14, padding: 18, cursor: "pointer" }}>
            <div style={{ color: c.accent, marginBottom: 10 }}><card.Icon size={22} /></div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.textPrimary }}>{card.value}</div>
            <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>{card.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
