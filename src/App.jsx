import React, { useState } from "react";
import { LayoutDashboard, Users2, CalendarCheck, GraduationCap, BookOpen, Building2, Wallet, MessageCircle, UserPlus } from "lucide-react";
import { AppProvider, useApp } from "./context/AppContext.jsx";
import RoleSelect from "./screens/RoleSelect.jsx";
import { AppShell } from "./components/layout/AppShell.jsx";
import ParentApp from "./parent-app/ParentApp.jsx";

import TeacherDashboard from "./screens/teacher/TeacherDashboard.jsx";
import MyGroups from "./screens/teacher/MyGroups.jsx";
import MarkAttendance from "./screens/teacher/MarkAttendance.jsx";
import EnterGrades from "./screens/teacher/EnterGrades.jsx";
import AssignHomework from "./screens/teacher/AssignHomework.jsx";

import AdminDashboard from "./screens/admin/AdminDashboard.jsx";
import ManageStudents from "./screens/admin/ManageStudents.jsx";
import ManageGroups from "./screens/admin/ManageGroups.jsx";
import ManageTeachers from "./screens/admin/ManageTeachers.jsx";
import PaymentsOverview from "./screens/admin/PaymentsOverview.jsx";

import OperatorDashboard from "./screens/operator/OperatorDashboard.jsx";
import ParentMessages from "./screens/operator/ParentMessages.jsx";
import RegistrationRequests from "./screens/operator/RegistrationRequests.jsx";

const TEACHER_NAV = (t) => [
  { key: "dashboard", label: t("navDashboard"), Icon: LayoutDashboard },
  { key: "groups", label: t("navGroups"), Icon: Users2 },
  { key: "attendance", label: t("navAttendance"), Icon: CalendarCheck },
  { key: "grades", label: t("navGrades"), Icon: GraduationCap },
  { key: "homework", label: t("navHomework"), Icon: BookOpen },
];
const ADMIN_NAV = (t) => [
  { key: "dashboard", label: t("navDashboard"), Icon: LayoutDashboard },
  { key: "students", label: t("navStudents"), Icon: Users2 },
  { key: "groups", label: t("navGroups"), Icon: Building2 },
  { key: "teachers", label: t("navTeachers"), Icon: GraduationCap },
  { key: "payments", label: t("navPayments"), Icon: Wallet },
];
const OPERATOR_NAV = (t) => [
  { key: "dashboard", label: t("navDashboard"), Icon: LayoutDashboard },
  { key: "messages", label: t("navMessages"), Icon: MessageCircle },
  { key: "requests", label: t("navRequests"), Icon: UserPlus },
];

const TEACHER_SCREENS = { dashboard: TeacherDashboard, groups: MyGroups, attendance: MarkAttendance, grades: EnterGrades, homework: AssignHomework };
const ADMIN_SCREENS = { dashboard: AdminDashboard, students: ManageStudents, groups: ManageGroups, teachers: ManageTeachers, payments: PaymentsOverview };
const OPERATOR_SCREENS = { dashboard: OperatorDashboard, messages: ParentMessages, requests: RegistrationRequests };

function MainApp() {
  const { role, t, currentTeacher } = useApp();
  const [screen, setScreen] = useState("dashboard");

  if (!role) return <RoleSelect />;

  // The Parent role is the full original standalone app (its own bottom
  // nav, onboarding, registration, PIN lock) — a fundamentally different
  // mobile-first layout from Admin/Teacher/Operator's sidebar shell, so it
  // renders itself rather than being squeezed into the sidebar AppShell.
  if (role === "parent") return <ParentApp />;

  const config = {
    teacher: { nav: TEACHER_NAV(t), screens: TEACHER_SCREENS, roleLabel: t("roleTeacher"), roleName: currentTeacher?.name || "" },
    admin: { nav: ADMIN_NAV(t), screens: ADMIN_SCREENS, roleLabel: t("roleAdmin"), roleName: "" },
    operator: { nav: OPERATOR_NAV(t), screens: OPERATOR_SCREENS, roleLabel: t("roleOperator"), roleName: "" },
  }[role];

  const ScreenComponent = config.screens[screen] || config.screens.dashboard;

  return (
    <AppShell navItems={config.nav} activeScreen={screen} onNavigate={setScreen} roleLabel={config.roleLabel} roleName={config.roleName}>
      <ScreenComponent onNavigate={setScreen} />
    </AppShell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
