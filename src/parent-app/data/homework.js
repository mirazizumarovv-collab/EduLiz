import { bridge } from "./liveBridge.js";

const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function statusFor(hw, studentId) {
  const done = !!(bridge.homeworkSubmissions[hw.id] || {})[studentId];
  if (done) return "completed";
  return hw.dueDate < bridge.currentDateStr ? "overdue" : "pending";
}

export function getHomework(studentId) {
  const student = bridge.students.find(s => s.id === studentId);
  if (!student || !student.groupId) return { pending: [], history: [] };
  const group = bridge.groups.find(g => g.id === student.groupId);
  const list = bridge.homeworkRecords[student.groupId] || [];

  const pending = [];
  const history = [];
  list.forEach(hw => {
    const status = statusFor(hw, studentId);
    const d = new Date(hw.dueDate);
    if (status === "pending") {
      pending.push({ id: hw.id, subject: group?.subject || "—", title: hw.title, due: hw.dueDate, status: "pending" });
    } else {
      // No per-submission timestamp is tracked in this v1 (see README), so
      // a completed item is shown as on-time — a stated simplification,
      // not a claim about exactly when it was turned in.
      history.push({
        id: hw.id, month: MONTH_ABBREV[d.getMonth()], day: d.getDate(),
        title: hw.title, subject: group?.subject || "—", status,
        onTime: status === "completed" ? true : undefined,
      });
    }
  });
  return { pending, history };
}
