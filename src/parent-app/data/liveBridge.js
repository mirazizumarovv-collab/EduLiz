// A simple mutable singleton that AppContext keeps in sync with the
// canonical shared state. The ported parent-app screens call plain
// synchronous functions (via services/index.js), not hooks — this bridge
// is what lets those functions see LIVE data without every one of those
// ~20 files being rewritten to consume the context directly.
import { todayISO } from "../../utils/clock.js";

export const bridge = {
  students: [],
  groups: [],
  teachers: [],
  attendanceRecords: {},
  gradesRecords: {},
  homeworkRecords: {},
  homeworkSubmissions: {},
  paymentsStatus: {},
  paymentTransactions: {},
  messageThreads: {},
  currentDateStr: "",
  selectedStudentId: null,
};

export function updateBridge(partial) {
  Object.assign(bridge, partial);
}

// "Today" as the data functions below see it: the day AppContext last published
// (kept current by its clock tick), falling back to the clock itself when
// nothing has been published yet.
export function bridgeToday() {
  return bridge.currentDateStr || todayISO();
}
