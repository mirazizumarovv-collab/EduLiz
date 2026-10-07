// Plain unit checks (no browser) for the assessmentId grade model.
//   Part A — the pure model rules (src/utils/gradeModel.js)
//   Part B — migrating the old per-student shape without losing anything
//   Part C — getGrades(): class average is "everyone else graded on THIS
//            assessment", found by assessmentId, not by matching a title
import {
  emptyGradeStore, createId, findAssessment, recordAssessmentScores,
  removeStudentFromGrades, deriveGradesRecords, migrateLegacyGradesRecords,
} from "../src/utils/gradeModel.js";
import { updateBridge } from "../src/parent-app/data/liveBridge.js";
import { getGrades } from "../src/parent-app/data/grades.js";

let failures = 0;
const check = (name, ok, detail = "") => {
  if (!ok) { failures++; console.log(`FAIL — ${name}${detail ? "  → " + detail : ""}`); }
};
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const deepFreeze = (o) => { Object.values(o).forEach(v => v && typeof v === "object" && deepFreeze(v)); return Object.freeze(o); };
const save = (store, over) => recordAssessmentScores(store, {
  groupId: "g1", subject: "Mathematics", title: "Quiz 1", date: "2026-09-08", maxScore: 20, scoresByStudent: {}, ...over,
});

// ---------------- Part A: the model rules ----------------
{
  // ids stay unique even when thousands are made inside one millisecond
  const ids = new Set(); for (let i = 0; i < 20000; i++) ids.add(createId("as"));
  check("createId: 20,000 ids made back-to-back are all distinct", ids.size === 20000, `${ids.size} distinct`);

  // creating
  const frozen = deepFreeze(emptyGradeStore());
  const r1 = save(frozen, { scoresByStudent: { aisha: 12, umar: 15 } }); // throws if it mutates the frozen input
  check("create: one assessment holding the test's own fields",
    r1.store.assessments.length === 1 && eq({ ...r1.store.assessments[0], id: 0 }, { id: 0, groupId: "g1", subject: "Mathematics", title: "Quiz 1", date: "2026-09-08", maxScore: 20 }));
  check("create: one Grade row per student pointing at the assessment id",
    r1.store.grades.length === 2 && r1.store.grades.every(g => g.assessmentId === r1.assessmentId) && r1.updated === false);

  // saving the same test again corrects it — it does not duplicate it
  const r2 = save(r1.store, { scoresByStudent: { aisha: 18 }, maxScore: 25 });
  check("re-save: still ONE assessment (no duplicate)", r2.store.assessments.length === 1 && r2.updated === true, `${r2.store.assessments.length} assessments`);
  check("re-save: the student's score is replaced — never two scores for one test",
    r2.store.grades.filter(g => g.studentId === "aisha").length === 1 && r2.store.grades.find(g => g.studentId === "aisha").score === 18);
  check("re-save: a student not mentioned keeps their score", r2.store.grades.find(g => g.studentId === "umar").score === 15);
  check("re-save: the corrected max score applies to the assessment", r2.store.assessments[0].maxScore === 25);
  check("re-save: same assessment id", r2.assessmentId === r1.assessmentId);

  // what counts as "the same test"
  const retyped = save(r1.store, { title: "  quiz 1 ", scoresByStudent: { aisha: 1 } }).store;
  check("title identity ignores case and surrounding spaces", retyped.assessments.length === 1);
  check("re-saving keeps the title as first entered (it is not renamed by a retyped one)", retyped.assessments[0].title === "Quiz 1", retyped.assessments[0].title);
  check("a different DATE is a different assessment (a retake)", save(r1.store, { date: "2026-09-20", scoresByStudent: { aisha: 1 } }).store.assessments.length === 2);
  check("a different GROUP is a different assessment (same name, same day)", save(r1.store, { groupId: "g2", scoresByStudent: { x: 1 } }).store.assessments.length === 2);
  check("a different SUBJECT is a different assessment", save(r1.store, { subject: "English", scoresByStudent: { aisha: 1 } }).store.assessments.length === 2);
  check("findAssessment locates by group+subject+title+date", findAssessment(r1.store, { groupId: "g1", subject: "Mathematics", title: "QUIZ 1", date: "2026-09-08" })?.id === r1.assessmentId);

  const noop = save(r1.store, { scoresByStudent: {} });
  check("saving no scores changes nothing (same object back)", noop.store === r1.store && noop.updated === false);

  // removing a student
  const two = save(r1.store, { date: "2026-09-20", scoresByStudent: { aisha: 5 } }).store; // aisha: 2 tests, umar: 1
  const noAisha = removeStudentFromGrades(two, "aisha");
  check("remove student: their scores are gone", !noAisha.grades.some(g => g.studentId === "aisha"));
  check("remove student: a test only they were graded on is dropped; a shared test stays",
    noAisha.assessments.length === 1 && noAisha.assessments[0].date === "2026-09-08");
  check("remove student with no scores: the SAME object comes back", removeStudentFromGrades(two, "nobody") === two);

  // the per-student view
  const mixed = save(save(emptyGradeStore(), { date: "2026-09-20", title: "Later", scoresByStudent: { aisha: 9 } }).store,
    { date: "2026-09-01", title: "Earlier", scoresByStudent: { aisha: 7 } }).store;
  const view = deriveGradesRecords(mixed);
  check("derived view: oldest first by date regardless of the order they were saved", eq(view.aisha.map(e => e.title), ["Earlier", "Later"]));
  check("derived view: each entry carries assessmentId, groupId, maxScore and a stable id",
    view.aisha[0].assessmentId === mixed.assessments[1].id && view.aisha[0].groupId === "g1" && view.aisha[0].maxScore === 20
    && view.aisha[0].id === `${mixed.assessments[1].id}:aisha`);
  check("derived view: a grade whose assessment is missing is skipped, not a crash",
    eq(deriveGradesRecords({ assessments: [], grades: [{ assessmentId: "ghost", studentId: "a", score: 1 }] }), {}));
  check("derived view of an empty store is {}", eq(deriveGradesRecords(emptyGradeStore()), {}));
}

// ---------------- Part B: migrating the old stored shape ----------------
{
  const e = (o) => ({ id: "x", subject: "Mathematics", title: "Quiz 1", score: 16, maxScore: 20, date: "2026-09-08", groupId: "g1", ...o });
  const students = [{ id: "aisha", groupId: "g-now" }, { id: "umar", groupId: "g1" }];

  const shared = migrateLegacyGradesRecords({ aisha: [e()], umar: [e({ score: 12 })] }, students);
  check("migrate: the same test for two students becomes ONE assessment with two grades", shared.assessments.length === 1 && shared.grades.length === 2);

  const noGroup = migrateLegacyGradesRecords({ aisha: [e({ groupId: undefined })] }, students);
  check("migrate: an entry from before groupId existed takes the student's current group", noGroup.assessments[0].groupId === "g-now");
  const hasGroup = migrateLegacyGradesRecords({ aisha: [e({ groupId: "g-old" })] }, students);
  check("migrate: an entry that already has a groupId keeps it", hasGroup.assessments[0].groupId === "g-old");

  const dupes = migrateLegacyGradesRecords({ aisha: [e({ score: 10 }), e({ score: 19 })] }, students);
  check("migrate: the same student twice on one test → one score, the later one", dupes.grades.length === 1 && dupes.grades[0].score === 19);
  check("migrate: same title on a different date → two assessments", migrateLegacyGradesRecords({ aisha: [e(), e({ date: "2026-09-20" })] }, students).assessments.length === 2);
  check("migrate: same test with a different max score is NOT merged (its meaning is preserved)", migrateLegacyGradesRecords({ aisha: [e()], umar: [e({ maxScore: 10, score: 6 })] }, students).assessments.length === 2);

  let threw = false, junk;
  try {
    junk = migrateLegacyGradesRecords({ a: "nope", b: [null, 5, "x", e({ score: NaN }), e({ subject: 3 }), e({ date: undefined }), e()], c: null }, students);
  } catch { threw = true; }
  check("migrate: malformed input is skipped without throwing", !threw && junk && junk.grades.length === 1);
  check("migrate: null / undefined / non-object input gives an empty store",
    [null, undefined, "x", 5].every(v => eq(migrateLegacyGradesRecords(v, students), emptyGradeStore())));

  // nothing is lost: what comes out reads back as what went in
  const legacy = { aisha: [e({ title: "A", date: "2026-05-08", score: 16 }), e({ title: "B", subject: "English", date: "2026-07-10", score: 14 })], umar: [e({ title: "A", date: "2026-05-08", score: 9 })] };
  const back = deriveGradesRecords(migrateLegacyGradesRecords(legacy, students));
  const flat = (rec) => Object.entries(rec).flatMap(([sid, list]) => list.map(x => [sid, x.subject, x.title, x.date, x.score, x.maxScore].join("|"))).sort();
  check("migrate: round trip preserves every student's score, test, subject, date and max", eq(flat(back), flat(legacy)));
}

// ---------------- Part C: getGrades() — class average by assessmentId ----------------
{
  const run = ({ store, students, groups }) => {
    updateBridge({ students, groups, teachers: [], attendanceRecords: {}, gradesRecords: deriveGradesRecords(store), homeworkRecords: {}, homeworkSubmissions: {}, paymentsStatus: {}, paymentTransactions: {}, messageThreads: {}, currentDateStr: "2026-09-08", selectedStudentId: null });
    return (id) => getGrades(id).find(s => s.name === "Mathematics");
  };
  const roster = (extra = {}) => ({
    students: [{ id: "a", groupId: "g1" }, { id: "b", groupId: "g1" }, { id: "c", groupId: "g1" }],
    groups: [{ id: "g1", subject: "Mathematics", teacherId: null, studentIds: ["a", "b", "c"] }, { id: "g2", subject: "Mathematics", teacherId: null, studentIds: [] }], ...extra,
  });

  let store = save(emptyGradeStore(), { scoresByStudent: { a: 16, b: 12, c: 4 } }).store; // 80%, 60%, 20%
  let getFor = run({ store, ...roster() });
  check("class average: the mean of everyone ELSE on the assessment — (60+20)/2 = 40", getFor("a").classAvg === 40 && getFor("a").hasClassComparison === true, JSON.stringify(getFor("a")?.classAvg));

  // b is moved to another group after the test — they still sat it
  const moved = roster({ students: [{ id: "a", groupId: "g1" }, { id: "b", groupId: "g2" }, { id: "c", groupId: "g1" }], groups: [{ id: "g1", subject: "Mathematics", teacherId: null, studentIds: ["a", "c"] }, { id: "g2", subject: "Mathematics", teacherId: null, studentIds: ["b"] }] });
  getFor = run({ store, ...moved });
  check("a classmate moved to another group since the test still counts (they took it)", getFor("a").classAvg === 40, String(getFor("a")?.classAvg));
  check("…and the moved student's own comparison still uses the original classmates", getFor("b").classAvg === 50, String(getFor("b")?.classAvg)); // (80+20)/2

  // a student's newest test has no one else on it
  store = save(store, { title: "Solo", date: "2026-09-10", scoresByStudent: { a: 18 } }).store;
  getFor = run({ store, ...roster() });
  check("newest assessment with nobody else graded → no comparison, never the student against themself", getFor("a").hasClassComparison === false && getFor("a").score === 90);

  // two groups, same title and day: separate assessments, no leakage
  let two = save(emptyGradeStore(), { groupId: "g1", scoresByStudent: { a: 20 } }).store;
  two = save(two, { groupId: "g2", scoresByStudent: { b: 0 } }).store;
  getFor = run({ store: two, ...roster() });
  check("same title + date in two groups never leak into each other's average", getFor("a").hasClassComparison === false);

  // entries that carry no assessmentId (not produced by the app any more) must not crash
  updateBridge({ ...roster(), teachers: [], attendanceRecords: {}, gradesRecords: { a: [{ id: "old", subject: "Mathematics", title: "T", score: 5, maxScore: 10, date: "2026-09-01" }] }, homeworkRecords: {}, homeworkSubmissions: {}, paymentsStatus: {}, paymentTransactions: {}, messageThreads: {}, currentDateStr: "2026-09-08", selectedStudentId: null });
  let ok = true; try { ok = getGrades("a")[0].hasClassComparison === false; } catch { ok = false; }
  check("an entry with no assessmentId is handled (no comparison, no crash)", ok);
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("PASS — assessmentId model: creation, re-save correction, identity rules, student removal, migration round trip, and class average by assessmentId");
