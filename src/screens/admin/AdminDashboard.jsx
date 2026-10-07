import React from "react";
import { Users, Layers, GraduationCap, Wallet, AlertTriangle } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { FLAT_MONTHLY_FEE } from "../../utils/fees.js";

export default function AdminDashboard() {
  const { t, theme, students, groups, teachers, paymentsStatus, paymentTransactions, today } = useApp();
  const c = theme.colors;

  const overdueCount = Object.values(paymentsStatus).filter(s => s === "overdue").length;
  // What the center should take in a month if every student pays the flat fee —
  // an expectation, not money received — next to what the recorded payments
  // actually add up to for the current calendar month.
  const expectedRevenue = students.length * FLAT_MONTHLY_FEE;
  const collectedThisMonth = students
    .flatMap(s => paymentTransactions[s.id] || [])
    .filter(tx => String(tx.date).startsWith(today.slice(0, 7)))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const som = (n) => `${n.toLocaleString()} so'm`;

  const stats = [
    { Icon: Users, label: t("totalStudents"), value: students.length, color: c.accent },
    { Icon: Layers, label: t("totalGroups"), value: groups.length, color: c.accent },
    { Icon: GraduationCap, label: t("totalTeachers"), value: teachers.length, color: c.accent },
    { Icon: Wallet, label: t("monthlyRevenue"), value: som(expectedRevenue), color: c.accent },
    { Icon: Wallet, label: t("collectedThisMonth"), value: som(collectedThisMonth), color: c.good },
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
