// Mirrors the same student roster used in the parent-facing app, so demoing
// both apps side by side shows the same real students and data.
export const students = [
  { id: "aisha", name: "Aisha", grade: "Grade 7", groupId: "g-math-7a", guardianName: "Dilnoza", guardianPhone: "+998 90 123 45 67", connectionCode: null },
  { id: "umar", name: "Umar", grade: "Grade 4", groupId: "g-math-4a", guardianName: "Dilnoza", guardianPhone: "+998 90 123 45 67", connectionCode: null },
  { id: "aisha-friend-1", name: "Malika", grade: "Grade 5", groupId: "g-eng-5c", guardianName: "Shahnoza", guardianPhone: "+998 90 555 12 34", connectionCode: "REG-4821" },
  { id: "aisha-friend-2", name: "Sardor", grade: "Grade 6", groupId: "g-eng-6b", guardianName: "Jasur", guardianPhone: "+998 90 777 88 99", connectionCode: "REG-1190" },
];

export function getStudent(id) {
  return students.find(s => s.id === id) || null;
}
