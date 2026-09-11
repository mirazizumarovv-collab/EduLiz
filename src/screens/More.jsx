import React from "react";
import { User } from "lucide-react";
import { useApp, NAV_POOL } from "../context/AppContext.jsx";
import { Row, Section } from "../components/common/UI.jsx";
import { EmptyState } from "../components/common/Feedback.jsx";

const NAV_GROUPS = [
  { titleKey: "groupProgress", ids: ["grades", "insights"] },
  { titleKey: "groupActivity", ids: ["attendance", "homework"] },
  { titleKey: "groupCommunication", ids: ["chat", "notifications"] },
  { titleKey: "groupAccount", ids: ["payments", "settings"] },
];

export default function More({ onNavigate }) {
  const { t, navItems, theme } = useApp();
  const c = theme.colors;
  const hiddenIds = new Set(Object.keys(NAV_POOL).filter(id => id !== "dashboard" && !navItems.includes(id)));
  const anyHidden = hiddenIds.size > 0;

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16, color: c.textPrimary }}>{t("navMore")}</div>
      {!anyHidden ? (
        <EmptyState icon="✅" title={t("allPinned")} />
      ) : (
        NAV_GROUPS.map(group => {
          const idsInGroup = group.ids.filter(id => hiddenIds.has(id));
          if (idsInGroup.length === 0) return null;
          return (
            <Section key={group.titleKey} title={t(group.titleKey)}>
              {idsInGroup.map(id => {
                const Icon = NAV_POOL[id].Icon;
                return (
                  <Row key={id} label={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><Icon size={15} /> {t(NAV_POOL[id].key)}</span>} onClick={() => onNavigate(id)} />
                );
              })}
            </Section>
          );
        })
      )}
      <Section title={t("groupAccount")}>
        <Row label={<span style={{ display: "flex", alignItems: "center", gap: 8 }}><User size={15} /> {t("navProfile")}</span>} onClick={() => onNavigate("profile")} />
      </Section>
    </div>
  );
}
