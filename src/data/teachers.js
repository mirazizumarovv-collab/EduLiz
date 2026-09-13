// groups[].teacherId is the single source of truth for who teaches what —
// deliberately no "groupIds" here, so there's nothing to keep in sync or
// let go stale when assignments change.
export const teachers = [
  { id: "t-malika", name: "Malika Yusupova", phone: "+998 90 111 22 33", subjects: ["Mathematics"] },
  { id: "t-sherzod", name: "Sherzod Aliyev", phone: "+998 90 222 33 44", subjects: ["English"] },
];

export function getTeacher(id) {
  return teachers.find(t => t.id === id) || null;
}
