// Shared phone helpers. Phones are compared by digits only, so
// "+998 90 123 45 67" and "+998901234567" are recognized as the same person.
export const normPhone = (p) => String(p || "").replace(/\D/g, "");
export const samePhone = (a, b) => normPhone(a) !== "" && normPhone(a) === normPhone(b);

// Formats what the user types into "+998 90 123 45 67". Handles a pasted
// number with or without the country code, and never doubles the prefix.
export function formatUzPhone(input) {
  let digits = normPhone(input);
  if (digits.startsWith("998")) digits = digits.slice(3);
  digits = digits.slice(0, 9);
  if (digits.length === 0) return "";
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean);
  return `+998 ${parts.join(" ")}`;
}

// A valid Uzbek mobile number has exactly 9 digits AFTER the country code
// (90 123 45 67) — checking normPhone()'s raw length directly would demand
// 9 digits total and reject every correctly-formatted "+998..." number,
// which is always 12 digits once normalized.
export function isValidUzPhone(input) {
  let digits = normPhone(input);
  if (digits.startsWith("998")) digits = digits.slice(3);
  return digits.length === 9;
}
