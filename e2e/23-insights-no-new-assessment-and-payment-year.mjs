import { launch, step, report, visibleText, EN, BASE, seedGrades } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

const register = async () => {
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code); await page.getByRole("button", { name: EN.verifyCode }).click();
  await page.waitForTimeout(400);
};

// ---------- #1: "No new assessment" month in Insights/PDF Monthly Comparison ----------
await step("setup: Aisha has only ONE real assessment, in May — September (the demo's current month) carries it forward with no new test", async () => {
  await register();
  await seedGrades(page, [{ groupId: "g-math-7a", subject: "Mathematics", title: "May Only Quiz", date: "2026-05-08", maxScore: 20, scores: { aisha: 16 } }], { replace: true });
  await page.reload(); await page.waitForTimeout(500);
}, errors);

await step("Insights' Monthly Comparison table says 'No assessment this month' for September's Overall row, not a fake 80%", async () => {
  await page.getByText(EN.navMore, { exact: true }).last().click().catch(() => {});
  await page.getByText(EN.navInsights, { exact: true }).first().click(); await page.waitForTimeout(500);
  const txt = await visibleText(page);
  const sectionIdx = txt.indexOf(EN.monthlyComparison);
  if (sectionIdx === -1) throw new Error("Monthly Comparison section not found: " + txt.slice(0, 500));
  const idx = txt.indexOf(EN.overallLabel, sectionIdx);
  if (idx === -1) throw new Error("Overall row not found within Monthly Comparison: " + txt.slice(sectionIdx, sectionIdx + 400));
  const win = txt.slice(idx, idx + 150);
  // The row is "Overall | <prev month> <prev%> | <curr month> <curr text>" — the
  // PREVIOUS column legitimately still shows August 80% (carried forward, fine);
  // only the CURRENT (September) column must say "No assessment", not 80%.
  const septIdx = win.indexOf("September");
  if (septIdx === -1) throw new Error("September column not found in the Overall row: " + win);
  const septWindow = win.slice(septIdx, septIdx + 40);
  if (!new RegExp(EN.noAssessmentThisMonth).test(septWindow)) throw new Error("expected September to say 'No assessment this month': " + septWindow);
  if (/80%/.test(septWindow)) throw new Error("September column still shows a fake 80% result: " + septWindow);
}, errors);

// ---------- #3: payment history label includes the year ----------
await step("setup: a payment recorded a while ago, to check the history label", async () => {
  await setLs("paymentTransactions", { aisha: [{ id: "tx1", amount: 450000, date: "2026-08-05", method: "cash" }] });
  await page.reload(); await page.waitForTimeout(500);
}, errors);

await step("Payment history label shows the year, not just the bare month", async () => {
  await page.getByText(EN.navMore, { exact: true }).last().click().catch(() => {});
  await page.getByText(EN.navPayments, { exact: true }).first().click(); await page.waitForTimeout(400);
  const txt = await visibleText(page);
  if (!/Aug 2026/.test(txt)) throw new Error("expected 'Aug 2026' label with year, got: " + txt.slice(0, 400));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
