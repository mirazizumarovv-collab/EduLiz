import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { Home, Calendar, BarChart3, BookOpen, CreditCard, Sparkles, Bell, MessageCircle, Settings as SettingsIcon } from "lucide-react";
import { students as initialStudents } from "../data/students.js";
import { initialGuardians } from "../data/guardians.js";
import { getTheme } from "../constants/theme.js";
import { translate } from "../i18n/index.js";
import { GROUP_AVG_ATTENDANCE_PCT } from "../constants/config.js";
import { loadPersisted, savePersisted } from "../utils/persistence.js";

const AppContext = createContext(null);

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
const DEFAULT_NAV_ITEMS = ["dashboard", "attendance", "grades", "homework"];
const NAV_ITEMS_CAP = 5;

export function AppProvider({ children }) {
  const [studentList, setStudentList] = useState(() => loadPersisted("studentList", initialStudents));
  const [selectedStudentId, setSelectedStudentId] = useState(() => loadPersisted("selectedStudentId", initialStudents[0].id));
  const [themeMode, setThemeMode] = useState(() => loadPersisted("themeMode", "light"));
  const [lang, setLang] = useState(() => loadPersisted("lang", "uz"));
  const [screen, setScreen] = useState("onboarding"); // simple state-based router — not persisted, every session starts at the home screen
  const [notifPrefs, setNotifPrefs] = useState(() => loadPersisted("notifPrefs", { attendance: true, homework: true, grades: true, payments: true, general: true }));
  const [quietHours, setQuietHours] = useState(() => loadPersisted("quietHours", { enabled: true, start: "22:00", end: "07:00" }));
  const [guardians, setGuardians] = useState(() => loadPersisted("guardians", initialGuardians));
  const [pin, setPin] = useState(() => loadPersisted("pin", null));
  const [appLockEnabled, setAppLockEnabled] = useState(() => loadPersisted("appLockEnabled", false));
  const [locked, setLocked] = useState(false);
  const [toast, setToastState] = useState("");
  const [navItems, setNavItems] = useState(() => loadPersisted("navItems", DEFAULT_NAV_ITEMS));
  const [readNotifIds, setReadNotifIds] = useState(() => new Set(loadPersisted("readNotifIds", [])));
  const [deletedNotifIds, setDeletedNotifIds] = useState(() => new Set(loadPersisted("deletedNotifIds", [])));
  const [registered, setRegistered] = useState(() => loadPersisted("registered", false));
  const [parentPhone, setParentPhone] = useState(() => loadPersisted("parentPhone", ""));

  // Persist whenever these change — a page refresh keeps the parent's
  // preferences and session instead of silently reverting to defaults.
  // This is real client-side persistence, not a substitute for a backend
  // (a different device or browser still starts fresh — see README).
  useEffect(() => savePersisted("studentList", studentList), [studentList]);
  useEffect(() => savePersisted("selectedStudentId", selectedStudentId), [selectedStudentId]);
  useEffect(() => savePersisted("themeMode", themeMode), [themeMode]);
  useEffect(() => savePersisted("lang", lang), [lang]);
  useEffect(() => savePersisted("notifPrefs", notifPrefs), [notifPrefs]);
  useEffect(() => savePersisted("quietHours", quietHours), [quietHours]);
  useEffect(() => savePersisted("guardians", guardians), [guardians]);
  useEffect(() => savePersisted("pin", pin), [pin]);
  useEffect(() => savePersisted("appLockEnabled", appLockEnabled), [appLockEnabled]);
  useEffect(() => savePersisted("navItems", navItems), [navItems]);
  useEffect(() => savePersisted("readNotifIds", [...readNotifIds]), [readNotifIds]);
  useEffect(() => savePersisted("deletedNotifIds", [...deletedNotifIds]), [deletedNotifIds]);
  useEffect(() => savePersisted("registered", registered), [registered]);
  useEffect(() => savePersisted("parentPhone", parentPhone), [parentPhone]);

  // Real app-lifecycle lock: if a PIN is set and lock is enabled, returning
  // to the tab (or opening it fresh after a refresh) requires the PIN again
  // — this is the actual "lock on resume" behavior the Settings toggle
  // promises, not just a one-time prompt right after setting the PIN.
  useEffect(() => {
    if (!appLockEnabled || !pin) return;
    setLocked(true);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") setLocked(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // Only re-arm when the feature itself is toggled — locking on every
    // render would immediately re-lock right after the parent unlocks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appLockEnabled, pin]);

  const selectedStudent = useMemo(
    () => studentList.find(s => s.id === selectedStudentId) || studentList[0],
    [studentList, selectedStudentId]
  );

  const theme = useMemo(() => getTheme(themeMode), [themeMode]);

  // The app's own containers are correctly themed, but the raw <html>/<body>
  // behind them defaults to white. On an installed PWA, safe-area padding
  // (gesture bar) and rubber-band overscroll can both briefly reveal that
  // white strip at the edges — syncing it to the theme's background makes
  // any such gap show the right color instead of a jarring white/pink flash.
  useEffect(() => {
    document.documentElement.style.background = theme.colors.background;
    document.body.style.background = theme.colors.background;
    document.documentElement.setAttribute("data-theme", themeMode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme.colors.surface);
  }, [theme, themeMode]);
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const showToast = useCallback((message) => {
    setToastState(message);
    setTimeout(() => setToastState(""), 2200);
  }, []);

  const addStudent = useCallback((student) => {
    setStudentList(prev => [...prev, student]);
    setSelectedStudentId(student.id);
  }, []);

  const revokeGuardian = useCallback((id) => {
    setGuardians(prev => prev.filter(g => g.id !== id));
  }, []);
  const addGuardian = useCallback((guardian) => {
    setGuardians(prev => [...prev, { id: `g-${Date.now()}`, isSelf: false, ...guardian }]);
  }, []);

  const toggleNavItem = useCallback((id) => {
    if (id === "dashboard") return; // Home is always fixed, never removable
    setNavItems(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= NAV_ITEMS_CAP) {
        showToast(translate(lang, "navLimitReached"));
        return prev;
      }
      return [...prev, id];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const markNotifRead = useCallback((id) => {
    setReadNotifIds(prev => new Set(prev).add(id));
  }, []);
  const markAllNotifsRead = useCallback((ids) => {
    setReadNotifIds(prev => { const next = new Set(prev); ids.forEach(id => next.add(id)); return next; });
  }, []);
  const deleteNotif = useCallback((id) => {
    setDeletedNotifIds(prev => new Set(prev).add(id));
  }, []);
  const undoDeleteNotif = useCallback((id) => {
    setDeletedNotifIds(prev => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const logout = useCallback(() => {
    setRegistered(false);
    setLocked(false);
    setParentPhone("");
    setPin(null);
    setAppLockEnabled(false);
    setGuardians(initialGuardians);
    setStudentList(initialStudents);
    setSelectedStudentId(initialStudents[0].id);
    setNotifPrefs({ attendance: true, homework: true, grades: true, payments: true, general: true });
    setQuietHours({ enabled: true, start: "22:00", end: "07:00" });
    setNavItems(DEFAULT_NAV_ITEMS);
    setReadNotifIds(new Set());
    setDeletedNotifIds(new Set());
    // Each setter above triggers its matching save-effect, which persists
    // these reset defaults to localStorage — so the next person on this
    // browser doesn't inherit the previous parent's PIN, kids, or contacts.
    // Theme and language are device-level preferences, not tied to this
    // parent's identity, so they're intentionally left untouched.
  }, []);

  const value = {
    studentList, selectedStudent, selectedStudentId, setSelectedStudentId, addStudent,
    theme, themeMode, setThemeMode,
    lang, setLang, t,
    screen, setScreen,
    notifPrefs, setNotifPrefs,
    quietHours, setQuietHours,
    guardians, setGuardians, revokeGuardian, addGuardian,
    pin, setPin, appLockEnabled, setAppLockEnabled, locked, setLocked,
    toast, showToast,
    navItems, toggleNavItem,
    readNotifIds, deletedNotifIds, markNotifRead, markAllNotifsRead, deleteNotif, undoDeleteNotif,
    registered, setRegistered, parentPhone, setParentPhone, logout,
    groupAvgAttendancePct: GROUP_AVG_ATTENDANCE_PCT,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
