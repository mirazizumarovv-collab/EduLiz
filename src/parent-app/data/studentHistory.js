// A student's history across every group they have been in. The data layer used
// to look only in their CURRENT group, so moving them hid everything recorded
// before the move (grades were already safe, being tied to their own assessment).
import { bridge } from "./liveBridge.js";
import { appliesToStudent, inPeriod, periodsOf } from "../../utils/groupHistory.js";

// The attendance marks that are this student's: made in a group's register on a
// day they were a member of that group — the same rule homework follows. A mark
// in some register for a day outside their membership (a sheet back-filled for a
// date before they joined, one left over from a stay that has ended) is not
// theirs and is not shown.
//
// One mark per day: a student is in one group at a time, so a date has at most
// one lesson for them. (Histories saved before periods stopped overlapping can
// still claim the same day for two groups; the later stay wins.)
// [{ groupId, dateStr, entry }]
export function attendanceMarksFor(studentId) {
  const student = bridge.students.find(s => s.id === studentId);
  if (!student) return [];
  const periods = periodsOf(student);
  const byDate = new Map();
  for (const [groupId, days] of Object.entries(bridge.attendanceRecords)) {
    for (const [dateStr, entries] of Object.entries(days)) {
      const entry = entries[studentId];
      if (!entry) continue;
      let stay = -1; // position of the latest period of this group that covers the day
      periods.forEach((p, i) => { if (p.groupId === groupId && inPeriod(p, dateStr)) stay = i; });
      if (stay < 0) continue;
      const seen = byDate.get(dateStr);
      if (!seen || stay > seen.stay) byDate.set(dateStr, { groupId, dateStr, entry, stay });
    }
  }
  return [...byDate.values()].map(({ stay, ...mark }) => mark);
}

// The homework that was theirs: given to a group while they were in it.
// [{ hw, groupId }], each assignment once.
export function homeworkFor(studentId) {
  const student = bridge.students.find(s => s.id === studentId);
  if (!student) return [];
  const seen = new Set();
  const out = [];
  for (const [groupId, list] of Object.entries(bridge.homeworkRecords)) {
    for (const hw of list) {
      if (seen.has(hw.id) || !appliesToStudent(student, groupId, hw.createdDate)) continue;
      seen.add(hw.id);
      out.push({ hw, groupId });
    }
  }
  return out;
}
