import React from "react";
import { Bell } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { font } from "../../constants/theme.js";

function Avatar({ student }) {
  const initial = student.name.charAt(0).toUpperCase();
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "50%", background: student.avatarColor || "#3A6EA5",
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 800, fontSize: 14, flexShrink: 0, fontFamily: font.family,
    }}>
      {initial}
    </div>
  );
}

export function Header({ onOpenNotifications, hasUnreadNotifications, onOpenSwitcher }) {
  const { theme, selectedStudent, t } = useApp();
  const c = theme.colors;

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: `1px solid ${c.border}` }}>
      <button onClick={onOpenSwitcher} style={{ display: "flex", alignItems: "center", gap: 8, border: "none", background: "transparent", cursor: "pointer", padding: 4, minWidth: 0 }}>
        <Avatar student={selectedStudent} />
        <div style={{ textAlign: "left", minWidth: 0 }}>
          <div style={{ fontSize: font.size.sm, fontWeight: 700, color: c.textPrimary, fontFamily: font.family, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selectedStudent.name}
          </div>
          <div style={{ fontSize: 10.5, color: c.textSecondary, fontFamily: font.family }}>{selectedStudent.grade}</div>
        </div>
        <span style={{ fontSize: 10, color: c.textSecondary }}>▾</span>
      </button>

      <button onClick={onOpenNotifications} aria-label="notifications" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 6, position: "relative", color: c.textPrimary, display: "flex" }}>
        <Bell size={19} />
        {hasUnreadNotifications && <span style={{ position: "absolute", top: 4, right: 4, width: 8, height: 8, borderRadius: "50%", background: c.danger }} />}
      </button>
    </div>
  );
}
