// What makes an attendance sheet acceptable to save. Pure, so the rules are
// the same wherever they're enforced (the form shows the reason; the data layer
// refuses regardless of which screen called it).
import { isValidISODate } from "./gradeModel.js";

export const LATE_BY_MIN = 1;
export const LATE_BY_MAX = 240; // minutes — longer than any class

// A late arrival's minutes as a whole number in range, or null if it isn't one.
// (An empty box, 0, a negative, a fraction and "abc" are all null — never
// quietly turned into some default.)
export function parseLateBy(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= LATE_BY_MIN && n <= LATE_BY_MAX ? n : null;
}

// Check one sheet: { date, entries, studentIds } with { today, earliest } bounds.
//   ok:true  → { entries } cleaned for storage
//   ok:false → { reason: "date" | "dateFuture" | "dateTooEarly" | "unmarked" | "lateBy", studentIds? , studentId? }
// Only the group's CURRENT students are checked; entries for anyone else (a
// student who has since moved to another group) are passed through untouched —
// re-saving an old date must not erase their record.
export function checkAttendance({ date, entries, studentIds }, bounds = {}) {
  if (!isValidISODate(date)) return { ok: false, reason: "date" };       // includes the empty string
  if (bounds.today && date > bounds.today) return { ok: false, reason: "dateFuture" };
  if (bounds.earliest && date < bounds.earliest) return { ok: false, reason: "dateTooEarly" };

  const unmarked = studentIds.filter(sid => !entries[sid]?.status);
  if (unmarked.length > 0) return { ok: false, reason: "unmarked", studentIds: unmarked };

  const clean = { ...entries };
  for (const sid of studentIds) {
    const e = entries[sid];
    if (e.status === "L") {
      const minutes = parseLateBy(e.lateBy);
      if (minutes === null) return { ok: false, reason: "lateBy", studentId: sid };
      clean[sid] = { ...e, lateBy: minutes };
    } else {
      const { lateBy, ...withoutMinutes } = e;                           // minutes only belong to a late arrival
      clean[sid] = withoutMinutes;
    }
  }
  return { ok: true, entries: clean };
}
