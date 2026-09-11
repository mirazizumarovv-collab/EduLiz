const notificationsByStudent = {
  aisha: [
    { id: "n1", category: "attendance", textKey: "notifLate", vars: { min: 9 }, time: "2026-09-07T15:09:00", read: false },
    { id: "n2", category: "payments", textKey: "notifPaymentDue", vars: { days: 3 }, time: "2026-09-07T09:00:00", read: false },
    { id: "n3", category: "grades", textKey: "notifNewScore", vars: { subject: "Mathematics", score: 81 }, time: "2026-09-06T18:00:00", read: true },
    { id: "n4", category: "homework", textKey: "notifHomeworkOverdue", vars: { title: "Practice test 2" }, time: "2026-09-07T08:00:00", read: true },
    { id: "n5", category: "general", textKey: "notifCenterAnnouncement", vars: {}, time: "2026-09-01T10:00:00", read: true },
  ],
  umar: [
    { id: "n6", category: "homework", textKey: "notifHomeworkOverdue", vars: { title: "Number bonds sheet" }, time: "2026-09-06T08:00:00", read: false },
    { id: "n7", category: "grades", textKey: "notifNewScore", vars: { subject: "Reading", score: 71 }, time: "2026-09-08T18:00:00", read: false },
  ],
};

// textKey points at i18n entries added for notification bodies (see en/ru/uz
// dictionaries' notif* keys) so category labels and bodies both localize.
export function getNotifications(studentId) {
  return notificationsByStudent[studentId] || [];
}
