// Plain unit checks (no browser): the data layer works for ANY "today", not
// just the old fixed 8 Sep 2026 — including a window that crosses New Year and
// data from the same month of a different year. Every check passes the day in
// explicitly (bridge.currentDateStr), so nothing here depends on the real date.
import { updateBridge } from "../src/parent-app/data/liveBridge.js";
import { getAttendance } from "../src/parent-app/data/attendance.js";
import { getGrades } from "../src/parent-app/data/grades.js";
import { getHomework } from "../src/parent-app/data/homework.js";
import { getPayments } from "../src/parent-app/data/payments.js";
import { getNotifications } from "../src/parent-app/data/notifications.js";
import { longestPresentStreak, currentPresentStreak, daysUntilPaymentDue } from "../src/parent-app/utils/calculations.js";
import { computeParentAnalytics } from "../src/parent-app/utils/parentAnalytics.js";
import { generateInsights } from "../src/parent-app/utils/insightGenerator.js";

let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) { failures++; console.log(`FAIL — ${name}${detail ? "  → " + detail : ""}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const STUDENT = { id: "s1", name: "Kid", grade: "Grade 7", groupId: "g1", guardians: [] };
const GROUP = { id: "g1", subject: "Mathematics", teacherId: "t1", studentIds: ["s1"], schedule: "Mon Wed Fri 15:00" };
const setWorld = (today, over = {}) => updateBridge({
  students: [STUDENT], groups: [GROUP], teachers: [{ id: "t1", name: "Teacher" }],
  attendanceRecords: {}, gradesRecords: {}, homeworkRecords: {}, homeworkSubmissions: {},
  paymentsStatus: {}, paymentTransactions: {}, messageThreads: {}, currentDateStr: today, selectedStudentId: "s1", ...over,
});
const att = (entries) => ({ g1: Object.fromEntries(Object.entries(entries).map(([d, st]) => [d, { s1: typeof st === "string" ? { status: st } : st }])) });

// ---------------------------------------------------------------- attendance
{
  setWorld("2026-09-08");
  check("today = 8 Sep 2026: the months are Mar…Sep, as the app always showed", eq(Object.keys(getAttendance("s1")), ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"]));

  setWorld("2027-01-10", { attendanceRecords: att({ "2026-01-15": "A", "2027-01-07": "P", "2026-07-01": "P", "2026-06-30": "P" }) });
  const a = getAttendance("s1");
  check("window ending Jan 2027 runs Jul…Jan, oldest first", eq(Object.keys(a), ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan"]), JSON.stringify(Object.keys(a)));
  check("January 2027 holds ONLY its own record — Jan 2026 (same month name, a year earlier) is not mixed in",
    a.Jan.length === 1 && a.Jan[0].day === 7 && a.Jan[0].status === "P", JSON.stringify(a.Jan));
  check("the first day of the window counts; the day before it does not", a.Jul.length === 1 && a.Jul[0].day === 1 && !("Jun" in a));
}

// -------------------------------------------------------------------- grades
{
  const e = (id, subject, date, score, maxScore = 100) => ({ id, assessmentId: id, groupId: "g1", subject, title: id, date, score, maxScore });
  const monthlyOf = (subjects, name) => subjects.find(s => s.name === name).monthly.map(m => `${m.month}:${m.score}${m.real ? "*" : ""}`);

  // Maths has a real May result; English has only one from before the window opened (Apr…Oct).
  setWorld("2026-10-06", { gradesRecords: { s1: [
    e("e1", "English", "2026-03-01", 60),      // before the window — still English's latest known result
    e("m1", "Mathematics", "2026-02-10", 80),  // before the window
    e("m2", "Mathematics", "2026-05-10", 90),  // a real May result
  ] } });
  const g = getGrades("s1");
  check("the period starts at the first month with a real result (May), as before", g.every(s => s.monthly[0].month === "May" && s.monthly.at(-1).month === "Oct"), JSON.stringify(g.map(s => s.monthly.map(m => m.month))));
  check("a result from BEFORE the window carries into it: English reads 60 in every month, none of them 'real'",
    eq(monthlyOf(g, "English"), ["May:60", "Jun:60", "Jul:60", "Aug:60", "Sep:60", "Oct:60"]), JSON.stringify(monthlyOf(g, "English")));
  check("Mathematics: real in May, carried after", eq(monthlyOf(g, "Mathematics"), ["May:90*", "Jun:90", "Jul:90", "Aug:90", "Sep:90", "Oct:90"]), JSON.stringify(monthlyOf(g, "Mathematics")));

  setWorld("2026-10-06", { gradesRecords: { s1: [e("m1", "Mathematics", "2026-02-10", 80)] } });
  const only = getGrades("s1");
  check("with ONLY pre-window results the whole window shows the known score (not zeros), none real",
    eq(monthlyOf(only, "Mathematics"), ["Apr:80", "May:80", "Jun:80", "Jul:80", "Aug:80", "Sep:80", "Oct:80"]), JSON.stringify(monthlyOf(only, "Mathematics")));

  setWorld("2026-10-06", { gradesRecords: { s1: [e("old", "Mathematics", "2025-05-10", 50)] } });
  check("May 2025 never becomes a real 'May' of 2026", getGrades("s1")[0].monthly.every(m => !m.real));

  setWorld("2026-09-08", { gradesRecords: { s1: [e("a", "Mathematics", "2026-05-08", 80), e("b", "Mathematics", "2026-09-05", 90)] } });
  check("today = 8 Sep 2026 gives exactly the series the app always produced", eq(monthlyOf(getGrades("s1"), "Mathematics"), ["May:80*", "Jun:80", "Jul:80", "Aug:80", "Sep:90*"]));
}

// ------------------------------------------------------------------ homework
{
  const hw = (id, dueDate) => ({ id, title: id, dueDate, createdDate: "2026-09-01" });
  setWorld("2026-10-06", { homeworkRecords: { g1: [hw("past", "2026-10-05"), hw("today", "2026-10-06"), hw("soon", "2026-10-20"), hw("nextyear", "2027-10-20")] } });
  const h = getHomework("s1");
  check("due yesterday is overdue; due TODAY is still pending (not yet late)", h.history.some(x => x.id === "past" && x.status === "overdue") && h.pending.some(x => x.id === "today"));
  const soon = h.pending.find(x => x.id === "soon");
  check("each item carries its full due date, month, day AND year-month", soon.due === "2026-10-20" && soon.month === "Oct" && soon.day === 20 && soon.ym === "2026-10");
  check("a history item carries its full due date too (no year is ever guessed)", h.history.find(x => x.id === "past").due === "2026-10-05");
  check("pending is soonest-first", eq(h.pending.map(x => x.id), ["today", "soon", "nextyear"]));

  // October 2027 is not October 2026
  const a = computeParentAnalytics({
    studentId: "s1", today: "2026-10-06", homework: h,
    grades: [{ name: "Mathematics", score: 80, classAvg: 80, hasClassComparison: false, monthly: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"].map(m => ({ month: m, score: 80, real: m === "Oct" })) }],
    attendanceData: Object.fromEntries(["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"].map(m => [m, []])),
  });
  const oct = a.hwByMonth.find(r => r.month === "Oct");
  check("October 2026's homework count excludes an assignment due in October 2027", oct && oct.total === 3, JSON.stringify(oct));
}

// ------------------------------------------------------------------ payments
{
  const deadline = (today, status) => { setWorld(today, { paymentsStatus: { s1: status } }); return getPayments("s1").deadline; };
  check("pending: before the 10th → this month's 10th", deadline("2026-09-08", "pending") === "2026-09-10");
  check("pending: on the 10th → next month's 10th", deadline("2026-09-10", "pending") === "2026-10-10");
  check("pending across New Year: 20 Dec → 10 Jan of the NEXT year", deadline("2026-12-20", "pending") === "2027-01-10");
  check("overdue: before the 10th → LAST month's 10th", deadline("2026-09-08", "overdue") === "2026-08-10");
  check("overdue: on/after the 10th → this month's 10th", deadline("2026-09-10", "overdue") === "2026-09-10" && deadline("2026-09-25", "overdue") === "2026-09-10");
  check("overdue across New Year: 5 Jan → 10 Dec of the PREVIOUS year", deadline("2027-01-05", "overdue") === "2026-12-10");
  check("days until a deadline are counted on the calendar dates", daysUntilPaymentDue("2027-01-10", "2026-12-20") === 21 && daysUntilPaymentDue("2026-09-10", "2026-10-06") === -26);
}

// -------------------------------------------------------------- notifications
{
  setWorld("2027-01-10", { attendanceRecords: att({ "2026-12-11": { status: "L", lateBy: 5 }, "2026-12-10": { status: "L", lateBy: 7 } }) });
  const late = getNotifications("s1").filter(n => n.category === "attendance").map(n => n.id);
  check("late arrivals count back 30 days across a month AND year end (11 Dec is in, 10 Dec is out)", eq(late, ["late-s1-2026-12-11"]), JSON.stringify(late));
}

// ------------------------------------------------------------------- streaks
{
  const day = (d, status = "P") => ({ day: d, status });
  const data = { Jul: [], Aug: [], Sep: [], Oct: [], Nov: [], Dec: [day(29), day(30)], Jan: [day(2)] };   // oldest first, as getAttendance builds it
  check("a run of present days continues from December into January", longestPresentStreak(data) === 3 && currentPresentStreak(data) === 3, `${longestPresentStreak(data)} / ${currentPresentStreak(data)}`);
  const broken = { ...data, Dec: [day(28), day(29), day(30, "A")] };   // present, present, ABSENT, then present in January
  check("…and an absence in December breaks it: longest is the 2 before it, current is just January's 1",
    longestPresentStreak(broken) === 2 && currentPresentStreak(broken) === 1, `${longestPresentStreak(broken)} / ${currentPresentStreak(broken)}`);

  const ins = generateInsights({ attendanceData: { Dec: [day(1, "A")], Jan: [day(2), day(3), day(4), day(5), day(6)] }, grades: [], homework: { pending: [], history: [] } });
  check("'this month' for insights is the LAST month of the window, even when it is January", ins.some(i => i.textKey === "insightAttendanceGood"), JSON.stringify(ins.map(i => i.textKey)));
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("PASS — data layer for any 'today': month window, year-aware filing, pre-window carry, homework by month+year, payment deadlines across New Year, 30-day cutoff, streaks across the year end");
