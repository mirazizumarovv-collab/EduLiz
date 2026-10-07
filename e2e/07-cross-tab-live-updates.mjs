import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };

await page.goto(BASE);

await step("setup: sign in as Parent (Aisha, Dilnoza)", async () => {
  await page.getByRole("button", { name: /Parent/ }).click();
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code);
  await page.getByRole("button", { name: EN.verifyCode }).click();
  await page.waitForTimeout(500);
  if (!(await has("Aisha"))) throw new Error("not on Aisha's dashboard: " + (await visibleText(page)).slice(0, 200));
}, errors);

await step("Parent opens Grades screen — no grades yet", async () => {
  await page.getByText(EN.navGrades, { exact: true }).last().click();
  await page.waitForTimeout(500);
  if (await has("Mathematics")) throw new Error("unexpected existing grade: " + (await visibleText(page)).slice(0, 300));
}, errors);

let teacherPage, teacherCtx;
await step("Teacher opens a SEPARATE tab in the SAME browser and enters a grade for Aisha, while Parent's Grades screen stays open", async () => {
  teacherCtx = await page.context();
  teacherPage = await teacherCtx.newPage(); teacherPage.setDefaultTimeout(4000);
  await teacherPage.goto(BASE);
  // This browser context's localStorage already has role="parent" from the
  // Parent tab (shared per-origin storage) — explicitly switch THIS tab to
  // Teacher, independent of what the Parent tab is showing.
  await teacherPage.evaluate(() => { localStorage.setItem("parentApp:role", '"teacher"'); localStorage.setItem("parentApp:currentTeacherId", '"t-malika"'); });
  await teacherPage.reload(); await teacherPage.waitForTimeout(400);
  await teacherPage.getByText(EN.navGrades, { exact: true }).first().click();
  await teacherPage.getByPlaceholder("e.g. Test 3").fill("Live Update Quiz");
  const nums = teacherPage.locator("input[type=number]");
  await nums.nth(0).fill("20");
  await nums.nth(1).fill("18"); // Aisha's score
  await teacherPage.getByRole("button", { name: "Save grades" }).click();
  await teacherPage.waitForTimeout(300);
}, errors);

await step("Parent's ALREADY-OPEN Grades screen updates WITHOUT reload or re-navigation", async () => {
  await page.waitForTimeout(900); // give the live-dependency re-fetch (with its simulated delay) time to land
  const txt = await visibleText(page);
  if (!/Live Update Quiz/.test(txt)) throw new Error("new grade did not appear live: " + txt.slice(0, 400));
  if (!/90%|18\/20/.test(txt)) throw new Error("score not shown: " + txt.slice(0, 400));
}, errors);

await step("Parent's Dashboard (a different screen) also reflects it once visited — sanity check", async () => {
  await page.getByText(EN.navHomeStaff, { exact: true }).first().click().catch(() => {});
  await page.getByText("Home", { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(500);
  const txt = await visibleText(page);
  if (!/90%/.test(txt)) throw new Error("dashboard current average not updated: " + txt.slice(0, 300));
}, errors);

await step("Teacher marks attendance for Aisha in the second tab; Parent's Attendance screen (already open) updates live", async () => {
  await page.getByText(EN.navAttendance, { exact: true }).last().click(); await page.waitForTimeout(400);
  const beforeTxt = await visibleText(page);
  await teacherPage.getByText(EN.navAttendance, { exact: true }).first().click(); await teacherPage.waitForTimeout(300);
  const presentBtns = teacherPage.getByRole("button", { name: EN.present });
  const n = await presentBtns.count();
  for (let i = 0; i < n; i++) await presentBtns.nth(i).click();
  await teacherPage.getByRole("button", { name: "Save attendance" }).click();
  await teacherPage.waitForTimeout(900);
  const afterTxt = await visibleText(page);
  if (afterTxt === beforeTxt) throw new Error("attendance screen did not change at all");
  if (!/100%/.test(afterTxt)) throw new Error("attendance rate not live-updated: " + afterTxt.slice(0, 300));
}, errors);

await step("Operator marks the parent's Payment as paid; Parent's Payments screen (already open) updates live", async () => {
  await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200);
  await page.getByText(EN.navPayments, { exact: true }).first().click(); await page.waitForTimeout(400);
  const opPage = await teacherCtx.newPage(); opPage.setDefaultTimeout(4000);
  await opPage.goto(BASE);
  await opPage.evaluate(() => localStorage.setItem("parentApp:role", '"admin"'));
  await opPage.reload(); await opPage.waitForTimeout(400);
  await opPage.getByText(EN.navPayments, { exact: true }).first().click(); await opPage.waitForTimeout(300);
  // Aisha defaults to "paid" in the seed data — reset to pending first so
  // there is a real "Mark as paid" transition to observe.
  let aishaRow = opPage.locator("div", { hasText: "Aisha" }).filter({ has: opPage.getByRole("button", { name: EN.startNewBillingMonth }) }).last();
  await aishaRow.getByRole("button", { name: EN.startNewBillingMonth }).click(); await opPage.waitForTimeout(200);
  aishaRow = opPage.locator("div", { hasText: "Aisha" }).filter({ has: opPage.getByRole("button", { name: EN.markAsPaid }) }).last();
  await aishaRow.getByRole("button", { name: EN.markAsPaid }).click();
  await opPage.waitForTimeout(700);
  const txt = await visibleText(page);
  if (!new RegExp(EN.paid, "i").test(txt)) throw new Error("payment status not live-updated: " + txt.slice(0, 300));
  await opPage.close();
}, errors);

report();
console.log("\nALL ERRORS:", errors);
await browser.close();
