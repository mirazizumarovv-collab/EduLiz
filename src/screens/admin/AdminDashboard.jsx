import React from "react";
import { Users, Layers, GraduationCap, Wallet, AlertTriangle } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";

export default function AdminDashboard() {
  const { t, theme, students, groups, teachers, paymentsStatus } = useApp();
  const c = theme.colors;

  const overdueCount = Object.values(paymentsStatus).filter(s => s === "overdue").length;
  const expectedRevenue = students.length * 450000; // demo: flat monthly fee assumption

  const stats = [
    { Icon: Users, label: t("totalStudents"), value: students.length, color: c.accent },
    { Icon: Layers, label: t("totalGroups"), value: groups.length, color: c.accent },
    { Icon: GraduationCap, label: t("totalTeachers"), value: teachers.length, color: c.accent },
    { Icon: Wallet, label: t("monthlyRevenue"), value: `${(expectedRevenue / 1000000).toFixed(1)}M so'm`, color: c.good },
    { Icon: AlertTriangle, label: t("overduePayments"), value: overdueCount, color: overdueCount > 0 ? c.bad : c.good },
  ];

  return (
    <div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c.textPrimary, marginBottom: 20 }}>{t("adminGreeting", { name: "Admin" })}</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: c.textPrimary, marginBottom: 10 }}>{t("centerOverview")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: c.surface, borderRadius: 14, padding: 16 }}>
            <div style={{ color: s.color, marginBottom: 8 }}><s.Icon size={20} /></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary }}>{s.value}</div>
            <div style={{ fontSize: 11.5, color: c.textSecondary, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
