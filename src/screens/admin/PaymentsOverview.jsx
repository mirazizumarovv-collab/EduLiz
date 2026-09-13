import React from "react";
import { useApp } from "../../context/AppContext.jsx";

const STATUS_COLOR = { paid: "good", pending: "medium", overdue: "bad" };

export default function PaymentsOverview() {
  const { t, theme, students, paymentsStatus, setPaymentStatus } = useApp();
  const c = theme.colors;

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 18 }}>{t("paymentsOverview")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {students.map(s => {
          const status = paymentsStatus[s.id] || "pending";
          return (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: c.surface, borderRadius: 12, padding: "12px 16px", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{s.name}</div>
                <div style={{ fontSize: 11.5, color: c.textSecondary }}>{s.guardianName} · {s.guardianPhone}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: c[STATUS_COLOR[status]], background: `${c[STATUS_COLOR[status]]}22`, borderRadius: 20, padding: "5px 12px" }}>
                  {t(status)}
                </span>
                {status !== "paid" && (
                  <button onClick={() => setPaymentStatus(s.id, "paid")} style={{ border: "none", background: c.surfaceAlt, color: c.accent, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {t("markAsPaid")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
