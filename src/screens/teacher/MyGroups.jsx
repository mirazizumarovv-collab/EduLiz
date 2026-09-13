import React from "react";
import { useApp } from "../../context/AppContext.jsx";

export default function MyGroups() {
  const { t, theme, myGroups, students } = useApp();
  const c = theme.colors;
  const getStudent = (id) => students.find(s => s.id === id) || null;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 18 }}>{t("myGroups")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {myGroups.map(g => (
          <div key={g.id} style={{ background: c.surface, borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>{g.name}</div>
            <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 2, marginBottom: 12 }}>{g.subject} · {g.schedule}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {g.studentIds.map(sid => {
                const s = getStudent(sid);
                if (!s) return null;
                return (
                  <div key={sid} style={{ display: "flex", justifyContent: "space-between", background: c.surfaceAlt, borderRadius: 8, padding: "8px 12px" }}>
                    <span style={{ fontSize: 13, color: c.textPrimary }}>{s.name}</span>
                    <span style={{ fontSize: 11.5, color: c.textSecondary }}>{s.grade}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
