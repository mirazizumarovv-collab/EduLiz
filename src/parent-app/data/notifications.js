import { bridge, bridgeToday } from "./liveBridge.js";
import { getPayments } from "./payments.js";
import { addDaysISO } from "../../utils/clock.js";
import { attendanceMarksFor, homeworkFor } from "./studentHistory.js";

export function getNotifications(studentId) {
  const student = bridge.students.find(s => s.id === studentId);
  if (!student) return [];
  const notifications = [];

  // The 5 most recent grades (the list is ordered by test date) → "new score"
  // notifications. It is a rolling "latest" feed: when a newer test pushes an
  // older one out, that notification leaves the list too.
  (bridge.gradesRecords[studentId] || []).slice(-5).forEach(g => {
    notifications.push({
      id: `grade-${g.id}`, category: "grades", textKey: "notifNewScore",
      vars: { subject: g.subject, score: Math.round((g.score / g.maxScore) * 100) },
      time: `${g.date}T18:00:00`, read: false,
    });
  });

  // Overdue homework → "homework overdue" notifications.
  // The id includes the STUDENT: siblings in one group are given the same
  // assignment, and a parent's read/deleted marks are kept by id — without the
  // student in it, reading Aisha's reminder would also mark Umar's as read.
  homeworkFor(studentId).forEach(({ hw }) => {
    const done = !!(bridge.homeworkSubmissions[hw.id] || {})[studentId];
    if (!done && hw.dueDate < bridgeToday()) {
      notifications.push({
        id: `hw-${studentId}-${hw.id}`, category: "homework", textKey: "notifHomeworkOverdue",
        vars: { title: hw.title }, time: `${hw.dueDate}T08:00:00`, read: false,
      });
    }
  });

  // Payment status → a due/overdue reminder. The id includes the actual
  // billing deadline, not just the student, so a new billing period gets
  // a genuinely new notification — not one that inherits a PREVIOUS
  // period's already-read or already-deleted state just because the
  // student id portion of the id happens to match.
  const payStatus = bridge.paymentsStatus[studentId];
  if (payStatus === "overdue" || payStatus === "pending") {
    const deadline = getPayments(studentId).deadline;
    notifications.push({
      id: `payment-${studentId}-${deadline}`, category: "payments", textKey: "notifPaymentDue",
      vars: { days: 3 }, time: `${bridgeToday()}T09:00:00`, read: false,
    });
  }

  // Recent late arrivals (last 30 days) → "late" notifications.
  {
    const cutoffStr = addDaysISO(bridgeToday(), -30);
    attendanceMarksFor(studentId).forEach(({ dateStr, entry }) => {
      if (dateStr < cutoffStr || entry.status !== "L") return;
      notifications.push({
        id: `late-${studentId}-${dateStr}`, category: "attendance", textKey: "notifLate",
        vars: { min: entry.lateBy || 0 }, time: `${dateStr}T15:00:00`, read: false,
      });
    });
  }

  return notifications.sort((a, b) => b.time.localeCompare(a.time));
}
