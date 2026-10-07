// Plain unit checks (no browser) for:
//   • the rules that decide what the teacher/admin forms may save
//   • "Latest result" picking the newest assessment, not the first subject
//   • notification ids that keep siblings' read/deleted state apart
//   • a student's history surviving a move to another group
import { checkScore, recordAssessmentScores, emptyGradeStore } from "../src/utils/gradeModel.js";
import { checkAttendance, parseLateBy } from "../src/utils/attendanceRules.js";
import { checkPayment } from "../src/utils/paymentRules.js";
import { findDuplicateHomework, orderForTeacher } from "../src/utils/homeworkRules.js";
import { checkGroupFields, isValidSchedule } from "../src/utils/groupRules.js";
import { periodsOf, moveInHistory, appliesToStudent } from "../src/utils/groupHistory.js";
import { mostRecentSubject } from "../src/parent-app/utils/calculations.js";
import { updateBridge } from "../src/parent-app/data/liveBridge.js";
import { getAttendance } from "../src/parent-app/data/attendance.js";
import { getHomework } from "../src/parent-app/data/homework.js";
import { getNotifications } from "../src/parent-app/data/notifications.js";

let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) { failures++; console.log(`FAIL — ${name}${detail ? "  → " + detail : ""}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------ 1. the "Latest result" subject
{
  const subj = (name, date, score) => ({ name, score, lastAssessment: { date } });
  const maths = subj("Mathematics", "2026-09-01", 80), english = subj("English", "2026-09-05", 90);
  check("Latest result is the subject assessed most recently, wherever it is in the list", mostRecentSubject([maths, english]).name === "English" && mostRecentSubject([english, maths]).name === "English");
  check("on a tie the earlier item wins; no subjects → null", mostRecentSubject([subj("A", "2026-09-05", 1), subj("B", "2026-09-05", 2)]).name === "A" && mostRecentSubject([]) === null);
}

// ------------------------------------------------ 2. a score is never changed to fit
{
  check("a score inside 0…max is accepted exactly as typed", eq(checkScore("15", 20), { ok: true, value: 15 }) && eq(checkScore("0", 20), { ok: true, value: 0 }) && eq(checkScore("20", 20), { ok: true, value: 20 }));
  check("25 out of 20 is refused (not saved as 20)", eq(checkScore("25", 20), { ok: false, reason: "aboveMax" }));
  check("-5 is refused (not saved as 0)", eq(checkScore("-5", 20), { ok: false, reason: "negative" }));
  check("blank / not a number is refused", checkScore("", 20).reason === "notNumber" && checkScore("abc", 20).reason === "notNumber" && checkScore(undefined, 20).reason === "notNumber");
  const base = { groupId: "g", subject: "Maths", title: "Q", date: "2026-09-08", maxScore: 20 };
  const bad = (score) => recordAssessmentScores(emptyGradeStore(), { ...base, scoresByStudent: { a: score } });
  check("the data layer refuses an out-of-range score too, whichever screen sent it", [25, -1, NaN, Infinity].every(x => bad(x).ok === false && bad(x).reason === "scoreRange"));
  check("…and a full mark is fine", bad(20).ok === true);
}

// ------------------------------------------------ 3 + 4. the attendance sheet
{
  const ids = ["a", "b"];
  const sheet = (over = {}) => ({ a: { status: "P" }, b: { status: "P" }, ...over });
  const run = (date, entries, bounds = { today: "2026-09-08", earliest: "2026-03-01" }) => checkAttendance({ date, entries, studentIds: ids }, bounds);
  check("a complete sheet for a real day is ok", run("2026-09-08", sheet()).ok === true);
  check("an EMPTY date is refused (it used to be saved under the key \"\")", run("", sheet()).reason === "date");
  check("an impossible / malformed date is refused", run("2026-02-30", sheet()).reason === "date" && run("08-09-2026", sheet()).reason === "date");
  check("a future date is refused; a date before the months in view is refused", run("2026-09-09", sheet()).reason === "dateFuture" && run("2026-02-28", sheet()).reason === "dateTooEarly");
  const un = run("2026-09-08", { a: { status: "P" } });
  check("an unmarked student is reported", un.reason === "unmarked" && eq(un.studentIds, ["b"]));

  check("minutes late: a whole number from 1 to 240 is accepted ('7' typed as text too)", [1, 5, 240, "7"].every(v => parseLateBy(v) !== null) && parseLateBy("7") === 7);
  check("minutes late: 0, negative, empty, text, fractions and 241 are all refused", [0, -5, "", "abc", 1.5, 241, NaN, null, undefined].every(v => parseLateBy(v) === null));
  const late = (lateBy) => run("2026-09-08", sheet({ b: { status: "L", lateBy } }));
  check("a late arrival with 0 / -5 / blank minutes is refused and names the student", [0, -5, ""].every(v => late(v).ok === false && late(v).reason === "lateBy" && late(v).studentId === "b"));
  check("a late arrival with 12 saves 12 (as a number)", late("12").ok && late("12").entries.b.lateBy === 12);
  check("minutes only belong to a LATE arrival: present/absent entries carry none", !("lateBy" in run("2026-09-08", sheet({ a: { status: "P", lateBy: 9 } })).entries.a));
  const moved = run("2026-09-08", { ...sheet(), gone: { status: "A", lesson: { subject: "Maths" } } });
  check("an entry for someone no longer in the group is left exactly as it was", moved.ok && eq(moved.entries.gone, { status: "A", lesson: { subject: "Maths" } }));
}

// ------------------------------------------------ 12 + 13. payments
{
  const p = (over = {}) => checkPayment({ amount: 450000, method: "cash", status: "pending", exists: true, ...over });
  check("a normal payment is ok", p().ok && p({ status: "overdue" }).ok && p({ status: undefined }).ok && ["card", "transfer"].every(m => p({ method: m }).ok));
  check("amount 0, negative, NaN, a fraction, text and Infinity are refused", [0, -100, NaN, 1.5, "450000", Infinity].every(a => p({ amount: a }).reason === "amount"));
  check("an unknown payment method is refused", p({ method: "something" }).reason === "method" && p({ method: undefined }).reason === "method");
  check("an unknown student is refused", p({ exists: false }).reason === "notFound");
  check("a second payment while already paid is refused (a double tap, a stale screen)", p({ status: "paid" }).reason === "alreadyPaid");
}

// ------------------------------------------------ 10 + 11. homework duplicates and order
{
  const hw = (id, title, dueDate) => ({ id, title, dueDate, createdDate: "2026-09-01" });
  const list = [hw("1", "Worksheet 4", "2026-09-12")];
  check("the same title due the same day is a duplicate (ignoring case and spaces)", findDuplicateHomework(list, { title: "  worksheet 4 ", dueDate: "2026-09-12" })?.id === "1");
  check("a different day or a different title is not", findDuplicateHomework(list, { title: "Worksheet 4", dueDate: "2026-09-13" }) === null && findDuplicateHomework(list, { title: "Worksheet 5", dueDate: "2026-09-12" }) === null);

  const items = [hw("old", "Old", "2026-09-01"), hw("far", "Far", "2026-09-30"), hw("older", "Older", "2026-08-15"), hw("soon", "Soon", "2026-09-10"), hw("today", "Today", "2026-09-08")];
  check("the teacher's list: coming up first (soonest on top), then past (most recent first)",
    eq(orderForTeacher(items, "2026-09-08").map(h => h.id), ["today", "soon", "far", "old", "older"]));
  check("ordering does not change the list it is given", eq(items.map(h => h.id), ["old", "far", "older", "soon", "today"]));
}

// ------------------------------------------------ 14. group fields
{
  check("valid schedules", ["Mon/Wed/Fri 15:00", "Tue/Thu 14:00", "Sat 09:30", "Mon 00:00", "Sun 23:59"].every(isValidSchedule));
  check("invalid schedules (the full set of accepted spellings is checked in 44)", ["", "15:00", "Mon/Wed/Fri", "Mon/Wed/Fri 25:00", "Mon 15:60", "Mon 3pm", "Mon 16:00-15:00", "Mon 15:00-15:00", "Funday 15:00"].every(s => !isValidSchedule(s)));
  check("a group needs a name, a subject and a valid schedule — checked in that order",
    checkGroupFields({ name: "", subject: "", schedule: "" }) === "name" && checkGroupFields({ name: "G", subject: " ", schedule: "Mon 15:00" }) === "subject"
    && checkGroupFields({ name: "G", subject: "Maths", schedule: "" }) === "schedule" && checkGroupFields({ name: "G", subject: "Maths", schedule: "Mon 15:00" }) === null);
  check("a partial change checks only the fields it gives (assigning a teacher can't be blocked by an old group's empty subject)",
    checkGroupFields({}) === null && checkGroupFields({ schedule: "Tue 10:00" }) === null && checkGroupFields({ subject: "" }) === "subject");
}

// ------------------------------------------------ 7. group history
{
  const never = { id: "s", groupId: "g1" };
  check("a student who never moved is simply in their current group, always", eq(periodsOf(never), [{ groupId: "g1", from: null, to: null }]));
  const moved = { ...never, groupId: "g2", groupHistory: moveInHistory(never, "g2", "2026-09-10") };
  check("moving ends the old period the DAY BEFORE and opens the new one that day — no day belongs to both", eq(moved.groupHistory, [{ groupId: "g1", from: null, to: "2026-09-09" }, { groupId: "g2", from: "2026-09-10", to: null }]));
  check("work in the old group belongs to the student only until the move; the new group's only from it",
    appliesToStudent(moved, "g1", "2026-09-05") && !appliesToStudent(moved, "g1", "2026-09-11") && !appliesToStudent(moved, "g2", "2026-09-05") && appliesToStudent(moved, "g2", "2026-09-11")
    && !appliesToStudent(moved, "g1", "2026-09-10") && appliesToStudent(moved, "g2", "2026-09-10"));
  check("work with no recorded date counts as theirs", appliesToStudent(moved, "g1", undefined));
  const out = { ...moved, groupId: null, groupHistory: moveInHistory(moved, null, "2026-09-20") };
  check("leaving every group closes the period and opens none", out.groupHistory.length === 2 && out.groupHistory[1].to === "2026-09-19" && periodsOf(out).every(p => p.to !== null));
  const back = { ...out, groupId: "g1", groupHistory: moveInHistory(out, "g1", "2026-10-01") };
  check("returning to a group later is a second period in it", back.groupHistory.filter(p => p.groupId === "g1").length === 2 && appliesToStudent(back, "g1", "2026-10-05") && !appliesToStudent(back, "g1", "2026-09-25"));
  check("a group set without recording history is still treated as current", periodsOf({ id: "s", groupId: "g3", groupHistory: [{ groupId: "g1", from: null, to: "2026-09-09" }] }).some(p => p.groupId === "g3" && p.to === null));
}

// ---- data layer: a student who moved from g1 to g2 on 10 Sep
{
  const g1 = { id: "g1", subject: "Mathematics", teacherId: "t1", schedule: "Mon/Wed/Fri 15:00", studentIds: [] };
  const g2 = { id: "g2", subject: "Mathematics", teacherId: "t2", schedule: "Tue/Thu 16:00", studentIds: ["s1"] };
  const aisha = { id: "s1", name: "Aisha", groupId: "g2", groupHistory: [{ groupId: "g1", from: null, to: "2026-09-09" }, { groupId: "g2", from: "2026-09-10", to: null }] };
  const umar = { id: "s2", name: "Umar", groupId: "g1" };                     // never moved; same group g1 as Aisha used to be
  const hw = (id, createdDate, dueDate = "2026-09-30") => ({ id, title: id, dueDate, createdDate });
  const world = (over = {}) => updateBridge({
    students: [aisha, umar], groups: [g1, g2], teachers: [{ id: "t1", name: "Malika" }, { id: "t2", name: "Sherzod" }],
    attendanceRecords: {
      g1: { "2026-09-03": { s1: { status: "P" }, s2: { status: "P" } }, "2026-09-07": { s1: { status: "L", lateBy: 9 }, s2: { status: "A" } } },
      g2: { "2026-09-15": { s1: { status: "P" } } },
    },
    homeworkRecords: { g1: [hw("g1-before", "2026-09-05"), hw("g1-after", "2026-09-12")], g2: [hw("g2-before", "2026-09-05"), hw("g2-after", "2026-09-12")] },
    gradesRecords: {}, homeworkSubmissions: {}, paymentsStatus: {}, paymentTransactions: {}, messageThreads: {}, currentDateStr: "2026-09-20", selectedStudentId: "s1", ...over,
  });

  world();
  const att = getAttendance("s1");
  check("attendance recorded in the OLD group before the move is still in the student's history", att.Sep.some(d => d.day === 3 && d.status === "P") && att.Sep.some(d => d.day === 7 && d.status === "L"), JSON.stringify(att.Sep.map(d => d.day)));
  check("…alongside the new group's: all three days are there, in date order", eq(att.Sep.map(d => d.day), [3, 7, 15]));
  check("each day shows the lesson of the group it was marked in (old: Malika, new: Sherzod)", att.Sep[0].teacher === "Malika" && att.Sep[2].teacher === "Sherzod", JSON.stringify(att.Sep.map(d => d.teacher)));
  check("a classmate who never moved still sees only their own marks", eq(getAttendance("s2").Sep.map(d => d.day), [3, 7]));

  const h = getHomework("s1");
  const ids = [...h.pending, ...h.history].map(x => x.id).sort();
  check("homework: what the OLD group was given while she was in it, and the NEW group's after she joined — nothing else",
    eq(ids, ["g1-before", "g2-after"]), JSON.stringify(ids));
  check("a student who never moved sees their group's work as before", eq([...getHomework("s2").pending, ...getHomework("s2").history].map(x => x.id).sort(), ["g1-after", "g1-before"]));

  // overdue reminders follow the same membership
  world({ currentDateStr: "2026-10-05" });
  const overdue = getNotifications("s1").filter(n => n.category === "homework").map(n => n.id).sort();
  check("overdue-homework reminders cover the same homework, and carry the STUDENT in the id", eq(overdue, ["hw-s1-g1-before", "hw-s1-g2-after"]), JSON.stringify(overdue));
  world();
  check("late arrivals recorded in the old group still raise their reminder", getNotifications("s1").some(n => n.id === "late-s1-2026-09-07"));

  // 5. siblings given the same assignment must not share a notification id
  const sib1 = { id: "aisha", name: "Aisha", groupId: "g1" }, sib2 = { id: "umar", name: "Umar", groupId: "g1" };
  world({ students: [sib1, sib2], groups: [g1], attendanceRecords: {}, homeworkRecords: { g1: [hw("shared", "2026-09-01", "2026-09-05")] } });
  const idA = getNotifications("aisha").find(n => n.category === "homework")?.id, idU = getNotifications("umar").find(n => n.category === "homework")?.id;
  check("two siblings in one group get DIFFERENT notification ids for the same assignment", idA && idU && idA !== idU && idA === "hw-aisha-shared" && idU === "hw-umar-shared", `${idA} / ${idU}`);

  // 8. the lesson as it was when marked
  world({ attendanceRecords: { g1: { "2026-09-03": { s1: { status: "P", lesson: { subject: "Algebra", teacher: "Old Teacher", time: "10:00" } } } } } });
  const stamped = getAttendance("s1").Sep[0];
  check("a mark stamped with its lesson keeps showing that lesson after the group's teacher/time change",
    stamped.teacher === "Old Teacher" && stamped.time === "10:00" && stamped.subject === "Algebra", JSON.stringify(stamped));
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("PASS — input rules, latest result, sibling notification ids, and a student's history across a group move");
