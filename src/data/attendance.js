import { MONTHS, CURRENT_MONTH, CURRENT_DAY } from "../constants/months.js";

const mathTopics = [
  "Fractions: introduction", "Adding fractions", "Multiplying fractions", "Word problems",
  "Decimals", "Fractions to decimals", "Mixed numbers", "Ratios", "Percentages",
  "Geometry basics", "Angles", "Area and perimeter", "Review and practice", "Practice test",
];
const englishTopics = [
  "Present Simple", "Past Simple", "Present Perfect", "Vocabulary: Travel",
  "Reading comprehension", "Writing practice", "Grammar review", "Listening exercise",
  "Speaking practice", "Vocabulary: Food", "Past Continuous", "Modal verbs", "Practice test",
];

function addMinutes(time, mins) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// Deterministic (seeded by month + student) so every month/child combination
// is stable across renders without needing to persist anything.
export function buildMonthDays(monthKey, studentSeed, receptionStaff, overrides = {}) {
  const seed = monthKey.charCodeAt(0) * 7 + monthKey.charCodeAt(1) * 3 + studentSeed * 11;
  const dayCount = monthKey === CURRENT_MONTH ? CURRENT_DAY : 28;
  const days = [];
  for (let i = 0; i < dayCount; i++) {
    const isMathDay = i % 2 === 0;
    const r = (seed * (i + 1)) % 17;
    let status = "P", lateBy = 0;
    if (r === 0) status = "A";
    else if (r === 1) { status = "L"; lateBy = 8; }
    else if (r === 2) { status = "L"; lateBy = 15; }
    const override = overrides[i + 1];
    if (override && override.status) { status = override.status; lateBy = override.lateBy || 0; }

    const scheduled = isMathDay ? "15:00" : "17:00";
    const scheduledEnd = isMathDay ? "16:30" : "18:00";
    const checkIn = status === "P" ? scheduled : status === "L" ? addMinutes(scheduled, lateBy) : null;
    const topicList = isMathDay ? mathTopics : englishTopics;
    const topicIdx = Math.floor(i / 2) % topicList.length;

    days.push({
      day: i + 1,
      subject: isMathDay ? "Mathematics" : "English",
      teacher: isMathDay ? "Nodira Yusupova" : "James Carter",
      time: `${scheduled}–${scheduledEnd}`,
      topic: topicList[topicIdx],
      status, lateBy, checkIn,
      checkedInBy: status !== "A" ? receptionStaff : null,
      noteTag: (override && override.noteTag) || undefined,
    });
  }
  return days;
}

// Aisha's current month (Sep) is hand-tuned so the two most recent late
// arrivals fall within the last 14 days — this is what makes the "recent
// lateness" insight genuinely trigger rather than being hardcoded true.
// KEPT WITHIN the now-truncated current-month range (days 1-CURRENT_DAY).
const aishaSepOverrides = {
  3: { status: "L", lateBy: 5 },
  6: { status: "L", lateBy: 9 },
};

function buildStudentAttendance(seed, overridesForCurrentMonth) {
  const data = {};
  MONTHS.forEach(m => {
    data[m] = buildMonthDays(m, seed, "Malika", m === "Sep" ? overridesForCurrentMonth : {});
  });
  return data;
}

export const attendanceByStudent = {
  aisha: buildStudentAttendance(1, aishaSepOverrides),
  umar: buildStudentAttendance(2, {}),
  "aisha-friend-1": buildStudentAttendance(3, {}),
  "aisha-friend-2": buildStudentAttendance(4, {}),
};

export function getAttendance(studentId) {
  if (attendanceByStudent[studentId]) return attendanceByStudent[studentId];
  // Unknown student — never show another child's real records; return an
  // empty-but-valid shape so callers can render an honest empty state.
  const empty = {};
  MONTHS.forEach(m => { empty[m] = []; });
  return empty;
}
