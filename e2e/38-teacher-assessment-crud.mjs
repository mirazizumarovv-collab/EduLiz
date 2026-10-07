// The Teacher's full assessment workflow, in the browser:
//   • pick the date a test was given (yesterday's test, a make-up, a correction)
//   • edit an existing assessment — title, date, max score, per-student scores
//   • refusals say WHY (future date, before the window, duplicate, no scores)
//   • delete, with confirmation
// …and the Parent sees the result. The data rules are unit-tested in 37.
import { launch, step, report, visibleText, EN, BASE, readGradeStore, seedGrades } from "./lib.mjs";

const { browser, page, errors } = await launch({ width: 1100, height: 1100 });
const ls = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
const text = () => visibleText(page);
const dateBox = () => page.locator("input[type=date]");
const titleBox = () => page.getByPlaceholder(EN.assessmentTitlePlaceholder);
const nums = () => page.locator("input[type=number]");           // [0] = max score, then one per student (aisha, joiner)
const rowOf = (label) => page.locator("[data-assessment]", { hasText: label });
const byTitle = async (title) => (await readGradeStore(page)).assessments.find(a => a.title === title);
const scoresOf = async (id) => Object.fromEntries((await readGradeStore(page)).grades.filter(g => g.assessmentId === id).map(g => [g.studentId, g.score]));
const expectAlert = async (expected) => {
  const alert = page.getByRole("alert");
  await alert.waitFor({ timeout: 3000 });
  const got = (await alert.innerText()).trim();
  if (got !== expected) throw new Error(`expected the message "${expected}", got "${got}"`);
};

await page.goto(BASE);

await step("setup: a group of two students with two existing assessments, Teacher on the Grades screen", async () => {
  const students = await ls("students");
  students.push({ id: "joiner", name: "Late Joiner", grade: "Grade 7", groupId: "g-math-7a", guardians: [{ id: "g-j", name: "J Parent", phone: "+998 90 600 70 80", role: "Guardian" }], connectionCode: null });
  await setLs("students", students);
  const groups = await ls("groups"); groups.find(g => g.id === "g-math-7a").studentIds.push("joiner"); await setLs("groups", groups);
  await seedGrades(page, [
    { groupId: "g-math-7a", subject: "Mathematics", title: "Quiz 1", date: "2026-09-05", maxScore: 20, scores: { aisha: 16, joiner: 12 } },
    { groupId: "g-math-7a", subject: "Mathematics", title: "Essay", date: "2026-09-01", maxScore: 10, scores: { aisha: 7 } },
  ], { replace: true });
  await page.reload(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByText("Malika Yusupova").click();
  await page.getByText(EN.navGrades, { exact: true }).first().click(); await page.waitForTimeout(250);
  await page.locator("select").first().selectOption({ label: "Mathematics 7A" });
  await page.getByText(EN.groupAssessments).waitFor({ timeout: 3000 });
}, errors);

// ------------------------------------------------------------ choosing a date
await step("the date box defaults to today and is limited to the reporting window", async () => {
  const d = dateBox();
  const [value, min, max] = [await d.inputValue(), await d.getAttribute("min"), await d.getAttribute("max")];
  if (value !== "2026-09-08" || min !== "2026-03-01" || max !== "2026-09-08") throw new Error(`value/min/max = ${value} / ${min} / ${max}`);
}, errors);

await step("a test given on an EARLIER day is saved with that day, not today's date", async () => {
  await titleBox().fill("Makeup Test");
  await dateBox().fill("2026-09-02");
  await nums().nth(1).fill("14");
  await page.getByRole("button", { name: EN.saveGrades }).click(); await page.waitForTimeout(300);
  const a = await byTitle("Makeup Test");
  if (!a || a.date !== "2026-09-02") throw new Error("not saved with the chosen date: " + JSON.stringify(a));
  if (!(await text()).includes("Makeup Test — 2026-09-02")) throw new Error("not listed with its date");
  if (!(await text()).includes(EN.gradesSaved)) throw new Error("no 'saved' confirmation");
}, errors);

await step("a date in the future, before the window, or blank is refused — with the reason — and nothing is saved", async () => {
  const before = (await readGradeStore(page)).assessments.length;
  await titleBox().fill("Bad Date Test"); await nums().nth(1).fill("10");
  const tryDate = async (value, expected) => {
    await dateBox().fill(value);
    await page.getByRole("button", { name: EN.saveGrades }).click();
    await expectAlert(expected);
  };
  await tryDate("2026-09-20", EN.errorDateFuture);
  await tryDate("2026-02-15", EN.errorDateTooEarly.replace("{date}", "2026-03-01"));
  await tryDate("", EN.errorDateInvalid);
  if ((await readGradeStore(page)).assessments.length !== before) throw new Error("an assessment was created despite the refusals");
  await dateBox().fill("2026-09-08"); await titleBox().fill(""); await nums().nth(1).fill("");   // leave the form clean
}, errors);

// ------------------------------------------------------------------- editing
let quizId;
await step("Edit loads the assessment into the form (banner, title, max, date, each student's score)", async () => {
  quizId = (await byTitle("Quiz 1")).id;
  await rowOf("Quiz 1 — 2026-09-05").getByRole("button", { name: EN.edit, exact: true }).click(); await page.waitForTimeout(200);
  const t = await text();
  if (!t.includes(EN.editingAssessment.replace("{title}", "Quiz 1").replace("{date}", "2026-09-05"))) throw new Error("no editing banner: " + t.slice(0, 300));
  const got = [await titleBox().inputValue(), await nums().nth(0).inputValue(), await dateBox().inputValue(), await nums().nth(1).inputValue(), await nums().nth(2).inputValue()];
  if (JSON.stringify(got) !== JSON.stringify(["Quiz 1", "20", "2026-09-05", "16", "12"])) throw new Error("form not pre-filled correctly: " + JSON.stringify(got));
  if (!(await page.getByRole("button", { name: EN.saveChanges }).count())) throw new Error("the save button should read 'Save changes' while editing");
}, errors);

await step("saving changes updates the SAME assessment: new title, date and max; one score changed, another removed", async () => {
  await titleBox().fill("Quiz One (revised)");
  await dateBox().fill("2026-09-04");
  await nums().nth(0).fill("25");
  await nums().nth(1).fill("20");          // aisha 16 -> 20
  await nums().nth(2).fill("");            // joiner: blank = no score
  await page.getByRole("button", { name: EN.saveChanges }).click(); await page.waitForTimeout(300);
  const store = await readGradeStore(page);
  const a = store.assessments.find(x => x.id === quizId);
  if (!a || a.title !== "Quiz One (revised)" || a.date !== "2026-09-04" || a.maxScore !== 25) throw new Error("fields not updated, or it is no longer the same assessment: " + JSON.stringify(a));
  if (store.assessments.filter(x => x.title.startsWith("Quiz")).length !== 1) throw new Error("editing created a second assessment");
  const sc = await scoresOf(quizId);
  if (JSON.stringify(sc) !== JSON.stringify({ aisha: 20 })) throw new Error("scores wrong: " + JSON.stringify(sc));
  const t = await text();
  if (!t.includes(EN.assessmentUpdated) || !t.includes("Quiz One (revised) — 2026-09-04")) throw new Error("no confirmation / list not updated");
  if ((await titleBox().inputValue()) !== "" || !(await page.getByRole("button", { name: EN.saveGrades }).count())) throw new Error("form did not return to 'new assessment' mode");
}, errors);

await step("renaming onto another test's name and date is refused as a duplicate, and nothing changes", async () => {
  await rowOf("Essay — 2026-09-01").getByRole("button", { name: EN.edit, exact: true }).click(); await page.waitForTimeout(150);
  await titleBox().fill("quiz one (REVISED)"); await dateBox().fill("2026-09-04");
  await page.getByRole("button", { name: EN.saveChanges }).click();
  await expectAlert(EN.errorAssessmentDuplicate.replace("{title}", "quiz one (REVISED)"));
  const essay = await byTitle("Essay");
  if (!essay || essay.date !== "2026-09-01") throw new Error("the refused edit still changed the assessment: " + JSON.stringify(essay));
}, errors);

await step("clearing every score is refused (delete it instead) — and Cancel leaves edit mode untouched", async () => {
  await titleBox().fill("Essay"); await dateBox().fill("2026-09-01");        // back to the real values
  await nums().nth(1).fill("");                                               // aisha is Essay's only score
  await page.getByRole("button", { name: EN.saveChanges }).click();
  await expectAlert(EN.errorAssessmentNoScores);
  const essayId = (await byTitle("Essay")).id;
  if (JSON.stringify(await scoresOf(essayId)) !== JSON.stringify({ aisha: 7 })) throw new Error("the score was removed despite the refusal");
  await page.getByRole("button", { name: EN.cancel, exact: true }).first().click(); await page.waitForTimeout(150);
  if ((await titleBox().inputValue()) !== "" || (await page.getByRole("alert").count())) throw new Error("Cancel did not return to a clean new-assessment form");
}, errors);

// ------------------------------------------------------------------ deleting
await step("Delete asks first (naming the test and its score count); Cancel keeps it", async () => {
  await rowOf("Makeup Test").getByRole("button", { name: EN.delete, exact: true }).click(); await page.waitForTimeout(150);
  const body = EN.confirmDeleteAssessmentBody.replace("{title}", "Makeup Test").replace("{date}", "2026-09-02").replace("{n}", "1");
  if (!(await text()).includes(body)) throw new Error("no confirmation text: " + (await text()).slice(0, 400));
  await rowOf("Makeup Test").getByRole("button", { name: EN.cancel, exact: true }).click(); await page.waitForTimeout(150);
  if (!(await byTitle("Makeup Test"))) throw new Error("Cancel still deleted it");
}, errors);

await step("confirming Delete removes the assessment AND all its scores, and says so", async () => {
  const id = (await byTitle("Makeup Test")).id;
  await rowOf("Makeup Test").getByRole("button", { name: EN.delete, exact: true }).click();
  await rowOf("Makeup Test").getByRole("button", { name: EN.confirmDelete, exact: true }).click(); await page.waitForTimeout(300);
  const store = await readGradeStore(page);
  if (store.assessments.some(a => a.id === id) || store.grades.some(g => g.assessmentId === id)) throw new Error("it (or its scores) is still stored");
  if (await rowOf("Makeup Test").count()) throw new Error("still listed");
  if (!(await text()).includes(EN.assessmentDeleted)) throw new Error("no 'deleted' message");
}, errors);

await step("deleting the assessment you are in the middle of editing drops you out of edit mode", async () => {
  await rowOf("Essay — 2026-09-01").getByRole("button", { name: EN.edit, exact: true }).click(); await page.waitForTimeout(150);
  await rowOf("Essay — 2026-09-01").getByRole("button", { name: EN.delete, exact: true }).click();
  await rowOf("Essay — 2026-09-01").getByRole("button", { name: EN.confirmDelete, exact: true }).click(); await page.waitForTimeout(300);
  // (not by role=status: the "deleted" toast uses that role too)
  const bannerStart = EN.editingAssessment.split("{title}")[0];
  if ((await text()).includes(bannerStart)) throw new Error("the editing banner is still showing");
  if ((await titleBox().inputValue()) !== "") throw new Error("the form still holds the deleted assessment");
  if (await byTitle("Essay")) throw new Error("not deleted");
}, errors);

// ----------------------------------------------------- what the Parent sees
await step("the Parent sees only what is left, with the edited title, date and score", async () => {
  await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await text()).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code);
  await page.getByRole("button", { name: EN.verifyCode }).click(); await page.waitForTimeout(450);
  await page.getByText(EN.navGrades, { exact: true }).last().click(); await page.waitForTimeout(450);
  const t = await text();
  if (!t.includes("Quiz One (revised) · 20/25 · 2026-09-04")) throw new Error("edited assessment not shown: " + t.slice(0, 300));
  if (/Essay|Makeup Test/.test(t)) throw new Error("a deleted assessment still shows for the parent: " + t.slice(0, 300));
}, errors);

report();
await browser.close();
