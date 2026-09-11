const homeworkByStudent = {
  aisha: {
    pending: [
      { id: "hw-p1", subject: "Mathematics", title: "Fractions worksheet 4", due: "2026-09-08", status: "pending" },
      { id: "hw-p2", subject: "English", title: "Reading response — Ch.6", due: "2026-09-09", status: "pending" },
    ],
    history: [
      { id: "hw-1", month: "Mar", day: 5, title: "Numbers 1–100 worksheet", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-2", month: "Mar", day: 18, title: "Alphabet review", subject: "English", status: "completed", onTime: true },
      { id: "hw-3", month: "Apr", day: 4, title: "Addition practice sheet", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-4", month: "Apr", day: 20, title: "Vocabulary list 2", subject: "English", status: "completed", onTime: true },
      { id: "hw-5", month: "May", day: 6, title: "Subtraction worksheet", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-6", month: "May", day: 22, title: "Reading response — Ch.2", subject: "English", status: "overdue" },
      { id: "hw-7", month: "Jun", day: 7, title: "Multiplication tables", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-8", month: "Jun", day: 19, title: "Vocabulary list 5", subject: "English", status: "completed", onTime: true },
      { id: "hw-9", month: "Jul", day: 9, title: "Fractions worksheet 2", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-10", month: "Jul", day: 21, title: "Lab observation sheet", subject: "Science", status: "completed", onTime: true },
      { id: "hw-11", month: "Aug", day: 8, title: "Fractions worksheet 3", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-12", month: "Aug", day: 23, title: "Reading response — Ch.5", subject: "English", status: "completed", onTime: false },
      { id: "hw-13", month: "Sep", day: 3, title: "Vocabulary list 9", subject: "English", status: "completed", onTime: true },
      { id: "hw-14", month: "Sep", day: 2, title: "Lab observation sheet", subject: "Science", status: "completed", onTime: true },
      { id: "hw-15", month: "Sep", day: 6, title: "Geometry worksheet 5", subject: "Mathematics", status: "overdue" },
    ],
  },
  umar: {
    pending: [
      { id: "hw-u1", subject: "Reading", title: "Picture story worksheet", due: "2026-09-08", status: "pending" },
    ],
    history: [
      { id: "hw-u0", month: "Mar", day: 10, title: "Shapes worksheet", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-u1b", month: "Apr", day: 14, title: "Letter sounds sheet", subject: "Reading", status: "completed", onTime: true },
      { id: "hw-u1c", month: "May", day: 9, title: "Counting to 50", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-u1d", month: "Jun", day: 16, title: "Sight words list 1", subject: "Reading", status: "completed", onTime: true },
      { id: "hw-u2", month: "Jul", day: 6, title: "Counting worksheet", subject: "Mathematics", status: "completed", onTime: true },
      { id: "hw-u3", month: "Aug", day: 12, title: "Sight words list", subject: "Reading", status: "completed", onTime: false },
      { id: "hw-u4", month: "Sep", day: 5, title: "Number bonds sheet", subject: "Mathematics", status: "overdue" },
    ],
  },
};

const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Pending items only store an ISO `due` date; history items already have
// month/day. This guarantees every item — pending or history — has both,
// so monthly grouping (analytics, Excel, PrintableReport) never silently
// drops pending homework just because it hasn't been resolved yet.
function normalizeDueDate(h) {
  if (h.month) return h;
  const d = new Date(h.due);
  return { ...h, month: MONTH_ABBREV[d.getMonth()], day: d.getDate() };
}

export function getHomework(studentId) {
  const raw = homeworkByStudent[studentId] || { pending: [], history: [] };
  const withTime = (items) => items.map(h => normalizeDueDate({ time: "18:00", ...h }));
  return { pending: withTime(raw.pending), history: withTime(raw.history) };
}
