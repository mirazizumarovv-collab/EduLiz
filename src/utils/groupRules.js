// A group's fields.
//
// The schedule is typed by an admin, so it is read leniently and SAVED in one
// canonical form that the rest of the app can rely on:
//
//     "Mon/Wed/Fri 15:00"         days joined by "/", a space, the start time
//     "Mon/Wed/Fri 15:00-16:30"   … optionally followed by an end time
//
// What is accepted as input:
//   days   English (Mon / Monday), Uzbek (Dush, Sesh, Chor, Pay, Juma, Shan,
//          Yak …) or Russian (Пн, Вт, Ср …), any case; separated by "/", ",",
//          "&" or spaces ("Mon, Wed, Fri"); a range with a hyphen ("Mon-Fri")
//   time   H:MM or HH:MM (00:00–23:59), optionally "- end" (end must be later)
// Whatever the language typed, the day names are saved as Mon/Tue/…, in week order.

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DAY_WORDS = [
  ["mon", "monday", "dush", "dushanba", "пн", "пон", "понедельник"],
  ["tue", "tues", "tuesday", "sesh", "seshanba", "вт", "вто", "вторник"],
  ["wed", "wednesday", "chor", "chorshanba", "ср", "сре", "среда"],
  ["thu", "thur", "thurs", "thursday", "pay", "payshanba", "чт", "чет", "четверг"],
  ["fri", "friday", "juma", "пт", "пят", "пятница"],
  ["sat", "saturday", "shan", "shanba", "сб", "суб", "суббота"],
  ["sun", "sunday", "yak", "yakshanba", "вс", "вос", "воскресенье"],
];
const DAY_INDEX = new Map(DAY_WORDS.flatMap((words, i) => words.map(w => [w, i])));
const dayIndex = (word) => DAY_INDEX.get(word.toLowerCase().replace(/[.’'`]/g, ""));

const pad2 = (n) => String(n).padStart(2, "0");
function parseTime(text) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? null : { h, min, text: `${pad2(h)}:${pad2(min)}`, total: h * 60 + min };
}

// { days: ["Mon","Wed","Fri"], start: "15:00", end: "16:30" | null }, or null if
// it can't be read as days + a start time.
export function parseSchedule(input) {
  const s = String(input ?? "").trim().replace(/[–—]/g, "-");
  // (lazy day part: the first time found ends it, so "Mon 15:00 - 16:30" is read as a time range)
  const m = /^(.*?\S)\s+(\d{1,2}:\d{2})(?:\s*-\s*(\d{1,2}:\d{2}))?$/.exec(s);
  if (!m) return null;

  const start = parseTime(m[2]);
  const end = m[3] === undefined ? null : parseTime(m[3]);
  if (!start || (m[3] !== undefined && (!end || end.total <= start.total))) return null;

  // "Mon - Fri" → "Mon-Fri"; then split on the list separators
  const tokens = m[1].replace(/\s*-\s*/g, "-").split(/[\s,/&;]+/).filter(Boolean);
  const picked = new Set();
  for (const token of tokens) {
    const ends = token.split("-");
    if (ends.length > 2) return null;
    const [from, to] = ends.map(dayIndex);
    if (from === undefined || (ends.length === 2 && (to === undefined || to < from))) return null;
    for (let d = from; d <= (ends.length === 2 ? to : from); d++) picked.add(d);
  }
  if (picked.size === 0) return null;
  return { days: [...picked].sort((a, b) => a - b).map(i => WEEKDAYS[i]), start: start.text, end: end ? end.text : null };
}

export function isValidSchedule(s) { return parseSchedule(s) !== null; }

// The canonical text to store, or null if it can't be read.
export function normalizeSchedule(s) {
  const p = parseSchedule(s);
  return p ? `${p.days.join("/")} ${p.start}${p.end ? `-${p.end}` : ""}` : null;
}

// When a class starts ("15:00"), or null. This is what attendance stamps and the
// parent's day detail show — it is NOT "whatever follows the last space", which
// would be "15:00-16:30" for a schedule with an end time.
export function scheduleStart(s) { return parseSchedule(s)?.start ?? null; }

// What is wrong with the group fields GIVEN, or null: "name" | "subject" |
// "schedule". Only the fields present are checked, so a partial change (say,
// assigning a teacher) is never blocked by some other field of an older group;
// creating a group passes all three.
export function checkGroupFields(fields) {
  if ("name" in fields && !String(fields.name ?? "").trim()) return "name";
  if ("subject" in fields && !String(fields.subject ?? "").trim()) return "subject";
  if ("schedule" in fields && !isValidSchedule(fields.schedule)) return "schedule";
  return null;
}
