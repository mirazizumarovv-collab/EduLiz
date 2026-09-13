import { bridge } from "./liveBridge.js";

export function getNotifications(studentId) {
  const student = bridge.students.find(s => s.id === studentId);
  if (!student) return [];
  const notifications = [];

  // Recent grades (last 5 entries) → "new score" notifications.
  (bridge.gradesRecords[studentId] || []).slice(-5).forEach(g => {
    notifications.push({
      id: `grade-${g.id}`, category: "grades", textKey: "notifNewScore",
      vars: { subject: g.subject, score: Math.round((g.score / g.maxScore) * 100) },
      time: `${g.date}T18:00:00`, read: false,
    });
  });

  // Overdue homework → "homework overdue" notifications.
  if (student.groupId) {
    (bridge.homeworkRecords[student.groupId] || []).forEach(hw => {
      const done = !!(bridge.homeworkSubmissions[hw.id] || {})[studentId];
      if (!done && hw.dueDate < bridge.currentDateStr) {
        notifications.push({
          id: `hw-${hw.id}`, category: "homework", textKey: "notifHomeworkOverdue",
          vars: { title: hw.title }, time: `${hw.dueDate}T08:00:00`, read: false,
        });
      }
    });
  }

  // Payment status → a due/overdue reminder.
  const payStatus = bridge.paymentsStatus[studentId];
  if (payStatus === "overdue" || payStatus === "pending") {
    notifications.push({
      id: `payment-${studentId}`, category: "payments", textKey: "notifPaymentDue",
      vars: { days: 3 }, time: `${bridge.currentDateStr}T09:00:00`, read: false,
    });
  }

  // Recent late arrivals (last 30 days of records) → "late" notifications.
  if (student.groupId) {
    const byDate = bridge.attendanceRecords[student.groupId] || {};
    Object.entries(byDate).forEach(([dateStr, entries]) => {
      const entry = entries[studentId];
      if (entry?.status === "L") {
        notifications.push({
          id: `late-${studentId}-${dateStr}`, category: "attendance", textKey: "notifLate",
          vars: { min: entry.lateBy || 0 }, time: `${dateStr}T15:00:00`, read: false,
        });
      }
    });
  }

  return notifications.sort((a, b) => b.time.localeCompare(a.time));
}
