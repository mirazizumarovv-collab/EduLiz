import { students, connectableRegistry } from "../data/students.js";
import { getAttendance } from "../data/attendance.js";
import { getGrades } from "../data/grades.js";
import { getHomework } from "../data/homework.js";
import { getPayments } from "../data/payments.js";
import { getNotifications } from "../data/notifications.js";
import { initialMessages } from "../data/messages.js";
import { initialGuardians } from "../data/guardians.js";
import { CURRENT_DATE_STR, CURRENT_TIME_STR } from "../constants/months.js";

function demoNowISO() {
  return `${CURRENT_DATE_STR}T${CURRENT_TIME_STR}:00`;
}

// Simulated network latency so loading states are actually exercised.
const delay = (ms = 350) => new Promise(resolve => setTimeout(resolve, ms));

// Simulated occasional failure hook for testing error states during
// development — always false in this build, flip to test ErrorState UI.
const SIMULATE_FAILURE = false;

async function resolveOrFail(value) {
  await delay();
  if (SIMULATE_FAILURE) throw new Error("Simulated network failure");
  return value;
}

export const studentService = {
  list: () => resolveOrFail(students),
  connect: async ({ invitationCode }) => {
    await delay(500);
    const match = connectableRegistry.find(r => r.code === invitationCode.trim());
    if (!match) throw new Error("NOT_FOUND");
    return { id: match.studentId, name: match.name, grade: match.grade, group: match.group, joinedMonth: match.joinedMonth, avatarColor: "#3A6EA5" };
  },
};

export const attendanceService = {
  get: (studentId) => resolveOrFail(getAttendance(studentId)),
};

export const gradeService = {
  get: (studentId) => resolveOrFail(getGrades(studentId)),
};

export const homeworkService = {
  get: (studentId) => resolveOrFail(getHomework(studentId)),
};

export const paymentService = {
  get: (studentId) => resolveOrFail(getPayments(studentId)),
};

export const notificationService = {
  get: (studentId) => resolveOrFail(getNotifications(studentId)),
};

export const messageService = {
  getThread: () => resolveOrFail(initialMessages),
  // Honest about capability: this queues locally and does NOT claim delivery,
  // per requirement #27/#43 (no fake "message sent" success states).
  send: async (text) => {
    await delay(300);
    return { id: `local-${Date.now()}`, from: "parent", text, time: demoNowISO(), status: "queued" };
  },
};

export const guardianService = {
  list: () => resolveOrFail(initialGuardians),
};
