// Mirrors the same student roster used in the parent-facing app, so demoing
// both apps side by side shows the same real students and data.
// `guardians` is the single source of truth for who has access to this
// student — each entry has its own name/phone/role, so a second guardian
// connecting via connectChild() is a real, distinct person, not just an
// anonymous phone number appended to someone else's name.
export const students = [
  { id: "aisha", name: "Aisha", grade: "Grade 7", groupId: "g-math-7a", guardians: [{ id: "g-dilnoza", name: "Dilnoza", phone: "+998 90 123 45 67", role: "Mother" }], connectionCode: null },
  { id: "umar", name: "Umar", grade: "Grade 4", groupId: "g-math-4a", guardians: [{ id: "g-dilnoza", name: "Dilnoza", phone: "+998 90 123 45 67", role: "Mother" }], connectionCode: null },
  { id: "aisha-friend-1", name: "Malika", grade: "Grade 5", groupId: "g-eng-5c", guardians: [{ id: "g-shahnoza", name: "Shahnoza", phone: "+998 90 555 12 34", role: "Mother" }], connectionCode: "REG-4821" },
  { id: "aisha-friend-2", name: "Sardor", grade: "Grade 6", groupId: "g-eng-6b", guardians: [{ id: "g-jasur", name: "Jasur", phone: "+998 90 777 88 99", role: "Father" }], connectionCode: "REG-1190" },
];

export function getStudent(id) {
  return students.find(s => s.id === id) || null;
}

// The primary guardian shown in Admin's lists (first one on record).
export function primaryGuardian(student) {
  return (student.guardians && student.guardians[0]) || null;
}
