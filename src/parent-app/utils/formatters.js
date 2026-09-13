import { LOCALE_MAP } from "../constants/months.js";

export function formatDate(dateInput, lang, opts = {}) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const locale = LOCALE_MAP[lang] || "en-US";
  try {
    return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric", ...opts }).format(date);
  } catch {
    // Some browsers lack full uz-UZ locale data — fall back to a manual ISO-ish format.
    return date.toISOString().slice(0, 10);
  }
}

export function formatShortDate(dateInput, lang) {
  return formatDate(dateInput, lang, { month: "short", day: "numeric", year: undefined });
}

export function formatCurrency(amount, currency = "so'm", lang = "en") {
  const locale = LOCALE_MAP[lang] || "en-US";
  const formattedNumber = new Intl.NumberFormat(locale).format(amount);
  return `${formattedNumber} ${currency}`;
}

export function formatTime(dateInput, lang) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const locale = LOCALE_MAP[lang] || "en-US";
  try {
    return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(date);
  } catch {
    return date.toTimeString().slice(0, 5);
  }
}
