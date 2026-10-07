// Browser-level checks for the assessmentId grade model (the rules themselves
// are unit-tested in 35; this is what a person actually sees and does).
//   A. Saving the same test twice corrects it — one assessment, one score.
//   B. The teacher's "recent assessments" list shows the GROUP's tests, even
//      when the first student in the group was not graded on any of them.
//   C. Grades a browser already holds in the OLD stored shape are migrated,
//      not lost.
import { launch, step, report, visibleText, EN, BASE, readGradeStore, seedGrades } from "./lib.mjs";

const text = (page) => visibleText(page);
const registerParent = async (page) => {
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await text(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code);
  await page.getByRole("button", { name: EN.verifyCode }).click(); await page.waitForTimeout(450);
};
const teacherSaves = async (page, { group, title, max, scores }) => {
  await page.locator("select").first().selectOption({ label: group });
  await page.getByPlaceholder("e.g. Test 3").fill(title);
  const nums = page.locator("input[type=number]");
  await nums.nth(0).fill(String(max));
  for (let i = 0; i < scores.length; i++) await nums.nth(i + 1).fill(String(scores[i]));
  await page.getByRole("button", { name: "Save grades" }).click(); await page.waitForTimeout(300);
};
const teacherGradesScreen = async (page) => {
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByText("Malika Yusupova").click();
  await page.getByText(EN.navGrades, { exact: true }).first().click(); await page.waitForTimeout(250);
};

// ------------------------------------------------------------------ A
{
  const { browser, page, errors } = await launch({ width: 1100, height: 950 });
  await page.goto(BASE);

  await step("A. saving the SAME test twice leaves ONE assessment holding the corrected score (not two)", async () => {
    await teacherGradesScreen(page);
    await teacherSaves(page, { group: "Mathematics 7A", title: "Quiz 1", max: 20, scores: [12] });
    await teacherSaves(page, { group: "Mathematics 7A", title: "quiz 1 ", max: 20, scores: [18] }); // same test, retyped
    const store = await readGradeStore(page);
    if (store.assessments.length !== 1) throw new Error(`expected 1 assessment, found ${store.assessments.length}: ${JSON.stringify(store.assessments)}`);
    const a = store.assessments[0];
    if (a.groupId !== "g-math-7a" || a.subject !== "Mathematics" || a.maxScore !== 20 || a.date !== "2026-09-08") throw new Error("assessment fields wrong: " + JSON.stringify(a));
    const rows = store.grades.filter(g => g.studentId === "aisha");
    if (rows.length !== 1 || rows[0].score !== 18 || rows[0].assessmentId !== a.id) throw new Error("expected ONE score of 18 for Aisha: " + JSON.stringify(store.grades));
  }, errors);

  await step("A. the Parent sees the corrected 18/20 — a single Quiz 1, not a stale 12/20 or a second entry", async () => {
    await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
    await registerParent(page);
    await page.getByText(EN.navGrades, { exact: true }).last().click(); await page.waitForTimeout(450);
    const t = await text(page);
    if (!/Quiz 1 · 18\/20/.test(t)) throw new Error("expected 'Quiz 1 · 18/20': " + t.slice(0, 300));
    if (/12\/20/.test(t)) throw new Error("the superseded 12/20 is still showing: " + t.slice(0, 300));
  }, errors);
  await browser.close();
}

// ------------------------------------------------------------------ B
{
  const { browser, page, errors } = await launch({ width: 1100, height: 950 });
  const ls = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
  const setLs = (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
  await page.goto(BASE);

  await step("B. 'recent assessments' lists the group's tests even though the group's FIRST student (Aisha) was graded on none of them", async () => {
    const students = await ls("students");
    students.push({ id: "joiner", name: "Late Joiner", grade: "Grade 7", groupId: "g-math-7a", guardians: [{ id: "g-j", name: "J Parent", phone: "+998 90 600 70 80", role: "Guardian" }], connectionCode: null });
    await setLs("students", students);
    const groups = await ls("groups"); groups.find(g => g.id === "g-math-7a").studentIds.push("joiner"); await setLs("groups", groups);
    // a test graded ONLY for the second student; Aisha (studentIds[0]) has no grades at all
    await seedGrades(page, [{ groupId: "g-math-7a", subject: "Mathematics", title: "Joiner Only Test", date: "2026-09-03", maxScore: 20, scores: { joiner: 15 } }], { replace: true });
    await page.reload(); await page.waitForTimeout(400);
    await teacherGradesScreen(page);
    await page.locator("select").first().selectOption({ label: "Mathematics 7A" }); await page.waitForTimeout(200);
    const t = await text(page);
    if (!t.includes(EN.groupAssessments) || !t.includes("Joiner Only Test — 2026-09-03")) throw new Error("the group's test is not listed: " + t.slice(0, 400));
  }, errors);
  await browser.close();
}

// ------------------------------------------------------------------ C
{
  const { browser, page, errors } = await launch({ width: 1100, height: 950 });
  await page.goto(BASE); await page.waitForTimeout(400); // the app writes its (empty) new store on first load

  await step("C. grades held in the OLD stored shape are migrated on load: nothing lost, old key retired", async () => {
    await page.evaluate(() => {
      localStorage.removeItem("parentApp:gradeStore");
      localStorage.setItem("parentApp:gradesRecords", JSON.stringify({
        // Aisha's entry predates groupId; Umar's names his own group
        aisha: [{ id: "old1", subject: "Mathematics", title: "Old Quiz", score: 16, maxScore: 20, date: "2026-09-05" }],
        umar:  [{ id: "old2", groupId: "g-math-4a", subject: "Mathematics", title: "Old Quiz", score: 9, maxScore: 10, date: "2026-09-05" }],
      }));
    });
    await page.reload(); await page.waitForTimeout(500);
    const store = await readGradeStore(page);
    if (store.assessments.length !== 2 || store.grades.length !== 2) throw new Error("expected 2 assessments / 2 grades (same title, two different groups): " + JSON.stringify(store));
    const aishaTest = store.assessments.find(a => store.grades.some(g => g.studentId === "aisha" && g.assessmentId === a.id));
    if (aishaTest.groupId !== "g-math-7a") throw new Error("Aisha's pre-groupId entry should take her current group, got " + aishaTest.groupId);
    const left = await page.evaluate(() => localStorage.getItem("parentApp:gradesRecords"));
    if (left !== null) throw new Error("the old key is still in storage after migration");
  }, errors);

  await step("C. …and the migrated grade shows on the Parent's Grades screen exactly as before", async () => {
    await registerParent(page);
    await page.getByText(EN.navGrades, { exact: true }).last().click(); await page.waitForTimeout(450);
    const t = await text(page);
    if (!/Old Quiz · 16\/20/.test(t)) throw new Error("migrated grade not shown: " + t.slice(0, 300));
  }, errors);
  await browser.close();
}

report();
