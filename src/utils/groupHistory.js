// Which groups a student has belonged to, and when.
//
// A student record holds only their CURRENT groupId, so moving them used to
// make everything recorded in their old group unreachable from their own
// history. `groupHistory` keeps the trail: [{ groupId, from, to }], where `from`
// / `to` are the first / last day of that membership (null = open ended).
// A student who has never moved has no groupHistory and is simply "in their
// current group, always".
//
// A day belongs to ONE group. Periods never overlap, so a given date can't be
// "in" two groups and the same lesson day can't show up twice in a history:
//   • a move takes effect at the START of the day it is made — the old period
//     ends the day before, the new one begins that day;
//   • except when the student was already marked in the old group that day
//     (they attended its lesson before the move): that day stays with the old
//     group and the new one begins the day after.
import { addDaysISO } from "./clock.js";

export function periodsOf(student) {
  const periods = (student.groupHistory ? [...student.groupHistory] : []);
  if (!student.groupHistory && student.groupId) return [{ groupId: student.groupId, from: null, to: null }];
  // a group set by some path that didn't record history is still the current one
  if (student.groupId && !periods.some(p => p.groupId === student.groupId && p.to === null)) {
    periods.push({ groupId: student.groupId, from: null, to: null });
  }
  return periods;
}

// A period that ends before it begins — the trace of a student moved twice on
// the same day — covers no days at all.
const isEmpty = (p) => p.from !== null && p.to !== null && p.to < p.from;

// Two back-to-back (or overlapping) periods of the same group are one stay —
// e.g. moved to another group and straight back on the same day.
function mergeStays(periods) {
  const out = [];
  for (const p of periods) {
    const prev = out[out.length - 1];
    if (prev && prev.groupId === p.groupId && prev.to !== null && (p.from === null || p.from <= addDaysISO(prev.to, 1))) {
      out[out.length - 1] = { ...prev, to: p.to };
    } else out.push(p);
  }
  return out;
}

// The history after moving the student to `newGroupId` (null = out of any group)
// on `today`. Pass `{ markedToday: true }` when the student has already been
// marked in the group they are leaving today (see the rule above).
export function moveInHistory(student, newGroupId, today, { markedToday = false } = {}) {
  const lastDay = markedToday ? today : addDaysISO(today, -1);
  const firstDay = markedToday ? addDaysISO(today, 1) : today;
  const closed = periodsOf(student).map(p => (p.to === null ? { ...p, to: lastDay } : p));
  const next = newGroupId ? [...closed, { groupId: newGroupId, from: firstDay, to: null }] : closed;
  return mergeStays(next.filter(p => !isEmpty(p)));
}

// The student after being moved to `toGroupId` (null / "" = out of any group).
// Moving a student into the group they are already in is not a move: they come
// back untouched (the very same object), with no closed-and-reopened period.
export function moveStudent(student, toGroupId, today, options) {
  const newGroupId = toGroupId || null;
  if ((student.groupId || null) === newGroupId) return student;
  return { ...student, groupId: newGroupId, groupHistory: moveInHistory(student, newGroupId, today, options) };
}

export const inPeriod = (period, isoDate) => (!period.from || isoDate >= period.from) && (!period.to || isoDate <= period.to);

// Was work created on `createdDate` in `groupId` given while this student was in it?
// (Work with no recorded date is treated as theirs.)
export function appliesToStudent(student, groupId, createdDate) {
  return periodsOf(student).some(p => p.groupId === groupId && (!createdDate || inPeriod(p, createdDate)));
}
