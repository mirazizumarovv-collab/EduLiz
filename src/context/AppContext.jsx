import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { Home, Calendar, BarChart3, BookOpen, CreditCard, Sparkles, Bell, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { getTheme } from "../constants/theme.js";
import { translate } from "../i18n/index.js";
import { teachers as initialTeachers } from "../data/teachers.js";
import { groups as initialGroups } from "../data/groups.js";
import { students as initialStudents } from "../data/students.js";
import { messageThreads as initialMessageThreads } from "../data/messages.js";
import { initialGuardians } from "../parent-app/data/guardians.js";
import { CURRENT_DATE_STR } from "../constants/months.js";
import { GROUP_AVG_ATTENDANCE_PCT } from "../constants/config.js";
import { loadPersisted, savePersisted } from "../utils/persistence.js";
import { updateBridge } from "../parent-app/data/liveBridge.js";

const AppContext = createContext(null);
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

  // --- Canonical shared data (Admin/Teacher/Operator/Parent all read this) ---
  const [students, setStudents] = useState(() => loadPersisted("students", initialStudents));
  const [groups, setGroups] = useState(() => loadPersisted("groups", initialGroups));
  const [teachers, setTeachers] = useState(() => loadPersisted("teachers", initialTeachers));
  const [messageThreads, setMessageThreads] = useState(() => loadPersisted("messageThreads", initialMessageThreads));
  const [requests, setRequests] = useState(() => loadPersisted("requests", initialRequests));
  const [attendanceRecords, setAttendanceRecords] = useState(() => loadPersisted("attendanceRecords", {}));
  const [gradesRecords, setGradesRecords] = useState(() => loadPersisted("gradesRecords", {}));
  const [homeworkRecords, setHomeworkRecords] = useState(() => loadPersisted("homeworkRecords", {}));
  const [homeworkSubmissions, setHomeworkSubmissions] = useState(() => loadPersisted("homeworkSubmissions", {}));
  const [paymentsStatus, setPaymentsStatus] = useState(() => loadPersisted("paymentsStatus", { aisha: "paid", umar: "pending", "aisha-friend-1": "overdue", "aisha-friend-2": "paid" }));

  // --- Parent-role-only UI state (ported from the standalone parent app) ---
  const [screen, setScreen] = useState("onboarding"); // Parent role's OWN internal router (Dashboard/Attendance/.../Onboarding/Registration)
  const [notifPrefs, setNotifPrefs] = useState(() => loadPersisted("notifPrefs", { attendance: true, homework: true, grades: true, payments: true, general: true }));
  const [quietHours, setQuietHours] = useState(() => loadPersisted("quietHours", { enabled: true, start: "22:00", end: "07:00" }));
  const [familyMembers, setFamilyMembers] = useState(() => loadPersisted("familyMembers", initialGuardians)); // "guardians" who have app access — distinct from the guardian-login-picker list below
  const [pin, setPin] = useState(() => loadPersisted("pin", null));
  const [appLockEnabled, setAppLockEnabled] = useState(() => loadPersisted("appLockEnabled", false));
  const [locked, setLocked] = useState(false);
  const [toast, setToastState] = useState("");
  const [parentNavItems, setParentNavItems] = useState(() => loadPersisted("parentNavItems", DEFAULT_PARENT_NAV_ITEMS));
  const [readNotifIds, setReadNotifIds] = useState(() => new Set(loadPersisted("readNotifIds", [])));
  const [deletedNotifIds, setDeletedNotifIds] = useState(() => new Set(loadPersisted("deletedNotifIds", [])));
  const [registered, setRegistered] = useState(() => loadPersisted("registered", false));
  const [parentPhone, setParentPhone] = useState(() => loadPersisted("parentPhone", ""));
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
  useEffect(() => savePersisted("gradesRecords", gradesRecords), [gradesRecords]);
  useEffect(() => savePersisted("homeworkRecords", homeworkRecords), [homeworkRecords]);
  useEffect(() => savePersisted("homeworkSubmissions", homeworkSubmissions), [homeworkSubmissions]);
  useEffect(() => savePersisted("paymentsStatus", paymentsStatus), [paymentsStatus]);
  useEffect(() => savePersisted("notifPrefs", notifPrefs), [notifPrefs]);
  useEffect(() => savePersisted("quietHours", quietHours), [quietHours]);
  useEffect(() => savePersisted("familyMembers", familyMembers), [familyMembers]);
  useEffect(() => savePersisted("pin", pin), [pin]);
  useEffect(() => savePersisted("appLockEnabled", appLockEnabled), [appLockEnabled]);
  useEffect(() => savePersisted("parentNavItems", parentNavItems), [parentNavItems]);
  useEffect(() => savePersisted("readNotifIds", [...readNotifIds]), [readNotifIds]);
  useEffect(() => savePersisted("deletedNotifIds", [...deletedNotifIds]), [deletedNotifIds]);
  useEffect(() => savePersisted("registered", registered), [registered]);
  useEffect(() => savePersisted("parentPhone", parentPhone), [parentPhone]);
  useEffect(() => savePersisted("onboarded", onboarded), [onboarded]);

  // Real app-lifecycle PIN lock for the Parent role — same behavior as the
  // standalone parent app: returning to the tab (or a fresh load) re-locks.
  useEffect(() => {
    if (!appLockEnabled || !pin) return;
    setLocked(true);
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
  updateBridge({ students, groups, teachers, attendanceRecords, gradesRecords, homeworkRecords, homeworkSubmissions, paymentsStatus, messageThreads, currentDateStr: CURRENT_DATE_STR, selectedStudentId });

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
  // Umar). This is distinct from `familyMembers` (the parent-role's own
  // "who else has app access" list under Settings).
  const guardianLoginList = useMemo(() => {
    const map = new Map();
    students.forEach(s => {
      if (!s.guardianPhone) return;
      if (!map.has(s.guardianPhone)) map.set(s.guardianPhone, { phone: s.guardianPhone, name: s.guardianName });
    });
    return [...map.values()];
  }, [students]);

  const myChildren = useMemo(
    () => (currentGuardianPhone ? students.filter(s => s.guardianPhone === currentGuardianPhone) : []),
    [students, currentGuardianPhone]
  );
  const selectedStudent = useMemo(
    () => myChildren.find(s => s.id === selectedStudentId) || myChildren[0] || null,
    [myChildren, selectedStudentId]
  );

  const showToast = useCallback((message) => {
    setToastState(message);
    setTimeout(() => setToastState(""), 2200);
  }, []);

  // Connecting a child via invitation code looks up a REAL student (created
  // by Admin/Operator) and links them to this parent's phone — distinct
  // from Admin's `addStudent`, which creates a brand-new system-wide student.
  const connectChild = useCallback((code) => {
    const match = students.find(s => s.connectionCode === code);
    if (!match) return null;
    setStudents(prev => prev.map(s => (s.id === match.id ? { ...s, guardianPhone: parentPhone || s.guardianPhone } : s)));
    setCurrentGuardianPhone(parentPhone || match.guardianPhone);
    setSelectedStudentId(match.id);
    return match;
  }, [students, parentPhone]);

  const familyMemberActions = {
    revokeFamilyMember: useCallback((id) => setFamilyMembers(prev => prev.filter(g => g.id !== id)), []),
    addFamilyMember: useCallback((member) => setFamilyMembers(prev => [...prev, { id: `fam-${Date.now()}`, isSelf: false, ...member }]), []),
  };

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

  const saveAttendance = useCallback((groupId, dateStr, entries) => {
    setAttendanceRecords(prev => ({ ...prev, [groupId]: { ...(prev[groupId] || {}), [dateStr]: entries } }));
  }, []);

  const addGrades = useCallback((subject, title, maxScore, scoresByStudent, date = CURRENT_DATE_STR) => {
    setGradesRecords(prev => {
      const next = { ...prev };
      Object.entries(scoresByStudent).forEach(([studentId, score]) => {
        const entry = { id: `${studentId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, subject, title, score, maxScore, date };
        next[studentId] = [...(next[studentId] || []), entry];
      });
      return next;
    });
  }, []);

  const addHomework = useCallback((groupId, title, dueDate) => {
    const entry = { id: `hw-${Date.now()}`, title, dueDate, createdDate: CURRENT_DATE_STR };
    setHomeworkRecords(prev => ({ ...prev, [groupId]: [...(prev[groupId] || []), entry] }));
  }, []);

  const toggleHomeworkSubmission = useCallback((homeworkId, studentId, completed) => {
    setHomeworkSubmissions(prev => {
      const forHw = { ...(prev[homeworkId] || {}) };
      if (completed) forHw[studentId] = true;
      else delete forHw[studentId];
      return { ...prev, [homeworkId]: forHw };
    });
  }, []);

  const sendMessage = useCallback((studentId, text, from = "center") => {
    const entry = { id: `local-${Date.now()}`, from, text, time: new Date().toISOString() };
    setMessageThreads(prev => ({ ...prev, [studentId]: [...(prev[studentId] || []), entry] }));
  }, []);

  const approveRequest = useCallback((requestId, groupId) => {
    const req = requests.find(r => r.id === requestId);
    if (!req || !groupId) return;
    const code = `REG-${Math.floor(1000 + Math.random() * 9000)}`;
    const id = `s-${Date.now()}`;
    setStudents(prev => [...prev, {
      id, name: req.childName, grade: req.grade, groupId,
      guardianName: req.parentName, guardianPhone: req.parentPhone, connectionCode: code,
    }]);
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, studentIds: [...g.studentIds, id] } : g)));
    setRequests(prev => prev.map(r => (r.id === requestId ? { ...r, status: "approved", connectionCode: code } : r)));
  }, [requests]);
  const rejectRequest = useCallback((requestId) => {
    setRequests(prev => prev.map(r => (r.id === requestId ? { ...r, status: "rejected" } : r)));
  }, []);

  const setPaymentStatus = useCallback((studentId, status) => {
    setPaymentsStatus(prev => ({ ...prev, [studentId]: status }));
  }, []);

  // Admin's "create a brand-new student in the system" — distinct from
  // Parent's `connectChild` (which links an EXISTING student to a family).
  const addStudent = useCallback((student) => {
    const id = `s-${Date.now()}`;
    setStudents(prev => [...prev, { id, ...student }]);
    if (student.groupId) {
      setGroups(prev => prev.map(g => (g.id === student.groupId ? { ...g, studentIds: [...g.studentIds, id] } : g)));
    }
    return id;
  }, []);

  const moveStudentToGroup = useCallback((studentId, newGroupId) => {
    setStudents(prev => prev.map(s => (s.id === studentId ? { ...s, groupId: newGroupId } : s)));
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
  }, []);

  const addGroup = useCallback((group) => {
    setGroups(prev => [...prev, { id: `g-${Date.now()}`, studentIds: [], ...group }]);
  }, []);

  const updateGroup = useCallback((groupId, patch) => {
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, ...patch } : g)));
  }, []);

  const deleteGroup = useCallback((groupId) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setStudents(prev => prev.map(s => (s.groupId === groupId ? { ...s, groupId: null } : s)));
  }, []);

  const addTeacher = useCallback((teacher) => {
    setTeachers(prev => [...prev, { id: `t-${Date.now()}`, ...teacher }]);
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
    setPin(null);
    setAppLockEnabled(false);
    setFamilyMembers(initialGuardians);
    setNotifPrefs({ attendance: true, homework: true, grades: true, payments: true, general: true });
    setQuietHours({ enabled: true, start: "22:00", end: "07:00" });
    setParentNavItems(DEFAULT_PARENT_NAV_ITEMS);
    setReadNotifIds(new Set());
    setDeletedNotifIds(new Set());
  }, []);

  const value = {
    role, setRole, currentTeacher, currentTeacherId, setCurrentTeacherId,
    currentGuardianPhone, setCurrentGuardianPhone, guardianLoginList,
    myChildren, studentList: myChildren, selectedStudent, selectedStudentId, setSelectedStudentId,
    theme, themeMode, setThemeMode, lang, setLang, t,
    students, groups, teachers, myGroups,
    attendanceRecords, saveAttendance,
    gradesRecords, addGrades,
    homeworkRecords, addHomework, homeworkSubmissions, toggleHomeworkSubmission,
    messageThreads, sendMessage,
    requests, approveRequest, rejectRequest,
    paymentsStatus, setPaymentStatus,
    addStudent, updateStudent, deleteStudent, moveStudentToGroup, connectChild,
    addGroup, updateGroup, deleteGroup,
    addTeacher, updateTeacher, deleteTeacher,
    // Parent-role-only surface (ported from the standalone parent app):
    screen, setScreen,
    notifPrefs, setNotifPrefs,
    quietHours, setQuietHours,
    guardians: familyMembers, setGuardians: setFamilyMembers,
    revokeGuardian: familyMemberActions.revokeFamilyMember, addGuardian: familyMemberActions.addFamilyMember,
    pin, setPin, appLockEnabled, setAppLockEnabled, locked, setLocked,
    toast, showToast,
    navItems: parentNavItems, toggleNavItem: toggleParentNavItem,
    readNotifIds, deletedNotifIds, markNotifRead, markAllNotifsRead, deleteNotif, undoDeleteNotif,
    registered, setRegistered, parentPhone, setParentPhone,
    onboarded, setOnboarded,
    groupAvgAttendancePct: GROUP_AVG_ATTENDANCE_PCT,
    logout,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
