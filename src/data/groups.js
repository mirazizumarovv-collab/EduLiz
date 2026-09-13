import { students } from "./students.js";

export const groups = [
  { id: "g-math-7a", name: "Mathematics 7A", subject: "Mathematics", teacherId: "t-malika", schedule: "Mon/Wed/Fri 15:00", studentIds: students.filter(s => s.groupId === "g-math-7a").map(s => s.id) },
  { id: "g-math-4a", name: "Mathematics 4A", subject: "Mathematics", teacherId: "t-malika", schedule: "Tue/Thu 14:00", studentIds: students.filter(s => s.groupId === "g-math-4a").map(s => s.id) },
  { id: "g-eng-5c", name: "English 5C", subject: "English", teacherId: "t-sherzod", schedule: "Mon/Wed/Fri 16:00", studentIds: students.filter(s => s.groupId === "g-eng-5c").map(s => s.id) },
  { id: "g-eng-6b", name: "English 6B", subject: "English", teacherId: "t-sherzod", schedule: "Tue/Thu 16:30", studentIds: students.filter(s => s.groupId === "g-eng-6b").map(s => s.id) },
];

export function getGroup(id) {
  return groups.find(g => g.id === id) || null;
}
export function getGroupsForTeacher(teacherId) {
  return groups.filter(g => g.teacherId === teacherId);
}
