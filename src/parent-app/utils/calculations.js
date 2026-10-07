import { daysBetweenISO } from "../../utils/clock.js";

// The subject whose most recent assessment is the newest of all — "Latest
// result". (The list of subjects is in the order each was FIRST assessed, so
// its first item is the one assessed longest ago, not the one assessed last.)
// On a tie the earlier item in the list wins. null when there are none.
export function mostRecentSubject(subjects) {
  let best = null;
  for (const s of subjects) {
    if (!best || s.lastAssessment.date > best.lastAssessment.date) best = s;
  }
  return best;
}

export function attendanceRate(monthDays) {
  if (monthDays.length === 0) return null;
  const attended = monthDays.filter(d => d.status === "P" || d.status === "L").length;
  return Math.round((attended / monthDays.length) * 100);
}

// Both streak functions count consecutive RECORDED class sessions, not
// consecutive calendar days — this is a tutoring center with scheduled
// sessions (e.g. Mon/Wed/Fri), not daily school, so "Sep 1, Sep 5, Sep 6"
// being the only three sessions held is correctly a 3-session streak even
// though the calendar dates between them aren't contiguous. If the center
// ever needs a genuine calendar-day streak instead, that's a different
// calculation (comparing actual dates, not just record order).
// Both functions sort each month's days by day-of-month themselves rather
// than trusting the caller's array order — getAttendance() happens to sort
// before returning, but a streak calculation silently depending on that
// elsewhere is a real risk if a future data source hands days in a
// different order (e.g. insertion order from a database query).
// The months arrive oldest-first (getAttendance builds them from the window of
// months ending with the current one, which can run across a year end — Jul…Jan —
// so "Jan" is the LAST month, not the first); each month's days are sorted here.
function chronologicalDays(allMonthsDayData) {
  return Object.values(allMonthsDayData).flatMap(days => (days || []).slice().sort((a, b) => a.day - b.day));
}

export function longestPresentStreak(allMonthsDayData) {
  const allDays = chronologicalDays(allMonthsDayData);
  let longest = 0, run = 0;
  allDays.forEach(d => {
    run = (d.status === "P" || d.status === "L") ? run + 1 : 0;
    longest = Math.max(longest, run);
  });
  return longest;
}

// Takes the FULL multi-month record set (not just the current month) so a
// streak that started in a previous month keeps counting instead of being
// reset to 0 on the 1st of a new month.
export function currentPresentStreak(allMonthsDayData) {
  const allDays = chronologicalDays(allMonthsDayData);
  let streak = 0;
  for (let i = allDays.length - 1; i >= 0; i--) {
    if (allDays[i].status === "P" || allDays[i].status === "L") streak++; else break;
  }
  return streak;
}

export function recentLateCount(allMonthsDayData, windowDays = 14) {
  return chronologicalDays(allMonthsDayData).slice(-windowDays).filter(d => d.status === "L").length;
}

export function homeworkStats(pending, history) {
  const total = pending.length + history.length;
  if (total === 0) return { completionRate: 0, onTimeRate: 0, total: 0, completed: 0, pending: 0, overdue: 0 };
  const completed = history.filter(h => h.status === "completed").length;
  const overdue = history.filter(h => h.status === "overdue").length;
  // Genuine on-time rate: among resolved assignments (completed + overdue),
  // how many were actually done by their deadline. A completed item counts
  // as on-time unless explicitly flagged `onTime: false` (submitted late);
  // an overdue item is never on-time by definition.
  const onTimeCount = history.filter(h => h.status === "completed" && h.onTime !== false).length;
  return {
    completionRate: Math.round((completed / total) * 100),
    onTimeRate: history.length > 0 ? Math.round((onTimeCount / history.length) * 100) : 0,
    total, completed, pending: pending.length, overdue,
  };
}

export function trendArrow(delta) {
  if (delta > 0) return { symbol: "▲", label: `+${delta}`, direction: "up" };
  if (delta < 0) return { symbol: "▼", label: `${delta}`, direction: "down" };
  return { symbol: "→", label: "0", direction: "flat" };
}

// PRIVACY: this is the only comparison surface in the whole app. It never
// receives or exposes other students' names or individual scores — only a
// single anonymous aggregate (classAvg) that the center supplies per subject.
// Returns a bucketed, non-numeric-rank label per the "no exact ranking" rule.
export function groupComparisonLabel(childScore, classAvg, hasComparison = true) {
  if (!hasComparison) return { key: "noComparisonData", pct: 0 };
  const diff = childScore - classAvg;
  if (Math.abs(diff) < 2) return { key: "atGroupAverage", pct: 0 };
  // classAvg === 0 makes a percentage DIFFERENCE undefined (there's nothing
  // to take a percentage OF) — direction (above/below) is still real and
  // worth stating, but the magnitude isn't a meaningful percentage. pct:
  // null signals "don't show a percentage" rather than a false "by 0%".
  const pctDiff = classAvg > 0 ? Math.round((Math.abs(diff) / classAvg) * 100) : null;
  if (diff > 0) return { key: "aboveGroupAverage", pct: pctDiff };
  return { key: "belowGroupAverage", pct: pctDiff };
}

export function monthOverMonthDelta(monthlySeries) {
  if (monthlySeries.length < 2) return 0;
  return monthlySeries[monthlySeries.length - 1].score - monthlySeries[monthlySeries.length - 2].score;
}

export function overallGrowth(monthlySeries) {
  if (monthlySeries.length === 0) return { start: null, now: null, deltaPct: 0 };
  const start = monthlySeries[0].score;
  const now = monthlySeries[monthlySeries.length - 1].score;
  return { start, now, deltaPct: start > 0 ? Math.round(((now - start) / start) * 100) : 0 };
}

// Tiered good/medium/bad color for any percentage-style result. Always pair
// with a text label or icon elsewhere — never rely on color alone.
export function scoreColor(theme, value, thresholds = [60, 80]) {
  const c = theme.colors;
  if (value >= thresholds[1]) return c.good;
  if (value >= thresholds[0]) return c.medium;
  return c.bad;
}

// Days until (positive) or past (negative) a payment deadline, counted on the
// calendar dates themselves (no clock or time zone involved).
export function daysUntilPaymentDue(deadlineISO, currentDateStr) {
  return daysBetweenISO(currentDateStr, deadlineISO);
}

// Quiet hours suppress alert-style UI and non-critical notifications during
// the configured window, handling overnight ranges like 22:00 -> 07:00.
export function isQuietHoursNow(quietHours, currentTimeStr) {
  if (!quietHours.enabled) return false;
  const toMinutes = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  const now = toMinutes(currentTimeStr);
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === end) return false;
  return start < end ? (now >= start && now < end) : (now >= start || now < end);
}
const QUIET_HOURS_CRITICAL_CATEGORIES = ["attendance"];
export function isSuppressedByQuietHours(category, quietHours, currentTimeStr) {
  return isQuietHoursNow(quietHours, currentTimeStr) && !QUIET_HOURS_CRITICAL_CATEGORIES.includes(category);
}

// The ONE place that decides whether a notification counts toward any
// "unread" badge/count shown anywhere in the app (header bell, child
// switcher, etc.) — respects category preferences, deletion, read state,
// AND quiet hours. Any new unread-count display should call this instead
// of re-deriving the same filter, so quiet hours can never be forgotten
// in one spot while working in another.
export function getAlertableUnreadCount(notifications, notifPrefs, quietHours, currentTimeStr, readNotifIds, deletedNotifIds) {
  return notifications.filter(n =>
    notifPrefs[n.category] &&
    !deletedNotifIds.has(n.id) &&
    !n.read && !readNotifIds.has(n.id) &&
    !isSuppressedByQuietHours(n.category, quietHours, currentTimeStr)
  ).length;
}
