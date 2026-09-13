import React, { useState } from "react";
import { GraduationCap, Building2, Users, Headset } from "lucide-react";
import { useApp } from "../context/AppContext.jsx";

export default function RoleSelect() {
  const { t, theme, setRole, teachers, setCurrentTeacherId } = useApp();
  const c = theme.colors;
  const [pendingRole, setPendingRole] = useState(null);

  const roleCards = [
    { key: "parent", Icon: Users, label: t("roleParent"), desc: t("roleParentDesc") },
    { key: "teacher", Icon: GraduationCap, label: t("roleTeacher"), desc: t("roleTeacherDesc") },
    { key: "admin", Icon: Building2, label: t("roleAdmin"), desc: t("roleAdminDesc") },
    { key: "operator", Icon: Headset, label: t("roleOperator"), desc: t("roleOperatorDesc") },
  ];

  if (pendingRole === "teacher") {
    return (
      <div style={{ minHeight: "100dvh", background: theme.colors.background, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <div style={{ width: "100%", maxWidth: 380, background: c.surface, borderRadius: 16, padding: 24 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: c.textPrimary, marginBottom: 4 }}>{t("selectYourself")}</div>
          <div style={{ fontSize: 12.5, color: c.textSecondary, marginBottom: 18 }}>{t("roleTeacher")}</div>
          {teachers.map(item => (
            <button
              key={item.id}
              onClick={() => { setCurrentTeacherId(item.id); setRole("teacher"); }}
              style={{ width: "100%", textAlign: "left", border: "none", background: c.surfaceAlt, borderRadius: 10, padding: "13px 16px", marginBottom: 8, cursor: "pointer" }}
            >
              <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{item.name}</div>
              <div style={{ fontSize: 11.5, color: c.textSecondary, marginTop: 2 }}>{item.subjects.join(", ")}</div>
            </button>
          ))}
          {teachers.length === 0 && <div style={{ fontSize: 13, color: c.textSecondary }}>—</div>}
          <button onClick={() => setPendingRole(null)} style={{ border: "none", background: "transparent", color: c.textSecondary, fontSize: 12.5, marginTop: 8, cursor: "pointer" }}>
            ← {t("back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100dvh", background: theme.colors.background, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: c.surfaceStrong, margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: c.onAccent, fontWeight: 800 }}>
          R
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, color: c.textPrimary }}>{t("centerName")}</div>
        <div style={{ fontSize: 13, color: c.textSecondary, marginTop: 6 }}>{t("chooseRole")}</div>
      </div>
      <div style={{ width: "100%", maxWidth: 380, display: "flex", flexDirection: "column", gap: 10 }}>
        {roleCards.map(r => (
          <button
            key={r.key}
            onClick={() => (r.key === "teacher" ? setPendingRole(r.key) : setRole(r.key))}
            style={{
              display: "flex", alignItems: "center", gap: 14, width: "100%", textAlign: "left",
              border: "none", background: c.surface, borderRadius: 14, padding: "16px 18px", cursor: "pointer",
              boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}
          >
            <div style={{ width: 44, height: 44, borderRadius: 12, background: c.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", color: c.accent, flexShrink: 0 }}>
              <r.Icon size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: c.textPrimary }}>{r.label}</div>
              <div style={{ fontSize: 12, color: c.textSecondary, marginTop: 2 }}>{r.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
