import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

// ---------- #1: staff screen state must reset on role change ----------
await step("#1 setup: Teacher navigates to Attendance", async () => {
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByText("Malika Yusupova").click();
  await page.getByText(EN.navAttendance, { exact: true }).first().click();
  await expectText(EN.navAttendance);
}, errors);

await step("#1 fix: logging out and signing in as Admin lands on a properly-highlighted Dashboard, not a phantom 'attendance' screen", async () => {
  await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Administrator/ }).click(); await page.waitForTimeout(300);
  const txt = await visibleText(page);
  if (!/Dashboard/.test(txt)) throw new Error("not on Dashboard: " + txt.slice(0, 200));
  if (await page.getByLabel(EN.back).count() > 0) throw new Error("a stray Back button is shown — activeScreen is out of sync");
  // Students, Groups, Teachers, Payments must all be reachable (sidebar not confused)
  await page.getByText(EN.navStudents, { exact: true }).first().click();
  await expectText(EN.navStudents);
}, errors);

// ---------- #2: Attendance with zero data for a month shows real 'no data', not null% or a false drop ----------
await step("#2 setup: Umar has August attendance but ZERO September records", async () => {
  await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
  const at = { "g-math-4a": { "2026-08-10": { umar: { status: "P" } }, "2026-08-11": { umar: { status: "P" } } } };
  await setLs("attendanceRecords", at);
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
}, errors);

await step("#2 fix: September (the default/current month, zero records) shows 'No data', not 'nullNaN%' and not a false drop message", async () => {
  await page.getByText(EN.navAttendance, { exact: true }).last().click(); await page.waitForTimeout(400);
  let txt = await visibleText(page);
  if (/null%|NaN/.test(txt)) throw new Error("shows null%/NaN: " + txt.slice(0, 400));
  if (!new RegExp(EN.noAttendanceData).test(txt)) throw new Error("expected 'No data' shown: " + txt.slice(0, 400));
  if (new RegExp(EN.attendanceDropMsg).test(txt)) throw new Error("falsely shows an attendance-dropped message comparing against August: " + txt.slice(0, 400));
}, errors);

// ---------- #6/#7: Operator unread count reflects ACTUAL unread state ----------
await step("#6/#7 setup: switch to Operator, check the seeded unread count", async () => {
  await page.getByText(EN.navMore, { exact: true }).last().click().catch(() => {});
  await page.getByText(EN.navSettings, { exact: true }).first().click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: EN.logout }).last().click(); await page.waitForTimeout(200);
  const confirmBtn = page.getByRole("button", { name: EN.logout }); if (await confirmBtn.count() > 0) await confirmBtn.last().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Operator/ }).click(); await page.waitForTimeout(300);
  const txt = await visibleText(page);
  // Seed data: Aisha's m6 and Umar's u1 are the only genuinely-unread parent messages -> 2
  const m = txt.match(/(\d+)\s*\|?\s*Unread/i) || txt.match(/Unread[^\d]*(\d+)/i);
  if (!m || Number(m[1]) !== 2) throw new Error("expected unread count 2 (not counting every parent message ever sent): " + txt.slice(0, 300));
}, errors);

await step("#6/#7 fix: opening a thread (including whichever is selected by default on screen-open) marks it read — unread count drops accordingly", async () => {
  await page.getByText(EN.navMessages, { exact: true }).first().click(); await page.waitForTimeout(300);
  // Landing on Messages shows SOME thread by default -> that one is read
  // too, in addition to Umar once explicitly clicked.
  await page.getByText("Umar").first().click(); await page.waitForTimeout(300);
  const threads = await ls("messageThreads");
  if (threads.umar[0].readByOperator !== true) throw new Error("Umar's message not marked read after opening the thread: " + JSON.stringify(threads.umar));
  const stillUnread = Object.values(threads).reduce((sum, t) => sum + t.filter(m => m.from === "parent" && !m.readByOperator).length, 0);
  if (stillUnread !== 0) throw new Error("expected 0 unread left (default-selected thread + Umar both now opened): " + JSON.stringify(threads));
  await page.getByText(EN.navHomeStaff, { exact: true }).first().click(); await page.waitForTimeout(300);
  const txt = await visibleText(page);
  const m = txt.match(/(\d+)\s*\|?\s*Unread/i) || txt.match(/Unread[^\d]*(\d+)/i);
  if (!m || Number(m[1]) !== 0) throw new Error("Dashboard count should now be 0: " + txt.slice(0, 300));
}, errors);

await step("#6/#7 contrast: a NEW parent message makes the count go back up, proving it is not simply stuck at 0", async () => {
  const threads = await ls("messageThreads");
  threads.umar.push({ id: "u-new", from: "parent", text: "New question", time: "2026-09-08T15:00:00", readByOperator: false });
  await setLs("messageThreads", threads);
  await page.reload(); await page.waitForTimeout(400);
  const txt = await visibleText(page);
  const m = txt.match(/(\d+)\s*\|?\s*Unread/i) || txt.match(/Unread[^\d]*(\d+)/i);
  if (!m || Number(m[1]) !== 1) throw new Error("expected count to go back up to 1 for the new unread message: " + txt.slice(0, 300));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
