import { bridge, bridgeToday } from "./liveBridge.js";
import { shiftYM } from "../../utils/clock.js";
import { FLAT_MONTHLY_FEE } from "../../utils/fees.js";

const STATUS_MAP = { paid: "paid", pending: "due", overdue: "overdue" };

// A fixed "payment due on the 10th of each month" convention, since the
// unified system doesn't yet track a real per-student billing deadline —
// stated here rather than left as null (which would render as a misleading
// 1970 date). Two different dates matter depending on status: a PENDING
// payment's deadline is the NEAREST upcoming 10th (which may be later this
// same month, not necessarily next month); an OVERDUE payment's deadline
// is the MOST RECENT 10th that has already passed — a date in the past,
// matching what "overdue" actually means, not a future one.
// (Worked out on the date text, never through a Date object, so the answer is
// the same in every time zone and across New Year.)
function nextUpcomingTenth(today) {
  const ym = today.slice(0, 7);
  return `${Number(today.slice(8, 10)) < 10 ? ym : shiftYM(ym, 1)}-10`;
}
function lastPassedTenth(today) {
  const ym = today.slice(0, 7);
  return `${Number(today.slice(8, 10)) >= 10 ? ym : shiftYM(ym, -1)}-10`;
}

const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// The unified system now tracks a real per-payment transaction ledger (set
// by Admin's "Mark as paid" with a method and date) — this reshapes those
// real transactions into the shape the Payments screen expects.
export function getPayments(studentId) {
  const status = bridge.paymentsStatus[studentId] || "pending";
  const transactions = bridge.paymentTransactions[studentId] || [];
  const history = transactions
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(tx => ({ month: MONTH_ABBREV[Number(tx.date.slice(5, 7)) - 1], year: tx.date.slice(0, 4), amount: tx.amount, paidOn: tx.date }));

  return {
    status: STATUS_MAP[status] || "due",
    amountDue: status === "paid" ? 0 : FLAT_MONTHLY_FEE,
    currency: "so'm",
    deadline: status === "overdue" ? lastPassedTenth(bridgeToday()) : nextUpcomingTenth(bridgeToday()),
    feeBreakdown: status === "paid" ? [] : [{ label: "tuition", amount: FLAT_MONTHLY_FEE }],
    history,
  };
}
