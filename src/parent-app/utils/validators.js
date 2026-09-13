export function isValidPhone(value) {
  return /^\+?\d[\d\s-]{7,14}\d$/.test(value.trim());
}

export function isValidPin(value) {
  return /^\d{4}$/.test(value);
}

export function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateConnectChildForm({ studentId, invitationCode, parentCode }) {
  const errors = {};
  if (!isNonEmpty(studentId)) errors.studentId = "required";
  if (!isNonEmpty(invitationCode)) errors.invitationCode = "required";
  if (!isNonEmpty(parentCode)) errors.parentCode = "required";
  return { valid: Object.keys(errors).length === 0, errors };
}
