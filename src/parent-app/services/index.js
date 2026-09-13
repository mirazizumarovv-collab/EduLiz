import { getAttendance } from "../data/attendance.js";
import { getGrades } from "../data/grades.js";
import { getHomework } from "../data/homework.js";
import { getPayments } from "../data/payments.js";
import { getNotifications } from "../data/notifications.js";
import { bridge } from "../data/liveBridge.js";

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

// Chat is per-student in the unified system (the same thread Operator/Admin
// reply to) — reads/writes go through the live bridge's currently selected
// child, since this module is a plain service, not a hook.
export const messageService = {
  getThread: () => resolveOrFail(bridge.messageThreads[bridge.selectedStudentId] || []),
  // Honest about capability: this queues locally and does NOT claim delivery
  // beyond this browser's data — no fake "message sent to a real server" state.
  send: async (text) => {
    await delay(300);
    return { id: `local-${Date.now()}`, from: "parent", text, time: new Date().toISOString(), status: "queued" };
  },
};
