// Plain unit checks (no browser) for:
//   • the group schedule: read leniently, saved in one canonical form
//   • group history: periods never overlap (the day of a move belongs to ONE group)
//   • a student's attendance marks: only their own membership, one per day,
//     with a real "checked in by"
import { parseSchedule, normalizeSchedule, scheduleStart, isValidSchedule } from "../src/utils/groupRules.js";
import { periodsOf, moveInHistory, moveStudent, appliesToStudent } from "../src/utils/groupHistory.js";
import { dictionaries } from "../src/i18n/index.js";
import { updateBridge } from "../src/parent-app/data/liveBridge.js";
import { attendanceMarksFor } from "../src/parent-app/data/studentHistory.js";
import { getAttendance } from "../src/parent-app/data/attendance.js";

let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) { failures++; console.log(`FAIL — ${name}${detail ? "  → " + detail : ""}`); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------ the group schedule
{
  const norm = (s) => normalizeSchedule(s);
  check("the three spellings that used to be refused are accepted", ["Mon/Wed/Fri 15:00-16:30", "Monday 15:00", "Mon, Wed, Fri 15:00"].every(isValidSchedule));
  check("…and saved in the canonical form (days joined by /, start time, optional -end)",
    norm("Mon/Wed/Fri 15:00-16:30") === "Mon/Wed/Fri 15:00-16:30" && norm("Monday 15:00") === "Mon 15:00" && norm("Mon, Wed, Fri 15:00") === "Mon/Wed/Fri 15:00");
  check("the canonical form is stable: normalising it again changes nothing",
    ["Mon/Wed/Fri 15:00", "Tue/Thu 14:00", "Sat 09:30", "Mon/Fri 15:00-16:30"].every(s => norm(s) === s));
  check("case, spacing and a one-digit hour don't matter", norm("  mon/wed   9:05 ") === "Mon/Wed 09:05" && norm("MONDAY,  WEDNESDAY 15:00") === "Mon/Wed 15:00");
  check("days are saved in week order, once each", norm("Fri/Mon 10:00") === "Mon/Fri 10:00" && norm("Mon/Mon/Mon 10:00") === "Mon 10:00");
  check("'&', ';' and spaces separate days too", norm("Mon & Wed 10:00") === "Mon/Wed 10:00" && norm("Mon Wed Fri 10:00") === "Mon/Wed/Fri 10:00" && norm("Tue; Thu 10:00") === "Tue/Thu 10:00");
  check("a range of days: Mon-Fri, Mon - Wed, Thu-Sat/Sun", norm("Mon-Fri 15:00") === "Mon/Tue/Wed/Thu/Fri 15:00" && norm("Mon - Wed 15:00") === "Mon/Tue/Wed 15:00" && norm("Thu-Sat/Sun 15:00") === "Thu/Fri/Sat/Sun 15:00");
  check("the end time may be spaced or use an en dash", norm("Mon 15:00 - 16:30") === "Mon 15:00-16:30" && norm("Mon 15:00–16:30") === "Mon 15:00-16:30" && norm("Mon 15:00—16:30") === "Mon 15:00-16:30");
  check("Uzbek day names are read (what the Uzbek placeholder suggests)", norm("Dush/Chor/Juma 15:00") === "Mon/Wed/Fri 15:00" && norm("Sesh, Pay 14:00") === "Tue/Thu 14:00" && norm("Shan/Yak 10:00") === "Sat/Sun 10:00");
  check("Russian day names are read (what the Russian placeholder suggests)", norm("Пн/Ср/Пт 15:00") === "Mon/Wed/Fri 15:00" && norm("вт, чт 14:00") === "Tue/Thu 14:00" && norm("Сб/Вс 10:00") === "Sat/Sun 10:00");

  const bad = ["", "   ", "15:00", "Mon", "Mon/Wed/Fri", "Mon 3pm", "Mon 24:00", "Mon 15:60", "Mon 15:5", "Funday 15:00", "Mon/Foo 15:00",
    "Fri-Mon 10:00", "Mon-Tue-Wed 10:00", "Mon - 10:00", "Mon 10:00-09:00", "Mon 10:00-10:00", "Mon 10:00 11:00", "Mon 10:00-", "Mon 10:00-25:00", null, undefined, 5];
  check("what can't be read as days + a start time is refused", bad.every(s => !isValidSchedule(s) && normalizeSchedule(s) === null), JSON.stringify(bad.filter(s => isValidSchedule(s))));

  check("the start time is the START — not the end, and not 'whatever follows the last space'",
    scheduleStart("Mon/Wed/Fri 15:00-16:30") === "15:00" && scheduleStart("Mon, Wed, Fri 09:05") === "09:05" && scheduleStart("Mon 15:00 - 16:30") === "15:00" && scheduleStart("nonsense") === null && scheduleStart(undefined) === null);
  // what each language's own form hint and refusal message give as examples must be accepted
  const examples = (text) => [...text.matchAll(/(\S+) (\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?)(?!\S)/g)].map(m => `${m[1]} ${m[2]}`);
  for (const [lang, d] of Object.entries(dictionaries)) {
    const hint = examples(d.schedulePlaceholder), refusal = examples(d.errorGroupSchedule);
    check(`the ${lang} form hint ("${d.schedulePlaceholder}") is itself a valid schedule`, hint.length === 1 && hint.every(isValidSchedule), JSON.stringify(hint));
    check(`every example in the ${lang} refusal message ("${d.errorGroupSchedule}") is valid`, refusal.length >= 1 && refusal.every(isValidSchedule), JSON.stringify(refusal));
  }
  check("parseSchedule gives days, start and end", eq(parseSchedule("Tue/Thu 14:00-15:30"), { days: ["Tue", "Thu"], start: "14:00", end: "15:30" }) && eq(parseSchedule("Tue 14:00"), { days: ["Tue"], start: "14:00", end: null }));
}

// ------------------------------------------------ group history: one group per day
const noOverlap = (periods) => periods.every((p, i) => i === 0 || (periods[i - 1].to !== null && p.from !== null && periods[i - 1].to < p.from));
{
  const s0 = { id: "s", groupId: "A" };
  const moved = moveInHistory(s0, "B", "2026-10-10");
  check("a move ends the old period the DAY BEFORE and starts the new one that day", eq(moved, [{ groupId: "A", from: null, to: "2026-10-09" }, { groupId: "B", from: "2026-10-10", to: null }]));
  check("so the day of the move is in exactly one group", appliesToStudent({ id: "s", groupId: "B", groupHistory: moved }, "B", "2026-10-10") && !appliesToStudent({ id: "s", groupId: "B", groupHistory: moved }, "A", "2026-10-10"));
  check("the day before a month / year boundary is worked out on the calendar", moveInHistory(s0, "B", "2026-10-01")[0].to === "2026-09-30" && moveInHistory(s0, "B", "2027-01-01")[0].to === "2026-12-31" && moveInHistory(s0, "B", "2028-03-01")[0].to === "2028-02-29");

  const markedToday = moveInHistory(s0, "B", "2026-10-10", { markedToday: true });
  check("already marked in the old group today → today stays there, the new group begins tomorrow",
    eq(markedToday, [{ groupId: "A", from: null, to: "2026-10-10" }, { groupId: "B", from: "2026-10-11", to: null }]) && noOverlap(markedToday));

  // a student moved by mistake and straight back leaves no trace
  const there = { id: "s", groupId: "B", groupHistory: moved };
  const backSameDay = moveInHistory(there, "A", "2026-10-10");
  check("moved to another group and back on the same day: no empty stay, one unbroken stay in the original group", eq(backSameDay, [{ groupId: "A", from: null, to: null }]), JSON.stringify(backSameDay));
  const backMarked = moveInHistory({ id: "s", groupId: "B", groupHistory: markedToday }, "A", "2026-10-10");
  check("…also when today had already been marked in the first group", eq(backMarked, [{ groupId: "A", from: null, to: null }]), JSON.stringify(backMarked));

  const twice = moveInHistory(there, "C", "2026-10-10");
  check("moved twice on one day: the middle group never had a day, so it is not in the history", eq(twice.map(p => p.groupId), ["A", "C"]) && noOverlap(twice), JSON.stringify(twice));

  // moving into the group they are already in is not a move
  const stay = { id: "s", groupId: "A" }, stayHist = { id: "s", groupId: "B", groupHistory: moved };
  check("moveStudent into the same group returns the student untouched — no history is created or reshaped",
    moveStudent(stay, "A", "2026-10-10") === stay && moveStudent(stayHist, "B", "2026-10-20") === stayHist && !("groupHistory" in moveStudent(stay, "A", "2026-10-10")));
  check("…also for 'no group' to 'no group' (null, undefined and \"\" all mean none)", [null, undefined, ""].every(g => { const x = { id: "s", groupId: g }; return moveStudent(x, null, "2026-10-10") === x && moveStudent(x, "", "2026-10-10") === x; }));
  check("a real move through moveStudent sets the group and the history together",
    eq(moveStudent(stay, "B", "2026-10-10"), { id: "s", groupId: "B", groupHistory: moved }) && moveStudent(stayHist, "", "2026-10-20").groupId === null);

  const out = moveInHistory(there, null, "2026-10-20");
  check("leaving every group ends the stay the day before and opens nothing", eq(out[1], { groupId: "B", from: "2026-10-10", to: "2026-10-19" }) && out.length === 2);
  check("a student with no group joining one: nothing to close", eq(moveInHistory({ id: "s", groupId: null }, "A", "2026-10-10"), [{ groupId: "A", from: "2026-10-10", to: null }]));

  // property: any sequence of moves on non-decreasing days never overlaps, and every day has at most one group
  let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  let ok = true, detail = "";
  for (let trial = 0; trial < 300 && ok; trial++) {
    let st = { id: "s", groupId: ["A", null][rnd(2)] }, day = 1 + rnd(5);
    for (let step = 0; step < 8; step++) {
      day += rnd(3);                                                    // 0 → the same day again
      const to = ["A", "B", "C", null][rnd(4)];
      if ((st.groupId || null) === to) continue;
      const hist = moveInHistory(st, to, `2026-10-${String(day).padStart(2, "0")}`, { markedToday: rnd(2) === 0 });
      st = { ...st, groupId: to, groupHistory: hist };
      const ps = periodsOf(st).filter(p => p.to !== null || true);
      for (let d = 1; d <= 31; d++) {
        const date = `2026-10-${String(d).padStart(2, "0")}`;
        const n = ["A", "B", "C"].filter(g => appliesToStudent(st, g, date)).length;
        if (n > 1) { ok = false; detail = `${date} in ${n} groups after ${JSON.stringify(hist)}`; }
      }
      if (hist.some(p => p.to !== null && p.from !== null && p.to < p.from)) { ok = false; detail = "empty period kept " + JSON.stringify(hist); }
    }
  }
  check("property: over 300 random sequences of moves (incl. the same day), no day is in two groups and no empty period is kept", ok, detail);
}

// ------------------------------------------------ the student's attendance marks
{
  const g1 = { id: "g1", subject: "Mathematics", teacherId: "t1", schedule: "Mon/Wed/Fri 15:00-16:30", studentIds: [] };
  const g2 = { id: "g2", subject: "English", teacherId: "t2", schedule: "Tue/Thu 16:00", studentIds: ["s1"] };
  const teachers = [{ id: "t1", name: "Malika" }, { id: "t2", name: "Sherzod" }];
  const world = (students, attendanceRecords) => updateBridge({
    students, groups: [g1, g2], teachers, attendanceRecords, gradesRecords: {}, homeworkRecords: {}, homeworkSubmissions: {},
    paymentsStatus: {}, paymentTransactions: {}, messageThreads: {}, currentDateStr: "2026-10-20", selectedStudentId: "s1",
  });
  const days = (id) => getAttendance(id).Oct.map(d => d.day);

  // moved on 10 Oct, under the current rule (old stay ends the 9th)
  const aisha = { id: "s1", name: "Aisha", groupId: "g2", groupHistory: [{ groupId: "g1", from: null, to: "2026-10-09" }, { groupId: "g2", from: "2026-10-10", to: null }] };
  world([aisha], { g1: { "2026-10-08": { s1: { status: "P" } }, "2026-10-10": { s1: { status: "P" } } }, g2: { "2026-10-10": { s1: { status: "A" } }, "2026-10-15": { s1: { status: "P" } } } });
  check("the same date in two groups' registers is ONE day in her history (the group she was in that day)", eq(days("s1"), [8, 10, 15]), JSON.stringify(days("s1")));
  check("…and it is the mark of the group she was in on the 10th (English, absent), not Mathematics", getAttendance("s1").Oct.find(d => d.day === 10).status === "A" && getAttendance("s1").Oct.find(d => d.day === 10).subject === "English");

  // a history saved by the OLD rule: both groups claim the 10th
  const legacy = { ...aisha, groupHistory: [{ groupId: "g1", from: null, to: "2026-10-10" }, { groupId: "g2", from: "2026-10-10", to: null }] };
  world([legacy], { g1: { "2026-10-10": { s1: { status: "P" } } }, g2: { "2026-10-10": { s1: { status: "L", lateBy: 5 } } } });
  const m = attendanceMarksFor("s1");
  check("a history saved before periods stopped overlapping still gives one mark for the day — the later stay's", m.length === 1 && m[0].groupId === "g2" && m[0].entry.status === "L", JSON.stringify(m));
  const sameDay = getAttendance("s1").Oct;
  check("no day appears twice in the month the parent sees", new Set(sameDay.map(d => d.day)).size === sameDay.length);

  // marks outside her membership are not hers
  world([aisha], { g2: { "2026-10-02": { s1: { status: "P" } }, "2026-10-12": { s1: { status: "P" } } }, g1: { "2026-10-12": { s1: { status: "P" } }, "2026-10-05": { s1: { status: "L", lateBy: 3 } } } });
  check("a sheet back-filled in g2 for a day before she joined, and one in g1 after she left, are not shown", eq(days("s1"), [5, 12]), JSON.stringify(days("s1")));
  check("…so they don't raise late reminders or count in her rate either (same source)", attendanceMarksFor("s1").every(x => x.dateStr !== "2026-10-02"));

  // a student who never moved sees every mark in their group
  const umar = { id: "s2", name: "Umar", groupId: "g1" };
  world([umar], { g1: { "2026-10-01": { s2: { status: "P" } }, "2026-10-06": { s2: { status: "A" } } }, g2: { "2026-10-06": { s2: { status: "P" } } } });
  check("a student who never moved: all their group's marks (and a stray mark in a group they never joined is ignored)", eq(days("s2"), [1, 6]) && getAttendance("s2").Oct.find(d => d.day === 6).status === "A");
  check("an unknown student has no marks", eq(attendanceMarksFor("nobody"), []));

  // "checked in by" is whoever took the register — nothing is made up
  world([umar], { g1: {
    "2026-10-01": { s2: { status: "P", markedBy: { role: "teacher", name: "Malika Karimova" } } },
    "2026-10-02": { s2: { status: "L", lateBy: 7, markedBy: { role: "teacher", name: "Cover Teacher" } } },
    "2026-10-03": { s2: { status: "A", markedBy: { role: "teacher", name: "Malika Karimova" } } },
    "2026-10-04": { s2: { status: "P" } },                                        // saved before the stamp existed
  } });
  const by = Object.fromEntries(getAttendance("s2").Oct.map(d => [d.day, d.checkedInBy]));
  check("present/late: the teacher who took the register; absent: nobody checked in", by[1] === "Malika Karimova" && by[2] === "Cover Teacher" && by[3] === null, JSON.stringify(by));
  check("an older record without the stamp has no name — not an invented 'Front desk'", by[4] === null && !JSON.stringify(getAttendance("s2")).includes("Front desk"));

  // a stamped lesson time with an end time, and the schedule fallback for an unstamped mark
  world([umar], { g1: { "2026-10-01": { s2: { status: "P" } }, "2026-10-02": { s2: { status: "L", lateBy: 10, lesson: { subject: "Mathematics", teacher: "Malika", time: "15:00" } } } } });
  const t = Object.fromEntries(getAttendance("s2").Oct.map(d => [d.day, d]));
  check("a group whose schedule has an end time still gives the START as the lesson time (15:00, not 15:00-16:30)", t[1].time === "15:00" && t[1].checkIn === "15:00", JSON.stringify(t[1]));
  check("a late arrival's check-in is the start plus the minutes late", t[2].checkIn === "15:10");
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("PASS — schedule parsing, one group per day in a student's history, their own attendance marks, and a real 'checked in by'");
