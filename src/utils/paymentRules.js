// When a payment may be recorded. Pure; enforced in the data layer so no
// screen (or a double tap) can write a nonsense or duplicate ledger entry.
export const PAYMENT_METHODS = ["cash", "card", "transfer"];

// { amount, method, status (the student's current payment status), exists }
//   → { ok: true } | { ok: false, reason: "notFound" | "amount" | "method" | "alreadyPaid" }
export function checkPayment({ amount, method, status, exists }) {
  if (!exists) return { ok: false, reason: "notFound" };
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, reason: "amount" };   // so'm: whole, positive
  if (!PAYMENT_METHODS.includes(method)) return { ok: false, reason: "method" };
  if (status === "paid") return { ok: false, reason: "alreadyPaid" };                          // a second tap, or a stale screen
  return { ok: true };
}
