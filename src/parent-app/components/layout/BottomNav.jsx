import React from "react";
import { MoreHorizontal } from "lucide-react";
import { useApp, NAV_POOL } from "../../../context/AppContext.jsx";
import { font } from "../../constants/theme.js";

export function BottomNav({ active, onSelect }) {
  const { theme, t, navItems } = useApp();
  const c = theme.colors;
  const items = [...navItems.map(id => ({ id, ...NAV_POOL[id] })), { id: "more", Icon: MoreHorizontal, key: "navMore" }];
  const visibleIds = new Set(navItems);

  return (
    <div style={{ display: "flex", borderTop: `1px solid ${c.border}`, background: theme.colors.surface, overflowX: "auto" }}>
      {items.map(item => {
        const isActive = active === item.id || (item.id === "more" && !visibleIds.has(active) && active !== "more");
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            style={{
              flex: items.length <= 6 ? 1 : "0 0 68px", minWidth: 60, border: "none", outline: "none", background: "transparent", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 2, padding: "10px 2px", minHeight: 56, WebkitTapHighlightColor: "transparent",
              color: isActive ? c.accent : c.textSecondary, fontFamily: font.family,
            }}
          >
            <item.Icon size={18} />
            <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500, whiteSpace: "nowrap" }}>{t(item.key)}</span>
          </button>
        );
      })}
    </div>
  );
}
