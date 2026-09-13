import { MONTHS } from "../constants/months.js";
import { bridge } from "./liveBridge.js";

function addMinutes(time, mins) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Reshapes ONE real teacher-marked record into the rich per-day shape the
// original parent screens render. Subject/teacher/time come from the
// student's actual group (real data) — only the lesson "topic" has no
// real-world source yet, so it's shown as the group's subject name instead
// of inventing a fake lesson title.
function toDisplayDay(dateStr, entry, group, teacherName) {
  const day = Number(dateStr.slice(8, 10));
  const scheduled = (group?.schedule || "").split(" ").pop() || "15:00";
  const checkIn = entry.status === "P" ? scheduled : entry.status === "L" ? addMinutes(scheduled, entry.lateBy || 0) : null;
  return {
    day,
    subject: group?.subject || "—",
    teacher: teacherName || "—",
    time: scheduled,
    topic: group?.subject || "—",
    status: entry.status,
    lateBy: entry.lateBy || 0,
    checkIn,
    checkedInBy: entry.status !== "A" ? "Front desk" : null,
  };
}

export function getAttendance(studentId) {
  const empty = {};
  MONTHS.forEach(m => { empty[m] = []; });

  const student = bridge.students.find(s => s.id === studentId);
  if (!student || !student.groupId) return empty;
  const group = bridge.groups.find(g => g.id === student.groupId);
  const teacherName = group ? (bridge.teachers.find(t => t.id === group.teacherId)?.name) : null;
  const byDate = bridge.attendanceRecords[student.groupId] || {};

  const result = {};
  MONTHS.forEach(m => { result[m] = []; });
  Object.entries(byDate).forEach(([dateStr, entries]) => {
    const entry = entries[studentId];
    if (!entry) return;
    const monthIdx = Number(dateStr.slice(5, 7)) - 1;
    const monthKey = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIdx];
    if (!result[monthKey]) return; // outside the demo's Mar-Sep window
    result[monthKey].push(toDisplayDay(dateStr, entry, group, teacherName));
  });
  Object.values(result).forEach(days => days.sort((a, b) => a.day - b.day));
  return result;
}
