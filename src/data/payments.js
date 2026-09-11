const paymentsByStudent = {
  aisha: {
    status: "due", // paid | due | overdue
    amountDue: 480000,
    currency: "so'm",
    deadline: "2026-09-10",
    feeBreakdown: [{ label: "tuition", amount: 450000 }, { label: "materials", amount: 30000 }],
    history: [
      { month: "September", amount: 480000, paidOn: "2026-09-03" },
      { month: "August", amount: 480000, paidOn: "2026-08-03" },
      { month: "July", amount: 480000, paidOn: "2026-07-02" },
      { month: "June", amount: 450000, paidOn: "2026-06-04" },
      { month: "May", amount: 450000, paidOn: "2026-05-05" },
      { month: "April", amount: 450000, paidOn: "2026-04-03" },
      { month: "March", amount: 420000, paidOn: "2026-03-06" },
    ],
  },
  umar: {
    status: "paid",
    amountDue: 380000,
    currency: "so'm",
    deadline: "2026-10-05",
    feeBreakdown: [{ label: "tuition", amount: 350000 }, { label: "materials", amount: 30000 }],
    history: [
      { month: "September", amount: 380000, paidOn: "2026-09-01" },
      { month: "August", amount: 380000, paidOn: "2026-08-02" },
    ],
  },
};

export function getPayments(studentId) {
  return paymentsByStudent[studentId] || { status: "paid", amountDue: 0, currency: "so'm", deadline: null, feeBreakdown: [], history: [] };
}
