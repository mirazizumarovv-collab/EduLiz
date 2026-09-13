import { bridge } from "./liveBridge.js";
import { CURRENT_DATE_STR } from "../constants/months.js";

const STATUS_MAP = { paid: "paid", pending: "due", overdue: "overdue" };
const FLAT_MONTHLY_FEE = 450000;

// A fixed "10th of next month" convention, since the unified system doesn't
// yet track a real per-student billing deadline — stated here rather than
// left as null (which would render as a misleading 1970 date).
function nextTenth() {
  const d = new Date(CURRENT_DATE_STR);
  d.setMonth(d.getMonth() + 1, 10);
  return d.toISOString().slice(0, 10);
}

// The unified system currently tracks only a simple paid/pending/overdue
// flag per student (set by Admin) — not a full ledger of past payments or
// per-student fee breakdowns. This adapter is honest about that: no
// invented payment history, just a real status and a stated fee convention.
export function getPayments(studentId) {
  const status = bridge.paymentsStatus[studentId] || "pending";
  return {
    status: STATUS_MAP[status] || "due",
    amountDue: status === "paid" ? 0 : FLAT_MONTHLY_FEE,
    currency: "so'm",
    deadline: nextTenth(),
    feeBreakdown: status === "paid" ? [] : [{ label: "tuition", amount: FLAT_MONTHLY_FEE }],
    history: [],
  };
}
