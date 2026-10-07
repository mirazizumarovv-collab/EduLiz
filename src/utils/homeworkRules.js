const norm = (s) => String(s ?? "").trim().toLowerCase();

// The same assignment already given to this group: same title (ignoring case
// and surrounding spaces) due the same day. `list` is that group's assignments.
export function findDuplicateHomework(list, { title, dueDate }) {
  return list.find(h => norm(h.title) === norm(title) && h.dueDate === dueDate) || null;
}

// The teacher's list, ordered the way the Parent sees the same work: what is
// still coming up first, soonest due on top; then what is past, most recent
// first. (A flat "newest created first" is a different order for no reason.)
export function orderForTeacher(list, today) {
  const upcoming = list.filter(h => h.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const past = list.filter(h => h.dueDate < today).sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  return [...upcoming, ...past];
}
