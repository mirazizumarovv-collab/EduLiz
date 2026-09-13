// --- Attendance -------------------------------------------------------
// Attendance is stored as attendanceRecords[groupId][dateStr][studentId].
// For a given student, we scan every date recorded for THEIR group.
export function getStudentAttendanceDays(studentId, groupId, attendanceRecords) {
  const byDate = attendanceRecords[groupId] || {};
  return Object.entries(byDate)
    .filter(([, entries]) => entries[studentId])
    .map(([date, entries]) => ({ date, ...entries[studentId] }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Present OR late both count as "attended" — only absent doesn't.
export function attendanceRateFromDays(days) {
  if (days.length === 0) return null;
  const attended = days.filter(d => d.status === "P" || d.status === "L").length;
  return Math.round((attended / days.length) * 100);
}

export function monthKeyFromDate(dateStr) {
  const idx = Number(dateStr.slice(5, 7)) - 1; // "2026-09-08" -> month index 8 -> Sep
  return MONTHS_FULL[idx];
}
const MONTHS_FULL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// --- Grades -------------------------------------------------------------
// gradesRecords[studentId] = [{ id, subject, title, score, maxScore, date }]
export function getStudentGrades(studentId, gradesRecords) {
  return gradesRecords[studentId] || [];
}

export function groupBySubject(entries) {
  const bySubject = {};
  entries.forEach(e => {
    if (!bySubject[e.subject]) bySubject[e.subject] = [];
    bySubject[e.subject].push(e);
  });
  return bySubject;
}

// Class average for one specific assessment (same title+subject), across
// every student in the group who has a recorded score for it — a real
// benchmark computed from real classmates, not a synthetic number.
export function classAverageForAssessment(title, subject, groupStudentIds, gradesRecords) {
  const scores = [];
  groupStudentIds.forEach(sid => {
    const entry = (gradesRecords[sid] || []).find(e => e.title === title && e.subject === subject);
    if (entry) scores.push(Math.round((entry.score / entry.maxScore) * 100));
  });
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

// --- Homework -------------------------------------------------------------
// homeworkRecords[groupId] = [{ id, title, dueDate, createdDate }]
// NOTE: this v1 has no per-student submission tracking yet — every student
// in a group sees the same assigned list. "Completed" status isn't tracked
// per student here (a known, stated simplification — see README).
export function getGroupHomework(groupId, homeworkRecords) {
  return (homeworkRecords[groupId] || []).slice().sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// A student's status for one homework item: 'completed' if explicitly
// marked, otherwise 'overdue' or 'pending' depending on the due date —
// mirrors the same not-yet-marked distinction used for attendance.
export function getHomeworkStatusForStudent(homeworkItem, studentId, homeworkSubmissions, currentDateStr) {
  const isDone = !!(homeworkSubmissions[homeworkItem.id] || {})[studentId];
  if (isDone) return "completed";
  return homeworkItem.dueDate < currentDateStr ? "overdue" : "pending";
}

export function homeworkCompletionStats(groupHomework, studentId, homeworkSubmissions, currentDateStr) {
  let completed = 0, overdue = 0, pending = 0;
  groupHomework.forEach(hw => {
    const status = getHomeworkStatusForStudent(hw, studentId, homeworkSubmissions, currentDateStr);
    if (status === "completed") completed++;
    else if (status === "overdue") overdue++;
    else pending++;
  });
  const total = groupHomework.length;
  return { total, completed, overdue, pending, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
}

// --- Payments -------------------------------------------------------------
export function getPaymentStatus(studentId, paymentsStatus) {
  return paymentsStatus[studentId] || "pending";
}
