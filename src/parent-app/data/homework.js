import { bridge, bridgeToday } from "./liveBridge.js";
import { homeworkFor } from "./studentHistory.js";

const MONTH_ABBREV = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function submissionFor(hw, studentId) {
  return (bridge.homeworkSubmissions[hw.id] || {})[studentId] || null;
}

function statusFor(hw, studentId) {
  if (submissionFor(hw, studentId)) return "completed";
  return hw.dueDate < bridgeToday() ? "overdue" : "pending";
}

export function getHomework(studentId) {
  const student = bridge.students.find(s => s.id === studentId);
  if (!student) return { pending: [], history: [] };
  // Everything given to a group while this student was in it — including a
  // group they have since left. ISO dueDate strings sort correctly as plain
  // strings — ascending here (soonest first), reversed below for history.
  const list = homeworkFor(studentId).sort((a, b) => a.hw.dueDate.localeCompare(b.hw.dueDate));

  const pending = [];
  const history = [];
  list.forEach(({ hw, groupId }) => {
    const group = bridge.groups.find(g => g.id === groupId);
    const status = statusFor(hw, studentId);
    // Read straight off the "YYYY-MM-DD" text: a Date would parse it as
    // midnight UTC, which is still the previous day in zones behind UTC.
    const month = MONTH_ABBREV[Number(hw.dueDate.slice(5, 7)) - 1];
    const day = Number(hw.dueDate.slice(8, 10));
    const ym = hw.dueDate.slice(0, 7); // month AND year, so analytics can tell two Octobers apart
    if (status === "pending") {
      pending.push({ id: hw.id, month, ym, day, subject: group?.subject || "—", title: hw.title, due: hw.dueDate, status: "pending" });
    } else {
      // Genuine on-time status: compares the real submission date (recorded
      // when the teacher marked it complete) against the real due date —
      // not an assumption.
      const submission = submissionFor(hw, studentId);
      const onTime = status === "completed" ? submission.submittedAt <= hw.dueDate : undefined;
      history.push({
        id: hw.id, month, ym, day, due: hw.dueDate,
        title: hw.title, subject: group?.subject || "—", status,
        onTime,
      });
    }
  });
  return { pending, history: history.reverse() };
}
