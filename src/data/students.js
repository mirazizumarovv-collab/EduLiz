// The parent's own connected children. Every other data file (attendance,
// grades, homework, payments, notifications) is keyed by these student ids,
// so switching the selected child updates every screen consistently.
export const students = [
  { id: "aisha", name: "Aisha", grade: "Grade 7", group: "Group B", joinedMonth: "Mar", avatarColor: "#3A6EA5" },
  { id: "umar", name: "Umar", grade: "Grade 4", group: "Group A", joinedMonth: "Jan", avatarColor: "#6FA8DC" },
];

// A separate "registry" the center controls — a parent can only connect a
// child that already exists here, via a real code. This models requirement
// #9 (Connect a Child, not a free-form Add Child form).
export const connectableRegistry = [
  { code: "REG-4821", studentId: "aisha-friend-1", name: "Malika", grade: "Grade 5", group: "Group C", joinedMonth: "Sep" },
  { code: "REG-1190", studentId: "aisha-friend-2", name: "Sardor", grade: "Grade 6", group: "Group A", joinedMonth: "Aug" },
];
