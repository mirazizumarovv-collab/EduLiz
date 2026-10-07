// The grade data model.
//
//   Assessment  { id, groupId, subject, title, date, maxScore }
//   Grade       { assessmentId, studentId, score }
//   gradeStore  { assessments: Assessment[], grades: Grade[] }
//
// One assessment is ONE test given to ONE group on ONE date; each student's
// score is its own Grade row pointing at the assessment by id. Anything that
// needs to know "which test is this" — class average, history, analytics,
// notifications, exports — keys off assessment.id, never off a title.
//
// The earlier model stored a flat list of entries per student and tried to
// recognise "the same test" by matching subject + title + date (+ groupId).
// That worked for the common case but left real ambiguity: a test saved twice,
// a retake that reuses a title, a student moved to another group. With an id
// there is nothing to infer.
//
// Everything here is a pure function of its inputs (no React, no storage), so
// the rules are testable on their own — see e2e/35-grade-model-unit.mjs.

const norm = (s) => String(s ?? "").trim().toLowerCase();

// A real calendar date written YYYY-MM-DD ("2026-02-30" is not one).
export function isValidISODate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// One typed score against the max: { ok: true, value } or
// { ok: false, reason: "negative" | "aboveMax" | "notNumber" }. A score is
// never silently changed to fit — 25 out of 20 is refused, not saved as 20.
export function checkScore(raw, maxScore) {
  if (raw === "" || raw === null || raw === undefined) return { ok: false, reason: "notNumber" };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, reason: "notNumber" };
  if (n < 0) return { ok: false, reason: "negative" };
  if (n > maxScore) return { ok: false, reason: "aboveMax" };
  return { ok: true, value: n };
}

// What is wrong with an assessment's own fields, or null if nothing. The
// optional bounds ({ today, earliest }, both YYYY-MM-DD) say how far a test's
// date may reach: not into the future, and not before the reporting window
// starts (a test from before it would silently fall outside every monthly
// view). ISO dates compare correctly as plain strings.
function fieldProblem({ title, date, maxScore }, bounds = {}) {
  if (!String(title ?? "").trim()) return "title";
  if (!isValidISODate(date)) return "date";
  if (!(Number.isFinite(maxScore) && maxScore > 0)) return "maxScore";
  if (bounds.today && date > bounds.today) return "dateFuture";
  if (bounds.earliest && date < bounds.earliest) return "dateTooEarly";
  return null;
}

export function emptyGradeStore() {
  return { assessments: [], grades: [] };
}

export function isValidGradeStore(x) {
  return !!x && typeof x === "object" && Array.isArray(x.assessments) && Array.isArray(x.grades);
}

// Shared with every other record the app creates (see utils/ids.js); re-exported
// here because the grade model is where it was first needed.
import { createId } from "./ids.js";
export { createId };

// Identity AT CREATION TIME. Saving the same group + subject + title + date
// again means "correct that test", not "make a second one" — so the same test
// can never exist twice, and one student can never hold two scores for it.
// (The title comparison ignores case and surrounding spaces: "Quiz 1" and
// " quiz 1" typed on the same day for the same group are the same test.)
export function findAssessment(store, { groupId, subject, title, date }) {
  return store.assessments.find(a =>
    a.groupId === groupId && a.subject === subject && a.date === date && norm(a.title) === norm(title)
  ) || null;
}

// Record scores for an assessment, creating it or — if this group already has
// that test on that date — updating it. Scores for students not mentioned are
// left as they were. Returns the new store (the input is never mutated).
export function recordAssessmentScores(store, { groupId, subject, title, date, maxScore, scoresByStudent }, bounds) {
  const problem = fieldProblem({ title, date, maxScore }, bounds);
  if (problem) return { ok: false, reason: problem, store, assessmentId: null, updated: false };
  // Every score must fit 0…max, same as when editing — the data layer refuses a
  // bad score whichever screen sent it.
  for (const score of Object.values(scoresByStudent)) {
    if (!Number.isFinite(score) || score < 0 || score > maxScore) return { ok: false, reason: "scoreRange", store, assessmentId: null, updated: false };
  }
  const existing = findAssessment(store, { groupId, subject, title, date });
  if (Object.keys(scoresByStudent).length === 0) return { ok: true, store, assessmentId: existing ? existing.id : null, updated: false };

  // Re-saving corrects the SCORES (and the max). The title is part of what makes
  // it "the same test", so it stays as first entered — retyping it as "quiz 1"
  // must not quietly rename what parents already see as "Quiz 1".
  const assessment = existing
    ? { ...existing, maxScore }
    : { id: createId("as"), groupId, subject, title: String(title).trim(), date, maxScore };
  const assessments = existing
    ? store.assessments.map(a => (a.id === existing.id ? assessment : a))
    : [...store.assessments, assessment];

  let grades = store.grades;
  for (const [studentId, score] of Object.entries(scoresByStudent)) {
    const i = grades.findIndex(g => g.assessmentId === assessment.id && g.studentId === studentId);
    grades = i === -1
      ? [...grades, { assessmentId: assessment.id, studentId, score }]
      : grades.map((g, j) => (j === i ? { ...g, score } : g));
  }
  return { ok: true, store: { assessments, grades }, assessmentId: assessment.id, updated: Boolean(existing) };
}

// Edit an existing assessment — its title, date and max score, and any
// scores — as ONE all-or-nothing step. `scores` maps studentId → a number
// (set it), null (remove that student's score) or is simply absent (leave it
// alone). Anything not given keeps its current value. Returns
//   { ok: true, store }  or  { ok: false, reason }
// where reason is one of: notFound, title, date, maxScore, dateFuture,
// dateTooEarly, duplicate (another test of this group + subject already has
// that title on that date), scoreRange (a score is negative / not a number /
// above the max), noScores (it would be left with no results — delete it
// instead). On failure nothing is changed.
export function editAssessment(store, assessmentId, patch = {}, bounds) {
  const current = store.assessments.find(a => a.id === assessmentId);
  if (!current) return { ok: false, reason: "notFound" };

  const next = {
    title: patch.title === undefined ? current.title : String(patch.title).trim(),
    date: patch.date === undefined ? current.date : patch.date,
    maxScore: patch.maxScore === undefined ? current.maxScore : patch.maxScore,
  };
  // The date bounds (not in the future, not before the months in view) apply to
  // a date being CHOSEN. An assessment that has since aged out of the moving
  // window is still a real test: correcting its score or its title must not be
  // refused for a date nobody is touching.
  const dateChanged = patch.date !== undefined && patch.date !== current.date;
  const problem = fieldProblem(next, dateChanged ? bounds : undefined);
  if (problem) return { ok: false, reason: problem };

  const clash = store.assessments.some(a =>
    a.id !== assessmentId && a.groupId === current.groupId && a.subject === current.subject &&
    a.date === next.date && norm(a.title) === norm(next.title));
  if (clash) return { ok: false, reason: "duplicate" };

  let grades = store.grades;
  for (const [studentId, value] of Object.entries(patch.scores || {})) {
    const i = grades.findIndex(g => g.assessmentId === assessmentId && g.studentId === studentId);
    if (value === null) {
      if (i !== -1) grades = grades.filter((_, j) => j !== i);
    } else {
      if (!Number.isFinite(value) || value < 0) return { ok: false, reason: "scoreRange" };
      grades = i === -1
        ? [...grades, { assessmentId, studentId, score: value }]
        : grades.map((g, j) => (j === i ? { ...g, score: value } : g));
    }
  }
  const mine = grades.filter(g => g.assessmentId === assessmentId);
  if (mine.some(g => g.score > next.maxScore)) return { ok: false, reason: "scoreRange" };
  if (mine.length === 0) return { ok: false, reason: "noScores" };

  return {
    ok: true,
    store: { assessments: store.assessments.map(a => (a.id === assessmentId ? { ...a, ...next } : a)), grades },
  };
}

// Delete an assessment and every score on it. Returns the SAME object if
// there is no such assessment, so callers can skip a re-render.
export function deleteAssessment(store, assessmentId) {
  if (!store.assessments.some(a => a.id === assessmentId)) return store;
  return {
    assessments: store.assessments.filter(a => a.id !== assessmentId),
    grades: store.grades.filter(g => g.assessmentId !== assessmentId),
  };
}

// Deleting a student removes their scores. An assessment nobody has a score
// on any more is dropped too — it would be a test with no results. Returns the
// SAME object when the student had no scores, so callers can skip a re-render.
export function removeStudentFromGrades(store, studentId) {
  const grades = store.grades.filter(g => g.studentId !== studentId);
  if (grades.length === store.grades.length) return store;
  const stillGraded = new Set(grades.map(g => g.assessmentId));
  return { assessments: store.assessments.filter(a => stillGraded.has(a.id)), grades };
}

// The per-student view the existing screens and analytics read:
//   { [studentId]: [ { id, assessmentId, groupId, subject, title, score, maxScore, date } ] }
// each list oldest-first. It is DERIVED from the store (never stored), and a
// grade whose assessment no longer exists is skipped rather than guessed at.
export function deriveGradesRecords(store) {
  const byId = new Map(store.assessments.map((a, order) => [a.id, { a, order }]));
  const staged = {};
  for (const g of store.grades) {
    const hit = byId.get(g.assessmentId);
    if (!hit) continue;
    const { a, order } = hit;
    if (!staged[g.studentId]) staged[g.studentId] = [];
    staged[g.studentId].push({
      order,
      entry: {
        id: `${a.id}:${g.studentId}`, assessmentId: a.id, groupId: a.groupId,
        subject: a.subject, title: a.title, score: g.score, maxScore: a.maxScore, date: a.date,
      },
    });
  }
  const out = {};
  for (const [studentId, list] of Object.entries(staged)) {
    list.sort((x, y) => x.entry.date.localeCompare(y.entry.date) || x.order - y.order);
    out[studentId] = list.map(x => x.entry);
  }
  return out;
}

// One-way conversion of the OLD stored shape — { [studentId]: [ { id, groupId?,
// subject, title, score, maxScore, date } ] } — into a gradeStore, so grades a
// browser already holds are not lost. Entries that agree on group + subject +
// title + date + maxScore become ONE assessment (that is what the old model
// meant by "the same test"). Entries from before groupId existed take the
// student's CURRENT group — the best information left. If one student has two
// entries for the same test, the later one wins (a duplicate, not two scores).
// Malformed entries are skipped, never thrown on.
export function migrateLegacyGradesRecords(legacy, students = []) {
  const store = emptyGradeStore();
  if (!legacy || typeof legacy !== "object") return store;
  const groupOf = new Map((students || []).map(s => [s.id, s.groupId ?? null]));
  const byKey = new Map();
  for (const [studentId, list] of Object.entries(legacy)) {
    if (!Array.isArray(list)) continue;
    for (const e of list) {
      if (!e || typeof e !== "object") continue;
      const { subject, title, date, score, maxScore } = e;
      if (typeof subject !== "string" || typeof title !== "string" || typeof date !== "string") continue;
      if (!Number.isFinite(score) || !Number.isFinite(maxScore)) continue;
      const groupId = e.groupId ?? groupOf.get(studentId) ?? null;
      const key = [groupId, subject, norm(title), date, maxScore].join("\u0001");
      let assessment = byKey.get(key);
      if (!assessment) {
        assessment = { id: `as-legacy-${byKey.size}`, groupId, subject, title: title.trim(), date, maxScore };
        byKey.set(key, assessment);
        store.assessments.push(assessment);
      }
      const i = store.grades.findIndex(g => g.assessmentId === assessment.id && g.studentId === studentId);
      if (i === -1) store.grades.push({ assessmentId: assessment.id, studentId, score });
      else store.grades[i] = { ...store.grades[i], score };
    }
  }
  return store;
}
