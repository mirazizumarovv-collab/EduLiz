import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Home, Calendar, BarChart3, BookOpen, CreditCard, Sparkles, Bell, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { getTheme } from "../constants/theme.js";
import { translate } from "../i18n/index.js";
import { teachers as initialTeachers } from "../data/teachers.js";
import { groups as initialGroups } from "../data/groups.js";
import { students as initialStudents } from "../data/students.js";
import { messageThreads as initialMessageThreads } from "../data/messages.js";
import { todayISO, timeHHMM, timestampISO, windowStartISO } from "../utils/clock.js";
import { createId } from "../utils/ids.js";
import { checkAttendance } from "../utils/attendanceRules.js";
import { checkPayment } from "../utils/paymentRules.js";
import { findDuplicateHomework } from "../utils/homeworkRules.js";
import { checkGroupFields, normalizeSchedule, scheduleStart } from "../utils/groupRules.js";
import { moveInHistory, moveStudent } from "../utils/groupHistory.js";
import { GROUP_AVG_ATTENDANCE_PCT } from "../constants/config.js";
import { loadPersisted, savePersisted, removePersisted } from "../utils/persistence.js";
import {
  emptyGradeStore, isValidGradeStore, migrateLegacyGradesRecords, deriveGradesRecords,
  recordAssessmentScores, removeStudentFromGrades,
  editAssessment as editAssessmentRecord, deleteAssessment as deleteAssessmentRecord, isValidISODate,
} from "../utils/gradeModel.js";
import { updateBridge } from "../parent-app/data/liveBridge.js";
import { samePhone } from "../utils/phone.js";

const AppContext = createContext(null);

// How far an assessment's date may reach: not into the future, and not before
// the months in view start (see clock.windowStartISO). Worked out when asked —
// both ends move as the calendar does.
const gradeDateBounds = () => ({ today: todayISO(), earliest: windowStartISO() });

// Loads the grade store. A browser that still holds the old per-student
// `gradesRecords` shape (and no store yet) has it converted once, so nothing a
// teacher already entered is lost.
function loadGradeStore() {
  const stored = loadPersisted("gradeStore", null);
  if (isValidGradeStore(stored)) return stored;
  const legacy = loadPersisted("gradesRecords", null);
  if (legacy && typeof legacy === "object") return migrateLegacyGradesRecords(legacy, loadPersisted("students", initialStudents));
  return emptyGradeStore();
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// Bottom-nav customization pool for the Parent role (ported from the
// standalone parent app's own AppContext).
export const NAV_POOL = {
  dashboard: { Icon: Home, key: "navDashboard" },
  attendance: { Icon: Calendar, key: "navAttendance" },
  grades: { Icon: BarChart3, key: "navGrades" },
  homework: { Icon: BookOpen, key: "navHomework" },
  payments: { Icon: CreditCard, key: "navPayments" },
  insights: { Icon: Sparkles, key: "navInsights" },
  notifications: { Icon: Bell, key: "navNotifications" },
  chat: { Icon: MessageCircle, key: "navChat" },
  settings: { Icon: SettingsIcon, key: "navSettings" },
};
const DEFAULT_PARENT_NAV_ITEMS = ["dashboard", "attendance", "grades", "homework"];
const NAV_ITEMS_CAP = 5;

// Demo registration requests waiting for Operator review — a new child a
// parent tried to connect via a code the center hasn't issued/approved yet.
const initialRequests = [
  { id: "req-1", parentName: "Nodira Karimova", parentPhone: "+998 90 444 55 66", childName: "Javlon", grade: "Grade 3", status: "pending", requestedAt: "2026-09-07T11:20:00" },
];

export function AppProvider({ children }) {
  // --- Cross-role identity/session ---
  const [role, setRole] = useState(() => loadPersisted("role", null)); // 'teacher' | 'admin' | 'parent' | 'operator' | null
  const [currentTeacherId, setCurrentTeacherId] = useState(() => loadPersisted("currentTeacherId", initialTeachers[0]?.id || null));
  const [currentGuardianPhone, setCurrentGuardianPhone] = useState(() => loadPersisted("currentGuardianPhone", null));
  const [selectedStudentId, setSelectedStudentId] = useState(() => loadPersisted("selectedStudentId", null));
  const [themeMode, setThemeMode] = useState(() => loadPersisted("themeMode", "light"));
  const [lang, setLang] = useState(() => loadPersisted("lang", "uz"));

  // --- The clock ---
  // What "today" and "now" are, kept current: it re-reads every 30 seconds and
  // whenever the tab comes back into view, so a screen left open past midnight
  // (or a phone woken after hours) moves to the new day instead of showing
  // yesterday's deadlines. State only changes when the DAY or the MINUTE does,
  // so nothing re-renders in between.
  const [clock, setClock] = useState(() => ({ today: todayISO(), time: timeHHMM() }));
  useEffect(() => {
    const refresh = () => setClock(prev => {
      const next = { today: todayISO(), time: timeHHMM() };
      return next.today === prev.today && next.time === prev.time ? prev : next;
    });
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // --- Canonical shared data (Admin/Teacher/Operator/Parent all read this) ---
  const [students, setStudents] = useState(() => loadPersisted("students", initialStudents));
  const [groups, setGroups] = useState(() => loadPersisted("groups", initialGroups));
  const [teachers, setTeachers] = useState(() => loadPersisted("teachers", initialTeachers));
  const [messageThreads, setMessageThreads] = useState(() => loadPersisted("messageThreads", initialMessageThreads));
  const [requests, setRequests] = useState(() => loadPersisted("requests", initialRequests));
  const [attendanceRecords, setAttendanceRecords] = useState(() => loadPersisted("attendanceRecords", {}));
  const attendanceRecordsRef = useRef(attendanceRecords);
  attendanceRecordsRef.current = attendanceRecords;
  // Grades are stored as Assessments + Grade rows keyed by assessmentId (see
  // utils/gradeModel.js). `gradesRecords` below is DERIVED from that store —
  // the per-student view the screens and analytics read — and is never
  // persisted or edited directly.
  const [gradeStore, setGradeStore] = useState(() => loadGradeStore());
  const gradesRecords = useMemo(() => deriveGradesRecords(gradeStore), [gradeStore]);
  // The latest store, readable from the callbacks below so each can validate
  // against it and hand its result straight back to the screen.
  const gradeStoreRef = useRef(gradeStore);
  gradeStoreRef.current = gradeStore;
  const [homeworkRecords, setHomeworkRecords] = useState(() => loadPersisted("homeworkRecords", {}));
  const [homeworkSubmissions, setHomeworkSubmissions] = useState(() => loadPersisted("homeworkSubmissions", {}));
  const [paymentsStatus, setPaymentsStatus] = useState(() => loadPersisted("paymentsStatus", { aisha: "paid", umar: "pending", "aisha-friend-1": "overdue", "aisha-friend-2": "paid" }));
  // paymentTransactions[studentId] = [{ id, amount, date, method }] — a real
  // ledger entry each time Admin records a payment, not just a status flag.
  const [paymentTransactions, setPaymentTransactions] = useState(() => loadPersisted("paymentTransactions", {
    aisha: [{ id: "tx-a1", amount: 450000, date: "2026-08-05", method: "cash" }, { id: "tx-a2", amount: 450000, date: "2026-09-04", method: "card" }],
    "aisha-friend-2": [{ id: "tx-s1", amount: 450000, date: "2026-09-02", method: "cash" }],
  }));

  // --- Parent-role-only UI state (ported from the standalone parent app) ---
  // Parent role's OWN internal router. Starts on the dashboard: onboarding and
  // registration are gated by the `onboarded`/`registered` flags, not by this
  // value — starting on a non-existent "onboarding" screen made the header
  // think a drill-down screen was open (back arrow instead of the child switcher).
  const [screen, setScreen] = useState("dashboard");
  const [notifPrefs, setNotifPrefs] = useState(() => loadPersisted("notifPrefs", { attendance: true, homework: true, grades: true, payments: true, general: true }));
  const [quietHours, setQuietHours] = useState(() => loadPersisted("quietHours", { enabled: true, start: "22:00", end: "07:00" }));
  const [pin, setPin] = useState(() => loadPersisted("pin", null));
  const [appLockEnabled, setAppLockEnabled] = useState(() => loadPersisted("appLockEnabled", false));
  // Starts locked on a fresh load when a PIN is set (app re-opened); NOT
  // re-locked just because the PIN or the lock setting changed — otherwise
  // enabling the lock, or resetting a forgotten PIN, would instantly lock
  // the person out of the session they're in.
  const [locked, setLocked] = useState(() => !!(loadPersisted("appLockEnabled", false) && loadPersisted("pin", null)));
  const [toast, setToastState] = useState("");
  const [toastAction, setToastAction] = useState(null); // { label, onClick } — e.g. Undo
  const [parentNavItems, setParentNavItems] = useState(() => loadPersisted("parentNavItems", DEFAULT_PARENT_NAV_ITEMS));
  const [readNotifIds, setReadNotifIds] = useState(() => new Set(loadPersisted("readNotifIds", [])));
  const [deletedNotifIds, setDeletedNotifIds] = useState(() => new Set(loadPersisted("deletedNotifIds", [])));
  const [registered, setRegistered] = useState(() => loadPersisted("registered", false));
  const [parentPhone, setParentPhone] = useState(() => loadPersisted("parentPhone", ""));
  const [parentName, setParentName] = useState(() => loadPersisted("parentName", ""));
  const [parentRole, setParentRole] = useState(() => loadPersisted("parentRole", "Guardian")); // Mother | Father | Guardian
  const [sessionNotice, setSessionNotice] = useState(null); // e.g. "accessRevokedNotice" — shown once on the login screen
  const [onboarded, setOnboarded] = useState(() => loadPersisted("onboarded", false));

  useEffect(() => savePersisted("role", role), [role]);
  useEffect(() => savePersisted("currentTeacherId", currentTeacherId), [currentTeacherId]);
  useEffect(() => savePersisted("currentGuardianPhone", currentGuardianPhone), [currentGuardianPhone]);
  useEffect(() => savePersisted("selectedStudentId", selectedStudentId), [selectedStudentId]);
  useEffect(() => savePersisted("themeMode", themeMode), [themeMode]);
  useEffect(() => savePersisted("lang", lang), [lang]);
  useEffect(() => savePersisted("students", students), [students]);
  useEffect(() => savePersisted("groups", groups), [groups]);
  useEffect(() => savePersisted("teachers", teachers), [teachers]);
  useEffect(() => savePersisted("messageThreads", messageThreads), [messageThreads]);
  useEffect(() => savePersisted("requests", requests), [requests]);
  useEffect(() => savePersisted("attendanceRecords", attendanceRecords), [attendanceRecords]);
  useEffect(() => {
    savePersisted("gradeStore", gradeStore);
    removePersisted("gradesRecords"); // the old per-student shape, migrated on load
  }, [gradeStore]);
  useEffect(() => savePersisted("homeworkRecords", homeworkRecords), [homeworkRecords]);
  useEffect(() => savePersisted("homeworkSubmissions", homeworkSubmissions), [homeworkSubmissions]);
  useEffect(() => savePersisted("paymentsStatus", paymentsStatus), [paymentsStatus]);
  useEffect(() => savePersisted("paymentTransactions", paymentTransactions), [paymentTransactions]);
  useEffect(() => savePersisted("notifPrefs", notifPrefs), [notifPrefs]);
  useEffect(() => savePersisted("quietHours", quietHours), [quietHours]);
  useEffect(() => savePersisted("pin", pin), [pin]);
  useEffect(() => savePersisted("appLockEnabled", appLockEnabled), [appLockEnabled]);
  useEffect(() => savePersisted("parentNavItems", parentNavItems), [parentNavItems]);
  useEffect(() => savePersisted("readNotifIds", [...readNotifIds]), [readNotifIds]);
  useEffect(() => savePersisted("deletedNotifIds", [...deletedNotifIds]), [deletedNotifIds]);
  useEffect(() => savePersisted("registered", registered), [registered]);
  useEffect(() => savePersisted("parentPhone", parentPhone), [parentPhone]);
  useEffect(() => savePersisted("parentName", parentName), [parentName]);
  useEffect(() => savePersisted("parentRole", parentRole), [parentRole]);
  useEffect(() => savePersisted("onboarded", onboarded), [onboarded]);

  // Cross-tab live sync. Every setter above only updates THIS tab's React
  // state (and localStorage); it does nothing for a Teacher/Admin/Operator
  // session open in a different tab of the same browser. The `storage`
  // event fires in every OTHER tab whenever one tab writes to localStorage,
  // so listening for it and re-applying the new value to this tab's state
  // is what makes an already-open Parent screen react to a grade a teacher
  // just saved in a neighboring tab — not just to changes made in this same
  // tab. Only canonical, cross-role stores are wired here; purely
  // per-tab/per-person state (PIN, nav customization, notification prefs)
  // deliberately isn't, since one tab's PIN entry has no business touching
  // another tab's lock screen.
  useEffect(() => {
    const setters = {
      students: setStudents, groups: setGroups, teachers: setTeachers,
      messageThreads: setMessageThreads, requests: setRequests,
      attendanceRecords: setAttendanceRecords, gradeStore: setGradeStore,
      homeworkRecords: setHomeworkRecords, homeworkSubmissions: setHomeworkSubmissions,
      paymentsStatus: setPaymentsStatus, paymentTransactions: setPaymentTransactions,
    };
    const PREFIX = "parentApp:";
    const onStorage = (e) => {
      if (!e.key || !e.key.startsWith(PREFIX)) return;
      const key = e.key.slice(PREFIX.length);
      const setter = setters[key];
      if (!setter) return;
      try {
        setter(e.newValue === null ? undefined : JSON.parse(e.newValue));
      } catch {
        // Malformed write in the other tab — ignore rather than crash this one.
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Real app-lifecycle PIN lock for the Parent role — same behavior as the
  // standalone parent app: returning to the tab (or a fresh load) re-locks.
  useEffect(() => {
    if (!appLockEnabled || !pin) return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") setLocked(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appLockEnabled, pin]);

  const theme = useMemo(() => getTheme(themeMode), [themeMode]);
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  // Synchronous (not useEffect) on purpose: child components' own effects
  // fire BEFORE this provider's effects would, so a useEffect-based sync
  // would leave the bridge empty during the very first render pass that
  // matters most. Mutating this plain object during render is safe here —
  // it's an intentional bridge for legacy non-hook data functions, not
  // component state.
  updateBridge({ students, groups, teachers, attendanceRecords, gradesRecords, homeworkRecords, homeworkSubmissions, paymentsStatus, paymentTransactions, messageThreads, currentDateStr: clock.today, selectedStudentId });

  useEffect(() => {
    document.documentElement.style.background = theme.colors.background;
    document.body.style.background = theme.colors.background;
    document.documentElement.setAttribute("data-theme", themeMode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.colors.surface);
  }, [theme, themeMode]);

  const currentTeacher = useMemo(() => teachers.find(x => x.id === currentTeacherId) || null, [teachers, currentTeacherId]);
  const myGroups = useMemo(() => (currentTeacher ? groups.filter(g => g.teacherId === currentTeacher.id) : []), [groups, currentTeacher]);

  // A "guardian" for LOGIN PICKING is identified by phone number — one
  // guardian can have multiple children (e.g. Dilnoza has both Aisha and
  // Umar). Unrelated to Settings' "Guardian Access" list, which now reads
  // the real per-student `guardians` array of whichever child is selected.
  const guardianLoginList = useMemo(() => {
    const map = new Map();
    students.forEach(s => {
      (s.guardians || []).forEach(g => {
        if (!map.has(g.phone)) map.set(g.phone, { phone: g.phone, name: g.name });
      });
    });
    return [...map.values()];
  }, [students]);

  const isGuardianOf = (student, phone) => (student.guardians || []).some(g => samePhone(g.phone, phone));
  // Parent-side screens, the PDF report and the Excel export all read
  // `student.group` (the group's display name), so it's attached here from
  // the real group record instead of being stored twice on the student.
  const myChildren = useMemo(
    () => (currentGuardianPhone
      ? students.filter(s => isGuardianOf(s, currentGuardianPhone)).map(s => ({ ...s, group: groups.find(g => g.id === s.groupId)?.name || "—" }))
      : []),
    [students, groups, currentGuardianPhone]
  );

  // Whenever a phone number is registered (fresh registration, or a
  // returning guardian re-entering the same phone after logout), check if
  // ANY student already lists it as a guardian — including a SECOND
  // guardian who connected via connectChild, not just the original one —
  // and recognize them immediately instead of forcing ConnectChild again.
  useEffect(() => {
    if (!parentPhone || currentGuardianPhone) return;
    const alreadyLinked = students.some(s => isGuardianOf(s, parentPhone));
    if (alreadyLinked) setCurrentGuardianPhone(parentPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentPhone, students]);
  const selectedStudent = useMemo(
    () => myChildren.find(s => s.id === selectedStudentId) || myChildren[0] || null,
    [myChildren, selectedStudentId]
  );

  const toastTimerRef = useRef(null);
  // `action` ({ label, onClick }) puts a button on the toast — Undo, say. A toast
  // with a button stays long enough to be read and tapped.
  const showToast = useCallback((message, action = null) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastState(message);
    setToastAction(action);
    toastTimerRef.current = setTimeout(() => { setToastState(""); setToastAction(null); toastTimerRef.current = null; }, action ? 5000 : 2200);
  }, []);

  // Connecting a child via invitation code looks up a REAL student (created
  // by Admin/Operator) and links them to this parent's phone — distinct
  // from Admin's `addStudent`, which creates a brand-new system-wide student.
  const connectChild = useCallback((code) => {
    const match = students.find(s => s.connectionCode === code);
    if (!match) return null;
    if (parentPhone) {
      const alreadyLinked = (match.guardians || []).some(g => samePhone(g.phone, parentPhone));
      if (!alreadyLinked) {
        const newGuardian = { id: createId("g"), name: parentName || parentPhone, phone: parentPhone, role: parentRole || "Guardian" };
        setStudents(prev => prev.map(s => (s.id === match.id ? { ...s, guardians: [...(s.guardians || []), newGuardian] } : s)));
      }
    }
    setCurrentGuardianPhone(parentPhone || (match.guardians && match.guardians[0]?.phone));
    setSelectedStudentId(match.id);
    return match;
  }, [students, parentPhone, parentName, parentRole]);

  // Real "who has access to this specific child" management — Settings'
  // Guardian Access now operates on THIS student's real `guardians` array,
  // not a separate, unrelated global list.
  // Returns { ok: true } or { ok: false, reason } so the caller can show
  // a real message instead of silently adding a duplicate.
  const addGuardian = useCallback((guardian) => {
    if (!selectedStudent) return { ok: false, reason: "no-student" };
    if ((selectedStudent.guardians || []).some(g => samePhone(g.phone, guardian.phone))) {
      return { ok: false, reason: "duplicate" };
    }
    const newGuardian = { id: createId("g"), ...guardian };
    setStudents(prev => prev.map(s => (s.id === selectedStudent.id ? { ...s, guardians: [...(s.guardians || []), newGuardian] } : s)));
    return { ok: true };
  }, [selectedStudent]);

  // Works for any student (Admin uses this too). If the removed guardian is
  // the one currently logged in on the Parent side, the session-validity
  // effect below signs them out.
  const revokeGuardianFrom = useCallback((studentId, guardianId) => {
    const target = students.find(s => s.id === studentId);
    if (!target || (target.guardians || []).length <= 1) return false; // never leave a student with zero guardians
    setStudents(prev => prev.map(s => (s.id === studentId ? { ...s, guardians: s.guardians.filter(g => g.id !== guardianId) } : s)));
    return true;
  }, [students]);
  const revokeGuardian = useCallback((guardianId) => {
    return selectedStudent ? revokeGuardianFrom(selectedStudent.id, guardianId) : false;
  }, [selectedStudent, revokeGuardianFrom]);

  const toggleParentNavItem = useCallback((id) => {
    if (id === "dashboard") return; // Home is always fixed, never removable
    setParentNavItems(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= NAV_ITEMS_CAP) {
        showToast(translate(lang, "navLimitReached"));
        return prev;
      }
      return [...prev, id];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, showToast]);

  const markNotifRead = useCallback((id) => setReadNotifIds(prev => new Set(prev).add(id)), []);
  const markAllNotifsRead = useCallback((ids) => setReadNotifIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; }), []);
  const deleteNotif = useCallback((id) => setDeletedNotifIds(prev => new Set(prev).add(id)), []);
  const undoDeleteNotif = useCallback((id) => setDeletedNotifIds(prev => { const next = new Set(prev); next.delete(id); return next; }), []);

  // Saves one day's register after checking it (a real date in range, everyone
  // marked, late minutes sensible — see utils/attendanceRules). Each student's
  // mark also records the lesson as it is NOW (subject, teacher, start time),
  // so a later change of teacher or time doesn't rewrite what happened on that
  // day. Returns { ok } or { ok: false, reason, … }.
  const saveAttendance = useCallback((groupId, dateStr, entries) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return { ok: false, reason: "notFound" };
    const check = checkAttendance({ date: dateStr, entries, studentIds: group.studentIds }, { today: todayISO(), earliest: windowStartISO() });
    if (!check.ok) return check;
    const lesson = {
      subject: group.subject,
      teacher: teachers.find(tc => tc.id === group.teacherId)?.name || null,
      time: scheduleStart(group.schedule),
    };
    // Who took the register — the signed-in teacher, which is not always the
    // group's own teacher (a cover teacher). Stamped with the lesson, so the
    // parent's day detail shows a real name instead of a placeholder.
    const markedBy = currentTeacher ? { role: "teacher", name: currentTeacher.name } : null;
    const stamped = { ...check.entries };
    for (const sid of group.studentIds) stamped[sid] = { ...stamped[sid], lesson: stamped[sid].lesson || lesson, markedBy: stamped[sid].markedBy || markedBy };
    setAttendanceRecords(prev => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), [dateStr]: stamped } }));
    return { ok: true, entries: stamped };
  }, [groups, teachers, currentTeacher]);

  const commitGradeStore = (next) => {
    gradeStoreRef.current = next;
    setGradeStore(next);
  };

  // Records one test for one group. Saving the same group + subject + title +
  // date again corrects that test instead of creating a second one (see
  // gradeModel.recordAssessmentScores). `date` is the day the test was given
  // (any day from the start of the reporting window up to today). Returns
  // { ok, reason?, updated } — reason is why it was refused, if it was.
  const addGrades = useCallback((groupId, subject, title, maxScore, scoresByStudent, date = todayISO()) => {
    const r = recordAssessmentScores(gradeStoreRef.current, { groupId, subject, title, date, maxScore, scoresByStudent }, gradeDateBounds());
    if (r.ok && r.store !== gradeStoreRef.current) commitGradeStore(r.store);
    return { ok: r.ok, reason: r.reason, updated: r.updated };
  }, []);

  // Edit an existing assessment — title, date, max score and scores — as one
  // all-or-nothing step (see gradeModel.editAssessment). Returns
  // { ok } or { ok: false, reason }.
  const editAssessment = useCallback((assessmentId, patch) => {
    const r = editAssessmentRecord(gradeStoreRef.current, assessmentId, patch, gradeDateBounds());
    if (r.ok) commitGradeStore(r.store);
    return r.ok ? { ok: true } : { ok: false, reason: r.reason };
  }, []);

  // Delete an assessment and every score on it. Returns whether it existed.
  const deleteAssessment = useCallback((assessmentId) => {
    const next = deleteAssessmentRecord(gradeStoreRef.current, assessmentId);
    if (next === gradeStoreRef.current) return false;
    commitGradeStore(next);
    return true;
  }, []);

  // The same assignment (title, ignoring case, due the same day) given to a
  // group twice is refused — it is almost always a double save.
  // Returns { ok } or { ok: false, reason: "title" | "date" | "duplicate" }.
  const homeworkRecordsRef = useRef(homeworkRecords);
  homeworkRecordsRef.current = homeworkRecords;
  const addHomework = useCallback((groupId, title, dueDate) => {
    const cleanTitle = String(title ?? "").trim();
    if (!cleanTitle) return { ok: false, reason: "title" };
    if (!isValidISODate(dueDate)) return { ok: false, reason: "date" };
    const current = homeworkRecordsRef.current;
    if (findDuplicateHomework(current[groupId] || [], { title: cleanTitle, dueDate })) return { ok: false, reason: "duplicate" };
    const entry = { id: createId("hw"), title: cleanTitle, dueDate, createdDate: todayISO() };
    const next = { ...current, [groupId]: [...(current[groupId] || []), entry] };
    homeworkRecordsRef.current = next;
    setHomeworkRecords(next);
    return { ok: true };
  }, []);

  const toggleHomeworkSubmission = useCallback((homeworkId, studentId, completed) => {
    setHomeworkSubmissions(prev => {
      const forHw = { ...(prev[homeworkId] || {}) };
      if (completed) forHw[studentId] = { submittedAt: todayISO() };
      else delete forHw[studentId];
      return { ...prev, [homeworkId]: forHw };
    });
  }, []);

  const sendMessage = useCallback((studentId, text, from = "center") => {
    const entry = { id: createId("local"), from, text, time: timestampISO(), readByOperator: from !== "parent" };
    setMessageThreads(prev => ({ ...prev, [studentId]: [...(prev[studentId] || []), entry] }));
  }, []);

  // Marks every parent message in one thread as read by the operator —
  // called when Operator actually opens that thread, not just because a
  // reply was sent (the operator may open a thread, read it, and not
  // reply yet; that should still count as read).
  const markThreadReadByOperator = useCallback((studentId) => {
    setMessageThreads(prev => {
      const thread = prev[studentId];
      if (!thread || !thread.some(m => m.from === "parent" && !m.readByOperator)) return prev;
      return { ...prev, [studentId]: thread.map(m => (m.from === "parent" ? { ...m, readByOperator: true } : m)) };
    });
  }, []);

  const generateUniqueConnectionCode = useCallback(() => {
    const existing = new Set(students.map(s => s.connectionCode).filter(Boolean));
    let code;
    do {
      code = `REG-${Math.floor(1000 + Math.random() * 9000)}`;
    } while (existing.has(code));
    return code;
  }, [students]);

  const approveRequest = useCallback((requestId, groupId) => {
    const req = requests.find(r => r.id === requestId);
    if (!req || !groupId) return;
    const code = generateUniqueConnectionCode();
    const id = createId("s");
    setStudents(prev => [...prev, {
      id, name: req.childName, grade: req.grade, groupId,
      guardians: [{ id: createId("g"), name: req.parentName, phone: req.parentPhone, role: "Guardian" }],
      connectionCode: code,
    }]);
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, studentIds: [...g.studentIds, id] } : g)));
    setRequests(prev => prev.map(r => (r.id === requestId ? { ...r, status: "approved", connectionCode: code } : r)));
  }, [requests, generateUniqueConnectionCode]);
  const rejectRequest = useCallback((requestId) => {
    setRequests(prev => prev.map(r => (r.id === requestId ? { ...r, status: "rejected" } : r)));
  }, []);

  const setPaymentStatus = useCallback((studentId, status) => {
    setPaymentsStatus(prev => ({ ...prev, [studentId]: status }));
  }, []);

  // Marking a student as paid now records a real transaction (amount, date,
  // method) in their ledger, not just flipping a status flag — this is what
  // lets Parent's Payment History actually show something real.
  // The ledger only takes a real payment: a known student, a whole positive
  // amount, a known method — and not a second one while the student is already
  // marked paid (a double tap, or a stale screen). The status is updated in a ref
  // at once, so even two taps that arrive before the screen re-renders can't both
  // get through. Returns { ok } or { ok: false, reason }.
  const studentsRef = useRef(students);
  studentsRef.current = students;
  const paymentsStatusRef = useRef(paymentsStatus);
  paymentsStatusRef.current = paymentsStatus;
  const recordPayment = useCallback((studentId, amount, method = "cash") => {
    const check = checkPayment({
      amount, method, status: paymentsStatusRef.current[studentId], exists: studentsRef.current.some(s => s.id === studentId),
    });
    if (!check.ok) return check;
    const tx = { id: createId("tx"), amount, date: todayISO(), method };
    paymentsStatusRef.current = { ...paymentsStatusRef.current, [studentId]: "paid" };
    setPaymentTransactions(prev => ({ ...prev, [studentId]: [...(prev[studentId] || []), tx] }));
    setPaymentsStatus(prev => ({ ...prev, [studentId]: "paid" }));
    return { ok: true };
  }, []);

  // Admin's "create a brand-new student in the system" — distinct from
  // Parent's `connectChild` (which links an EXISTING student to a family).
  const addStudent = useCallback((student) => {
    const id = createId("s");
    const { guardianName, guardianPhone, ...rest } = student;
    const guardians = guardianPhone ? [{ id: createId("g"), name: guardianName || guardianPhone, phone: guardianPhone, role: "Guardian" }] : [];
    setStudents(prev => [...prev, { id, guardians, ...rest }]);
    if (student.groupId) {
      setGroups(prev => prev.map(g => (g.id === student.groupId ? { ...g, studentIds: [...g.studentIds, id] } : g)));
    }
    return id;
  }, []);

  const moveStudentToGroup = useCallback((studentId, toGroupId) => {
    const newGroupId = toGroupId || null;
    const student = studentsRef.current.find(s => s.id === studentId);
    // "Moving" a student into the group they are already in is not a move: it
    // would only close their period and open an identical one.
    if (!student || (student.groupId || null) === newGroupId) return;
    // groupHistory keeps where they have been, so what was recorded in the old group
    // stays part of their history (see utils/groupHistory.js for the day rule).
    const today = todayISO();
    const markedToday = !!(student.groupId && attendanceRecordsRef.current[student.groupId]?.[today]?.[studentId]);
    setStudents(prev => prev.map(s => (s.id === studentId ? moveStudent(s, newGroupId, today, { markedToday }) : s)));
    setGroups(prev => prev.map(g => {
      if (g.id === newGroupId) return { ...g, studentIds: g.studentIds.includes(studentId) ? g.studentIds : [...g.studentIds, studentId] };
      return { ...g, studentIds: g.studentIds.filter(id => id !== studentId) };
    }));
  }, []);

  const updateStudent = useCallback((studentId, patch) => {
    setStudents(prev => prev.map(s => (s.id === studentId ? { ...s, ...patch } : s)));
  }, []);

  const deleteStudent = useCallback((studentId) => {
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setGroups(prev => prev.map(g => ({ ...g, studentIds: g.studentIds.filter(id => id !== studentId) })));
    // Cascade cleanup — an orphaned studentId left behind in any of these
    // would silently show up in aggregate stats (class averages, homework
    // completion counts) for a student who no longer exists.
    setGradeStore(prev => removeStudentFromGrades(prev, studentId));
    setAttendanceRecords(prev => {
      const next = {};
      Object.entries(prev).forEach(([groupId, byDate]) => {
        const nextByDate = {};
        Object.entries(byDate).forEach(([date, entries]) => {
          if (!entries[studentId]) { nextByDate[date] = entries; return; }
          const { [studentId]: _removed, ...rest } = entries;
          nextByDate[date] = rest;
        });
        next[groupId] = nextByDate;
      });
      return next;
    });
    setHomeworkSubmissions(prev => {
      const next = {};
      Object.entries(prev).forEach(([hwId, byStudent]) => {
        if (!byStudent[studentId]) { next[hwId] = byStudent; return; }
        const { [studentId]: _removed, ...rest } = byStudent;
        next[hwId] = rest;
      });
      return next;
    });
    setPaymentsStatus(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    setPaymentTransactions(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    setMessageThreads(prev => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
  }, []);

  // A group needs a name, a subject and a schedule the app can read (days and a
  // start time, e.g. "Mon/Wed/Fri 15:00" — see utils/groupRules, which accepts
  // several spellings and saves the canonical one). Returns
  // { ok } or { ok: false, reason: "name" | "subject" | "schedule" }.
  const addGroup = useCallback((group) => {
    const reason = checkGroupFields({ name: group.name ?? "", subject: group.subject ?? "", schedule: group.schedule ?? "" });
    if (reason) return { ok: false, reason };
    setGroups(prev => [...prev, { id: createId("g"), studentIds: [], ...group, name: group.name.trim(), subject: group.subject.trim(), schedule: normalizeSchedule(group.schedule) }]);
    return { ok: true };
  }, []);

  // Only the fields being changed are checked, so assigning a teacher is never
  // blocked by some other field of an older group.
  const updateGroup = useCallback((groupId, patch) => {
    const given = Object.fromEntries(["name", "subject", "schedule"].filter(k => k in patch).map(k => [k, patch[k]]));
    const reason = checkGroupFields(given);
    if (reason) return { ok: false, reason };
    const clean = { ...patch };
    for (const k of Object.keys(given)) clean[k] = k === "schedule" ? normalizeSchedule(patch[k]) : String(patch[k]).trim();
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, ...clean } : g)));
    return { ok: true };
  }, []);

  const deleteGroup = useCallback((groupId) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    const today = todayISO();
    setStudents(prev => prev.map(s => (s.groupId === groupId ? { ...s, groupId: null, groupHistory: moveInHistory(s, null, today) } : s)));
    // Cascade cleanup: records keyed by this group ID would otherwise sit
    // in storage forever, unreachable from any screen.
    const hwIds = (homeworkRecords[groupId] || []).map(h => h.id);
    setAttendanceRecords(prev => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    setHomeworkRecords(prev => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
    if (hwIds.length > 0) {
      setHomeworkSubmissions(prev => {
        const next = { ...prev };
        hwIds.forEach(id => { delete next[id]; });
        return next;
      });
    }
  }, [homeworkRecords]);

  const addTeacher = useCallback((teacher) => {
    setTeachers(prev => [...prev, { id: createId("t"), ...teacher }]);
  }, []);

  const updateTeacher = useCallback((teacherId, patch) => {
    setTeachers(prev => prev.map(tc => (tc.id === teacherId ? { ...tc, ...patch } : tc)));
  }, []);

  const deleteTeacher = useCallback((teacherId) => {
    setTeachers(prev => prev.filter(tc => tc.id !== teacherId));
    setGroups(prev => prev.map(g => (g.teacherId === teacherId ? { ...g, teacherId: null } : g)));
  }, []);

  // One logout that safely covers every role: always clears cross-role
  // identity, and additionally resets Parent-specific session/security state
  // so the next person on this browser doesn't inherit a PIN or family list.
  const logout = useCallback(() => {
    setRole(null);
    setCurrentGuardianPhone(null);
    setSelectedStudentId(null);
    setRegistered(false);
    setLocked(false);
    setParentPhone("");
    setParentName("");
    setParentRole("Guardian");
    setPin(null);
    setAppLockEnabled(false);
    setNotifPrefs({ attendance: true, homework: true, grades: true, payments: true, general: true });
    setQuietHours({ enabled: true, start: "22:00", end: "07:00" });
    setParentNavItems(DEFAULT_PARENT_NAV_ITEMS);
    setReadNotifIds(new Set());
    setDeletedNotifIds(new Set());
  }, []);

  // Session validity: a Parent session is only valid while the logged-in
  // phone is still a guardian of at least one student. If Admin (or anyone)
  // removes that access — or deletes the student — the open app signs out
  // instead of continuing to show data the person can no longer see.
  useEffect(() => {
    if (role !== "parent" || !currentGuardianPhone) return;
    if (myChildren.length === 0) {
      setSessionNotice("accessRevokedNotice");
      logout();
    }
  }, [role, currentGuardianPhone, myChildren, logout]);

  const value = {
    role, setRole, currentTeacher, currentTeacherId, setCurrentTeacherId,
    currentGuardianPhone, setCurrentGuardianPhone, guardianLoginList,
    myChildren, studentList: myChildren, selectedStudent, selectedStudentId, setSelectedStudentId,
    theme, themeMode, setThemeMode, lang, setLang, t,
    students, groups, teachers, myGroups,
    attendanceRecords, saveAttendance,
    today: clock.today, nowTime: clock.time,
    gradesRecords, assessments: gradeStore.assessments, gradeRows: gradeStore.grades,
    addGrades, editAssessment, deleteAssessment,
    homeworkRecords, addHomework, homeworkSubmissions, toggleHomeworkSubmission,
    messageThreads, sendMessage, markThreadReadByOperator,
    requests, approveRequest, rejectRequest,
    paymentsStatus, setPaymentStatus, paymentTransactions, recordPayment,
    addStudent, updateStudent, deleteStudent, moveStudentToGroup, connectChild,
    addGroup, updateGroup, deleteGroup,
    addTeacher, updateTeacher, deleteTeacher,
    // Parent-role-only surface (ported from the standalone parent app):
    screen, setScreen,
    notifPrefs, setNotifPrefs,
    quietHours, setQuietHours,
    guardians: selectedStudent?.guardians || [],
    revokeGuardian, revokeGuardianFrom, addGuardian, generateUniqueConnectionCode,
    pin, setPin, appLockEnabled, setAppLockEnabled, locked, setLocked,
    toast, toastAction, showToast,
    navItems: parentNavItems, toggleNavItem: toggleParentNavItem,
    readNotifIds, deletedNotifIds, markNotifRead, markAllNotifsRead, deleteNotif, undoDeleteNotif,
    registered, setRegistered, parentPhone, setParentPhone, parentName, setParentName, parentRole, setParentRole,
    sessionNotice, clearSessionNotice: () => setSessionNotice(null),
    onboarded, setOnboarded,
    groupAvgAttendancePct: GROUP_AVG_ATTENDANCE_PCT,
    logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
