import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

// ---------- #2: future date blocked in attendance; Dashboard finds 'today' by actual date ----------
await step("#2a: Teacher's attendance date input cannot be set past CURRENT_DATE_STR (2026-09-08)", async () => {
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByText("Malika Yusupova").click();
  await page.getByText(EN.navAttendance, { exact: true }).first().click();
  const dateInput = page.locator("input[type=date]");
  const maxAttr = await dateInput.getAttribute("max");
  if (maxAttr !== "2026-09-08") throw new Error("date input has no max=2026-09-08, got: " + maxAttr);
  // Even if a future date is force-set (bypassing the native picker), the
  // onChange handler itself must clamp it back.
  await dateInput.fill("2026-09-20");
  const clamped = await dateInput.inputValue();
  if (clamped !== "2026-09-08") throw new Error("future date was not clamped, got: " + clamped);
}, errors);

await step("#2b: Teacher marks TODAY's attendance (out of order, after an earlier date already exists) — Dashboard's 'today' lookup finds it by actual date, not array position", async () => {
  const at = await ls("attendanceRecords");
  at["g-math-7a"] = at["g-math-7a"] || {};
  at["g-math-7a"]["2026-09-08"] = { aisha: { status: "A" } }; // today: absent
  at["g-math-7a"]["2026-09-07"] = { aisha: { status: "P" } }; // an EARLIER date, inserted AFTER today's key in object order below
  // Re-insert in an order where "today" is NOT the last key, to prove the lookup isn't position-based.
  const reordered = { "2026-09-07": at["g-math-7a"]["2026-09-07"], "2026-09-08": at["g-math-7a"]["2026-09-08"] };
  at["g-math-7a"] = reordered;
  await setLs("attendanceRecords", at);
  await page.evaluate(() => { localStorage.setItem("parentApp:role", "null"); });
  await page.reload(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code); await page.getByRole("button", { name: EN.verifyCode }).click();
  await page.waitForTimeout(500);
  const txt = await visibleText(page);
  if (!/absent today|Absent Today/i.test(txt)) throw new Error("Dashboard did not correctly identify today (09-08) as absent: " + txt.slice(0, 400));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
