import { launch, step, report, visibleText, EN, BASE, seedGrades } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

// ---------- #1: homework 'undefined' time ----------
await step("Teacher assigns homework to Umar's group", async () => {
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByText("Malika Yusupova").click();
  await page.getByText(EN.navHomework, { exact: true }).first().click();
  await page.locator("select").first().selectOption({ label: "Mathematics 4A" });
  await page.getByPlaceholder("e.g. Worksheet 5, problems 1").fill("No Time Field HW");
  await page.locator("input[type=date]").fill("2026-09-20");
  await page.getByRole("button", { name: EN.assignHomework }).first().click();
  await page.waitForTimeout(300);
}, errors);

await step("#1 fix: Parent's Homework screen never shows the literal word 'undefined'", async () => {
  await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code); await page.getByRole("button", { name: EN.verifyCode }).click();
  await page.waitForTimeout(400);
  await page.getByText("▾").first().click(); await page.getByText("Umar").first().click(); await page.waitForTimeout(300);
  await page.getByText(EN.navHomework, { exact: true }).last().click(); await page.waitForTimeout(400);
  const txt = await visibleText(page);
  if (!/No Time Field HW/.test(txt)) throw new Error("homework missing: " + txt.slice(0, 300));
  if (/undefined/.test(txt)) throw new Error("literal 'undefined' shown: " + txt.slice(0, 400));
  await page.getByText("No Time Field HW").first().click(); await page.waitForTimeout(250);
  const detailTxt = await visibleText(page);
  if (/undefined/.test(detailTxt)) throw new Error("'undefined' shown in homework detail sheet: " + detailTxt.slice(0, 400));
}, errors);

// ---------- #2: class average must match exact date, not just title ----------
let teacherPage;
await step("#2 setup: Aisha's group — SAME title 'Quiz 1' graded on TWO different dates for Aisha, and only on the FIRST date for a peer", async () => {
  const students = await ls("students");
  students.push({ id: "date-peer", name: "Date Peer", grade: "Grade 7", groupId: "g-math-7a", guardians: [{ id: "g-dp", name: "Date Peer Parent", phone: "+998 90 222 44 66", role: "Guardian" }], connectionCode: null });
  await setLs("students", students);
  const groups = await ls("groups"); groups.find(g => g.id === "g-math-7a").studentIds.push("date-peer");
  await setLs("groups", groups);
  await seedGrades(page, [
    // the OLD "Quiz 1": Aisha 50%, her classmate 20%
    { id: "q1-old", groupId: "g-math-7a", subject: "Mathematics", title: "Quiz 1", date: "2026-09-10", maxScore: 20, scores: { aisha: 10, "date-peer": 4 } },
    // the NEW "Quiz 1" (same title, later date): only Aisha was graded — 90%
    { id: "q1-new", groupId: "g-math-7a", subject: "Mathematics", title: "Quiz 1", date: "2026-09-20", maxScore: 20, scores: { aisha: 18 } },
  ]);
  await page.evaluate(() => { localStorage.setItem("parentApp:role", "null"); });
  await page.reload(); await page.waitForTimeout(300);
}, errors);

await step("#2 fix: Parent sees Aisha's NEWEST Quiz 1 (90%) with NO comparison data — the peer's score was on a DIFFERENT date and must not be used", async () => {
  // Dilnoza is already registered and recognized from the earlier step —
  // clicking Parent lands straight on the dashboard, no OTP needed again.
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(400);
  await page.getByText("▾").first().click(); await page.waitForTimeout(200);
  await page.getByText("Aisha").first().click(); await page.waitForTimeout(300);
  await page.getByText(EN.navGrades, { exact: true }).last().click(); await page.waitForTimeout(500);
  const txt = await visibleText(page);
  const idx = txt.indexOf("Quiz 1");
  if (idx === -1) throw new Error("Quiz 1 row missing: " + txt.slice(0, 300));
  const win = txt.slice(idx, idx + 250);
  if (!/18\/20/.test(win)) throw new Error("expected the NEWEST Quiz 1 score (18/20): " + win);
  // The peer only graded on the OLD date (2026-09-10), not the new one
  // (2026-09-20) Aisha's 90% is from — so there's genuinely no real
  // comparison for THIS specific assessment, and the old bug would have
  // wrongly shown "Above group average" using the peer's unrelated 20%.
  if (!new RegExp(EN.noComparisonData).test(win)) throw new Error("expected 'No comparison data' (peer graded a different date): " + win);
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
