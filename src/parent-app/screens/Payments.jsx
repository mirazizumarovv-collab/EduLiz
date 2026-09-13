import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { useAsyncData } from "../hooks/useAsyncData.js";
import { paymentService } from "../services/index.js";
import { Section, Row, Button } from "../components/common/UI.jsx";
import { LoadingSkeleton, ErrorState, EmptyState } from "../components/common/Feedback.jsx";
import { formatCurrency, formatDate } from "../utils/formatters.js";

const STATUS_KEY = { paid: "paymentStatusPaid", due: "paymentStatusDue", overdue: "paymentStatusOverdue" };
const FEE_KEY = { tuition: "tuition", materials: "materials" };

export default function Payments() {
  const { t, selectedStudent, theme, lang, showToast } = useApp();
  const c = theme.colors;
  const [showComingSoon, setShowComingSoon] = useState(false);

  const { data, loading, error, reload } = useAsyncData(() => paymentService.get(selectedStudent.id), [selectedStudent.id]);

  if (loading) return <div style={{ padding: 18 }}><LoadingSkeleton rows={4} /></div>;
  if (error) return <ErrorState t={t} message={t("failedToLoad")} onRetry={reload} />;

  const statusColor = data.status === "overdue" ? c.danger : data.status === "due" ? c.warning : c.accent;

  return (
    <div style={{ padding: "18px 16px 8px" }}>
      <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 14, color: c.textPrimary }}>{t("paymentsTitle")}</div>

      <div style={{ background: c.surfaceStrong, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <div style={{ color: c.onAccent, opacity: 0.8, fontSize: 11 }}>{t(STATUS_KEY[data.status])}</div>
        {data.status !== "paid" && (
          <>
            <div style={{ color: c.onAccent, fontSize: 20, fontWeight: 800, marginTop: 4 }}>{formatCurrency(data.amountDue, data.currency, lang)}</div>
            <div style={{ color: c.onAccent, opacity: 0.85, fontSize: 12, marginTop: 4 }}>{t("deadline")}: {formatDate(data.deadline, lang)}</div>
          </>
        )}
        {data.status === "paid" && (
          <div style={{ color: c.onAccent, fontSize: 15, fontWeight: 700, marginTop: 4 }}>{t("nextPayment")}: {formatDate(data.deadline, lang)}</div>
        )}
        {data.status !== "paid" && (
          <Button
            onClick={() => { setShowComingSoon(true); showToast(t("paymentComingSoon")); }}
            style={{ marginTop: 12, background: c.onAccent, color: c.surfaceStrong, width: "100%" }}
          >
            {t("payNow")}
          </Button>
        )}
      </div>

      <Section title={t("feeBreakdown")}>
        {data.feeBreakdown.map((f, i) => <Row key={i} label={t(FEE_KEY[f.label] || f.label)} value={formatCurrency(f.amount, data.currency, lang)} />)}
      </Section>

      <Section title={t("paymentHistory")}>
        {data.history.length === 0 ? (
          <EmptyState icon="💳" title={t("noPaymentHistory")} />
        ) : data.history.map((h, i) => (
          <Row key={i} label={h.month} value={formatCurrency(h.amount, data.currency, lang)} sub={formatDate(h.paidOn, lang)} />
        ))}
      </Section>
    </div>
  );
}
