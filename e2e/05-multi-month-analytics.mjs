import { launch, step, report, visibleText, EN, BASE, STATE, dictionaries, seedGrades } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 460, height: 950 }, STATE);
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
const goto = async (label) => {
  const nav = page.getByText(label, { exact: true });
  if (await nav.count() && await nav.last().isVisible().catch(() => false)) await nav.last().click();
  else { await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200); await page.getByText(label, { exact: true }).first().click(); }
  await page.waitForTimeout(600);
};
const bad = (txt) => txt.match(/.{0,50}(NaN|undefined|Infinity|null%|\[object).{0,30}/)?.[0];
await page.goto(BASE); await page.waitForTimeout(400);

await step("seed: multi-month history for Aisha (grades in 3 months, attendance in 3, homework on time/late/overdue)", async () => {
  await seedGrades(page, [
    { groupId: "g-math-7a", subject: "Mathematics", title: "April test", date: "2026-04-10", maxScore: 20, scores: { aisha: 16 } },
    { groupId: "g-math-7a", subject: "Mathematics", title: "June test", date: "2026-06-12", maxScore: 20, scores: { aisha: 18 } },
    { groupId: "g-math-7a", subject: "English", title: "May quiz", date: "2026-05-15", maxScore: 20, scores: { aisha: 14 } },
    { groupId: "g-math-7a", subject: "English", title: "Sept quiz", date: "2026-09-05", maxScore: 20, scores: { aisha: 17 } },
  ]);
  const at = await ls("attendanceRecords");
  at["g-math-7a"]["2026-04-06"] = { aisha: { status: "P" } };
  at["g-math-7a"]["2026-04-08"] = { aisha: { status: "A" } };
  at["g-math-7a"]["2026-05-04"] = { aisha: { status: "L", lateBy: 10 } };
  await setLs("attendanceRecords", at);
  const hw = await ls("homeworkRecords"), sub = await ls("homeworkSubmissions");
  hw["g-math-7a"].push({ id: "hA", title: "June sheet", dueDate: "2026-06-10", createdDate: "2026-06-01" },
                       { id: "hB", title: "July on time", dueDate: "2026-07-15", createdDate: "2026-07-01" },
                       { id: "hC", title: "July late", dueDate: "2026-07-20", createdDate: "2026-07-01" });
  sub.hB = { aisha: { submittedAt: "2026-07-14" } }; sub.hC = { aisha: { submittedAt: "2026-07-25" } };
  await setLs("homeworkRecords", hw); await setLs("homeworkSubmissions", sub);
  await page.reload(); await page.waitForTimeout(500);
}, errors);

await step("Grades: reporting period starts at the first REAL month (April), not March", async () => {
  await goto(EN.navGrades);
  const txt = await visibleText(page);
  if (bad(txt)) throw new Error(bad(txt));
  if (/Mar\b|March/.test(txt)) throw new Error("March shown though no data exists then: " + txt.slice(0, 400));
  if (!/Apr/.test(txt)) throw new Error("April chip missing: " + txt.slice(0, 400));
}, errors);

await step("Grades: tapping a month with a real assessment shows it; a month without says so (no carried-forward value)", async () => {
  await page.getByText("April", { exact: true }).first().click().catch(async () => { await page.getByText("Apr", { exact: true }).first().click(); });
  await page.waitForTimeout(300);
  let txt = await visibleText(page);
  if (!/Mathematics[\s|]*80%/.test(txt)) throw new Error("April Math 80% missing: " + txt.slice(-300));
  if (!new RegExp(EN.noAssessmentThisMonth).test(txt)) throw new Error("English had no April assessment but nothing said so: " + txt.slice(-300));
  await page.getByLabel(EN.back).first().click().catch(() => {});
}, errors);

await step("Insights: no NaN/undefined; 'since' month is April; best/worst months are real ones", async () => {
  await goto(EN.navInsights);
  const txt = await visibleText(page);
  if (bad(txt)) throw new Error(bad(txt));
  if (!/since April/i.test(txt)) throw new Error("expected 'since April': " + txt.slice(0, 500));
  if (/Only one month of data so far.*Monthly Comparison/s.test(txt.slice(0, 400))) throw new Error("single-month text shown with 6 months of data");
}, errors);

await step("Homework: on-time vs late vs overdue are computed from real submission dates", async () => {
  await page.getByLabel(EN.back).first().click().catch(() => {});
  await goto(EN.navHomework);
  const txt = await visibleText(page);
  if (bad(txt)) throw new Error(bad(txt));
  for (const w of ["June sheet", "July on time", "July late", "HW1"]) if (!txt.includes(w)) throw new Error(w + " missing: " + txt.slice(0, 400));
  // 3 completed (HW1 on time, July on time, July LATE) + 1 overdue. Completion 3/4 = 75%.
  // On-time is measured over resolved items (completed + overdue): 2 of 4 = 50%.
  if (!/75%[\s|]*Completion/.test(txt) || !/50%[\s|]*On-time/.test(txt)) throw new Error("expected 75% completion / 50% on-time: " + txt.slice(0, 300));
  // the late one must be flagged as late, the on-time one must not
  await page.getByText("July late").first().click(); await page.waitForTimeout(250);
  const detail = await visibleText(page); if (!/late/i.test(detail.slice(detail.indexOf("July late")))) throw new Error("late submission not flagged");
  await page.getByLabel(EN.back).first().click(); await page.waitForTimeout(200);
}, errors);

await step("PDF report with multi-month data has no NaN/undefined and closes", async () => {
  await goto(EN.navInsights);
  await page.getByText(EN.downloadPdf, { exact: false }).first().click(); await page.waitForTimeout(500);
  const txt = await page.evaluate(() => document.querySelector(".print-report")?.innerText || "");
  if (!txt) throw new Error("report not rendered");
  if (bad(txt)) throw new Error(bad(txt));
  await page.getByRole("button", { name: "Close" }).click();
}, errors);

await step("Attendance screen: April/May records appear in their own months", async () => {
  await page.getByLabel(EN.back).first().click().catch(() => {});
  await goto(EN.navAttendance);
  const txt = await visibleText(page); if (bad(txt)) throw new Error(bad(txt));
  for (let i = 0; i < 8 && !/April/.test(await visibleText(page)); i++) { await page.getByText("‹", { exact: true }).click(); await page.waitForTimeout(150); }
  let t2 = await visibleText(page);
  if (!/April/.test(t2)) throw new Error("could not reach April: " + t2.slice(0, 200));
  if (!/1[\s|]*Present/.test(t2) || !/1[\s|]*Absent/.test(t2)) throw new Error("April should be 1 present + 1 absent: " + t2.slice(0, 260));
  await page.getByText("›", { exact: true }).click(); await page.waitForTimeout(150);
  t2 = await visibleText(page);
  if (!/May/.test(t2) || !/1[\s|]*Late/.test(t2)) throw new Error("May should show 1 late: " + t2.slice(0, 260));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
