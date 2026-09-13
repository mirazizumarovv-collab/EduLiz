import { MONTHS } from "../constants/months.js";

export function attendanceRate(monthDays) {
  if (monthDays.length === 0) return null;
  const attended = monthDays.filter(d => d.status === "P" || d.status === "L").length;
  return Math.round((attended / monthDays.length) * 100);
}

export function longestPresentStreak(allMonthsDayData) {
  const allDays = MONTHS.flatMap(m => allMonthsDayData[m] || []);
  let longest = 0, run = 0;
  allDays.forEach(d => {
    run = (d.status === "P" || d.status === "L") ? run + 1 : 0;
    longest = Math.max(longest, run);
  });
  return longest;
}

export function currentPresentStreak(monthDays) {
  let streak = 0;
  for (let i = monthDays.length - 1; i >= 0; i--) {
    if (monthDays[i].status === "P" || monthDays[i].status === "L") streak++; else break;
  }
  return streak;
}

export function recentLateCount(monthDays, windowDays = 14) {
  return monthDays.slice(-windowDays).filter(d => d.status === "L").length;
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
export function groupComparisonLabel(childScore, classAvg) {
  const diff = childScore - classAvg;
  const pctDiff = Math.round((Math.abs(diff) / classAvg) * 100);
  if (Math.abs(diff) < 2) return { key: "atGroupAverage", pct: 0 };
  if (diff > 0) return { key: "aboveGroupAverage", pct: pctDiff };
  return { key: "belowGroupAverage", pct: pctDiff };
}

export function monthOverMonthDelta(monthlySeries) {
  if (monthlySeries.length < 2) return 0;
  return monthlySeries[monthlySeries.length - 1].score - monthlySeries[monthlySeries.length - 2].score;
}

export function overallGrowth(monthlySeries) {
  const start = monthlySeries[0].score;
  const now = monthlySeries[monthlySeries.length - 1].score;
  return { start, now, deltaPct: Math.round(((now - start) / start) * 100) };
}

// Tiered good/medium/bad color for any percentage-style result. Always pair
// with a text label or icon elsewhere — never rely on color alone.
export function scoreColor(theme, value, thresholds = [60, 80]) {
  const c = theme.colors;
  if (value >= thresholds[1]) return c.good;
  if (value >= thresholds[0]) return c.medium;
  return c.bad;
}

// Days until (positive) or past (negative) a payment deadline, using the
// app's fixed demo "today" rather than the real device clock — swap
// CURRENT_DATE_STR for a live value once this is wired to a real backend.
export function daysUntilPaymentDue(deadlineISO, currentDateStr) {
  const oneDay = 86400000;
  return Math.round((new Date(deadlineISO) - new Date(currentDateStr)) / oneDay);
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
