import { getMonths, monthAbbrInWindow } from "../../utils/clock.js";
import { bridge, bridgeToday } from "./liveBridge.js";
import { attendanceMarksFor } from "./studentHistory.js";
import { scheduleStart } from "../../utils/groupRules.js";

function addMinutes(time, mins) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Reshapes ONE real teacher-marked record into the rich per-day shape the
// original parent screens render. Subject/teacher/time are the lesson AS IT
// WAS when the register was taken (`entry.lesson`, stamped at save), so a later
// change of teacher or time doesn't rewrite old days; a record that predates
// that stamp falls back to the group it was marked in. Only the lesson "topic"
// has no real-world source yet, so it shows the subject name instead of an
// invented lesson title. `checkedInBy` is whoever took the register (stamped as
// `entry.markedBy` at save); records from before that stamp have no name, and
// none is made up.
function toDisplayDay(dateStr, entry, group, teacherName) {
  const day = Number(dateStr.slice(8, 10));
  const lesson = entry.lesson || {};
  const scheduled = lesson.time || scheduleStart(group?.schedule) || "15:00";
  const checkIn = entry.status === "P" ? scheduled : entry.status === "L" ? addMinutes(scheduled, entry.lateBy || 0) : null;
  return {
    day,
    subject: lesson.subject || group?.subject || "—",
    teacher: lesson.teacher || teacherName || "—",
    time: scheduled,
    topic: lesson.subject || group?.subject || "—",
    status: entry.status,
    lateBy: entry.lateBy || 0,
    checkIn,
    checkedInBy: entry.status !== "A" ? (entry.markedBy?.name || null) : null,
  };
}

export function getAttendance(studentId) {
  // The months in view are the window ending with the current month, and a
  // record belongs to one only if its YEAR matches too (see monthAbbrInWindow).
  const today = bridgeToday();
  const empty = {};
  getMonths(today).forEach(m => { empty[m] = []; });

  const student = bridge.students.find(s => s.id === studentId);
  if (!student) return empty;

  const result = {};
  getMonths(today).forEach(m => { result[m] = []; });
  // Every mark made for this student, in whichever group's register — so what
  // was recorded before they moved to another group is still their history.
  attendanceMarksFor(studentId).forEach(({ groupId, dateStr, entry }) => {
    const monthKey = monthAbbrInWindow(dateStr, today);
    if (!monthKey) return; // outside the months in view
    const group = bridge.groups.find(g => g.id === groupId);
    const teacherName = group ? bridge.teachers.find(t => t.id === group.teacherId)?.name : null;
    result[monthKey].push(toDisplayDay(dateStr, entry, group, teacherName));
  });
  Object.values(result).forEach(days => days.sort((a, b) => a.day - b.day));
  return result;
}
