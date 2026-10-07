import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useApp } from "../../context/AppContext.jsx";
import { FLAT_MONTHLY_FEE } from "../../utils/fees.js";

const STATUS_COLOR = { paid: "good", pending: "medium", overdue: "bad" };
const METHODS = ["cash", "card", "transfer"];

export default function PaymentsOverview() {
  const { t, theme, students, paymentsStatus, paymentTransactions, recordPayment, setPaymentStatus, showToast } = useApp();
  const markPaid = (studentId) => {
    const r = recordPayment(studentId, FLAT_MONTHLY_FEE, methodChoice[studentId] || "cash");
    if (!r.ok) showToast(r.reason === "alreadyPaid" ? t("errorPaymentAlreadyPaid") : t("errorPaymentInvalid"));
  };
  const c = theme.colors;
  const [methodChoice, setMethodChoice] = useState({});
  const [historyOpenId, setHistoryOpenId] = useState(null);

  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: c.textPrimary, marginBottom: 18 }}>{t("paymentsOverview")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {students.map(s => {
          const status = paymentsStatus[s.id] || "pending";
          const history = (paymentTransactions[s.id] || []).slice().reverse();
          return (
            <div key={s.id} style={{ background: c.surface, borderRadius: 12, padding: "12px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: c.textPrimary }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: c.textSecondary }}>{s.guardians?.[0]?.name} · {s.guardians?.[0]?.phone}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c[STATUS_COLOR[status]], background: `${c[STATUS_COLOR[status]]}22`, borderRadius: 20, padding: "5px 12px" }}>
                    {t(status)}
                  </span>
                  {status !== "paid" ? (
                    <>
                      <select
                        value={methodChoice[s.id] || "cash"}
                        onChange={(e) => setMethodChoice(prev => ({ ...prev, [s.id]: e.target.value }))}
                        style={{ border: `1px solid ${c.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 11.5, background: c.surfaceAlt, color: c.textPrimary }}
                      >
                        {METHODS.map(m => <option key={m} value={m}>{t(`paymentMethod_${m}`)}</option>)}
                      </select>
                      <button
                        onClick={() => markPaid(s.id)}
                        style={{ border: "none", background: c.surfaceAlt, color: c.accent, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        {t("markAsPaid")}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setPaymentStatus(s.id, "pending")}
                      style={{ border: "none", background: c.surfaceAlt, color: c.textSecondary, borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      {t("startNewBillingMonth")}
                    </button>
                  )}
                  {history.length > 0 && (
                    <button
                      onClick={() => setHistoryOpenId(historyOpenId === s.id ? null : s.id)}
                      style={{ display: "flex", alignItems: "center", gap: 3, border: "none", background: "transparent", color: c.textSecondary, fontSize: 11.5, cursor: "pointer" }}
                    >
                      {t("paymentHistory")} {historyOpenId === s.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                </div>
              </div>
              {historyOpenId === s.id && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                  {history.map(tx => (
                    <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: c.textSecondary, background: c.surfaceAlt, borderRadius: 6, padding: "6px 10px" }}>
                      <span>{tx.date} · {t(`paymentMethod_${tx.method}`)}</span>
                      <span style={{ fontWeight: 700, color: c.textPrimary }}>{tx.amount.toLocaleString()} so'm</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
