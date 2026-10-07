// Plain unit checks (no browser) for editing and deleting an assessment, and
// for the date rules (a real calendar date, not in the future, not before the
// reporting window starts). The browser flow is e2e/38.
import {
  emptyGradeStore, recordAssessmentScores, editAssessment, deleteAssessment,
  deriveGradesRecords, isValidISODate,
} from "../src/utils/gradeModel.js";

let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) { failures++; console.log(`FAIL — ${name}${detail ? "  → " + detail : ""}`); } };
const deepFreeze = (o) => { Object.values(o).forEach(v => v && typeof v === "object" && deepFreeze(v)); return Object.freeze(o); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const BOUNDS = { today: "2026-09-08", earliest: "2026-03-01" };
const base = (over = {}) => ({ groupId: "g1", subject: "Mathematics", title: "Quiz 1", date: "2026-09-05", maxScore: 20, scoresByStudent: { a: 16, b: 12 }, ...over });
const make = (over, store = emptyGradeStore()) => recordAssessmentScores(store, base(over));

// ---------- calendar dates ----------
check("isValidISODate accepts real dates", ["2026-09-08", "2024-02-29", "2026-12-31"].every(isValidISODate));
check("isValidISODate rejects impossible / malformed dates",
  ["2026-02-30", "2025-02-29", "2026-13-01", "2026-9-8", "08-09-2026", "", "abc", null, undefined, 20260908].every(d => !isValidISODate(d)));

// ---------- creating also respects the rules ----------
{
  check("create: a valid test is ok:true", make({}).ok === true);
  const bad = (over, reason) => {
    const r = recordAssessmentScores(emptyGradeStore(), base(over), BOUNDS);
    check(`create rejected for ${reason}`, r.ok === false && r.reason === reason && r.store.assessments.length === 0, JSON.stringify({ ok: r.ok, reason: r.reason }));
  };
  bad({ title: "   " }, "title");
  bad({ date: "2026-02-30" }, "date");
  bad({ maxScore: 0 }, "maxScore");
  bad({ maxScore: NaN }, "maxScore");
  bad({ date: "2026-09-09" }, "dateFuture");
  bad({ date: "2026-02-28" }, "dateTooEarly");
  check("create: today and the first day of the window are both allowed",
    recordAssessmentScores(emptyGradeStore(), base({ date: "2026-09-08" }), BOUNDS).ok &&
    recordAssessmentScores(emptyGradeStore(), base({ date: "2026-03-01" }), BOUNDS).ok);
}

// ---------- editing ----------
{
  const store = deepFreeze(make({}).store); // frozen: any mutation throws
  const id = store.assessments[0].id;
  const other = make({ title: "Other", date: "2026-09-01", scoresByStudent: { a: 5 } }, store).store; // a second, unrelated test

  const r = editAssessment(other, id, { title: "  Quiz One ", date: "2026-09-03", maxScore: 25 });
  check("edit: rename + new date + new max in one step is ok", r.ok === true);
  const edited = r.store.assessments.find(a => a.id === id);
  check("edit: it is the SAME assessment (same id), with the new fields",
    edited && edited.title === "Quiz One" && edited.date === "2026-09-03" && edited.maxScore === 25 && edited.groupId === "g1" && edited.subject === "Mathematics");
  check("edit: scores not mentioned are untouched", r.store.grades.filter(g => g.assessmentId === id).length === 2 && r.store.grades.find(g => g.assessmentId === id && g.studentId === "a").score === 16);
  check("edit: the other test is untouched", eq(r.store.assessments.find(a => a.title === "Other"), other.assessments.find(a => a.title === "Other")));
  check("edit: the derived view follows (new title/date/max)", eq(
    deriveGradesRecords(r.store).a.find(e => e.assessmentId === id), { id: `${id}:a`, assessmentId: id, groupId: "g1", subject: "Mathematics", title: "Quiz One", score: 16, maxScore: 25, date: "2026-09-03" }));

  const sc = editAssessment(other, id, { scores: { a: 19, c: 7, b: null } });
  const rows = sc.ok ? sc.store.grades.filter(g => g.assessmentId === id) : [];
  check("edit scores: change one, add a new student's, remove one with null",
    sc.ok && rows.length === 2 && rows.find(g => g.studentId === "a").score === 19 && rows.find(g => g.studentId === "c").score === 7 && !rows.some(g => g.studentId === "b"), JSON.stringify(rows));

  const fail = (patch, reason, opts) => {
    const x = editAssessment(other, id, patch, opts);
    check(`edit rejected: ${reason}`, x.ok === false && x.reason === reason && !x.store, JSON.stringify(x.reason));
  };
  fail({ title: "   " }, "title");
  fail({ date: "2026-02-30" }, "date");
  fail({ maxScore: 0 }, "maxScore");
  fail({ maxScore: "20" }, "maxScore");
  fail({ maxScore: 10 }, "scoreRange");                 // a (16) and b (12) no longer fit under 10
  fail({ scores: { a: -1 } }, "scoreRange");
  fail({ scores: { a: NaN } }, "scoreRange");
  fail({ scores: { a: null, b: null } }, "noScores");   // would leave a test with no results
  fail({ date: "2026-09-09" }, "dateFuture", BOUNDS);
  fail({ date: "2026-02-01" }, "dateTooEarly", BOUNDS);
  check("edit: no changes at all is fine (ok, same content)", editAssessment(other, id, {}).ok === true);
  check("edit: today / window start allowed", editAssessment(other, id, { date: "2026-09-08" }, BOUNDS).ok && editAssessment(other, id, { date: "2026-03-01" }, BOUNDS).ok);

  // the same name+date as ANOTHER test of the SAME group and subject is a clash…
  const clash = editAssessment(other, id, { title: "OTHER", date: "2026-09-01" });
  check("edit: renaming onto another test's name+date (same group & subject) is a duplicate", clash.ok === false && clash.reason === "duplicate");
  // …but is fine for a different group, a different subject, or when it keeps its own identity
  const g2 = make({ groupId: "g2", title: "Other", date: "2026-09-01", scoresByStudent: { z: 1 } }, store).store;
  check("edit: the same name+date in a DIFFERENT group is not a clash", editAssessment(g2, id, { title: "Other", date: "2026-09-01" }).ok === true);
  check("edit: re-saving a test with its own current title/date is not a clash with itself", editAssessment(other, id, { title: "Quiz 1", date: "2026-09-05" }).ok === true);

  check("edit: unknown id → notFound", editAssessment(other, "ghost", { title: "x" }).reason === "notFound");
}

// ---------- an assessment that is now OLDER than the window can still be edited ----------
{
  // The months in view move with the calendar, so a test that was inside them when
  // it was given can end up before their start. It is still a real test; fixing a
  // score or a typo in it must not be refused for its (unchanged) date.
  const old = recordAssessmentScores(emptyGradeStore(), base({ date: "2026-03-10" })).store;       // created back when it was in range
  const id = old.assessments[0].id;
  const later = { today: "2026-12-01", earliest: "2026-06-01" };                                      // the window has since moved on
  check("an old assessment's title/scores can be edited while its date stays as it was",
    editAssessment(old, id, { title: "Quiz 1 (corrected)", scores: { a: 18 } }, later).ok === true);
  check("…and re-saving its CURRENT date is not a 'change' either", editAssessment(old, id, { date: "2026-03-10", title: "x" }, later).ok === true);
  const moved = editAssessment(old, id, { date: "2026-04-01" }, later);
  check("but MOVING it to another date before the window is still refused", moved.ok === false && moved.reason === "dateTooEarly", JSON.stringify(moved));
  const future = editAssessment(old, id, { date: "2026-12-02" }, later);
  check("and moving it into the future is refused", future.ok === false && future.reason === "dateFuture");
  check("moving it to a date inside the window is fine", editAssessment(old, id, { date: "2026-07-01" }, later).ok === true);
}

// ---------- deleting ----------
{
  const s1 = make({}).store;
  const s2 = make({ title: "Keep", date: "2026-09-02", scoresByStudent: { a: 9 } }, s1).store;
  const id = s1.assessments[0].id;
  const del = deleteAssessment(deepFreeze(s2), id);
  check("delete: the assessment and ALL its scores are gone", !del.assessments.some(a => a.id === id) && !del.grades.some(g => g.assessmentId === id));
  check("delete: other tests and their scores are untouched", del.assessments.length === 1 && del.assessments[0].title === "Keep" && del.grades.length === 1);
  check("delete: the derived per-student view no longer shows it", eq(deriveGradesRecords(del).a.map(e => e.title), ["Keep"]) && deriveGradesRecords(del).b === undefined);
  check("delete: an unknown id returns the SAME object (nothing to re-render)", deleteAssessment(s2, "ghost") === s2);
}

if (failures) { console.log(`\n${failures} check(s) failed`); process.exit(1); }
console.log("PASS — assessment edit/delete: rename, re-date, re-max, score changes, duplicate/range/no-score rules, date bounds, delete cascade");
