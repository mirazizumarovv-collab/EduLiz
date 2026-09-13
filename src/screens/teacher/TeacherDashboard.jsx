import React from "react";
import { CalendarCheck, GraduationCap, BookOpen } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";

export default function TeacherDashboard({ onNavigate }) {
  const { t, theme, currentTeacher, myGroups } = useApp();
  const c = theme.colors;

  const quickActions = [
    { key: "attendance", Icon: CalendarCheck, label: t("markAttendance") },
    { key: "grades", Icon: GraduationCap, label: t("enterGrades") },
    { key: "homework", Icon: BookOpen, label: t("assignHomework") },
  ];

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, marginBottom: 20 }}>
        {t("teacherGreeting", { name: currentTeacher?.name || "" })}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>{t("quickActions")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 26 }}>
        {quickActions.map(a => (
          <button
            key={a.key}
            onClick={() => onNavigate(a.key)}
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 10, border: "none", background: c.surface, borderRadius: 14, padding: 16, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ width: 38, height: 38, borderRadius: 10, background: c.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", color: c.accent }}>
              <a.Icon size={19} />
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: c.textPrimary }}>{a.label}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>{t("myGroups")}</div>
      {myGroups.length === 0 ? (
        <div style={{ fontSize: 13, color: c.textSecondary }}>{t("noClassesToday")}</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {myGroups.map(g => (
            <button
              key={g.id}
              onClick={() => onNavigate("groups")}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", textAlign: "left", border: "none", background: c.surface, borderRadius: 12, padding: "14px 16px", cursor: "pointer" }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{g.name}</div>
                <div style={{ fontSize: 11.5, color: c.textSecondary, marginTop: 2 }}>{g.schedule}</div>
              </div>
              <div style={{ fontSize: 12, color: c.accent, fontWeight: 700 }}>{t("studentsCount", { count: g.studentIds.length })}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
