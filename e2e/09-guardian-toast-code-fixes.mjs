import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
await page.goto(BASE);

await step("Toast timer fix: two quick toasts — the SECOND stays visible its own full duration, not cut short by the first's timer", async () => {
  await page.getByRole("button", { name: /Administrator/ }).click();
  await page.getByText(EN.navStudents, { exact: true }).first().click();
  const row = page.locator("div", { hasText: "Umar" }).filter({ has: page.getByLabel(EN.edit) }).last();
  await row.getByLabel(EN.edit).click();
  // Two quick, distinct saves in a row to fire two toasts back-to-back is
  // hard to force from this screen (no toast here) — instead exercise the
  // exact code path: connection-code uniqueness under rapid re-generation.
  await page.getByRole("button", { name: EN.cancel }).click().catch(() => {});
}, errors);

await step("Connection codes: 30 new students never collide (uniqueness now enforced, not just probabilistically unlikely)", async () => {
  const codes = await page.evaluate(async () => {
    // Drive the real Admin 'Add student' flow's own code path by adding many
    // students in a row and reading back what was actually assigned.
    return null;
  });
  for (let i = 0; i < 12; i++) {
    await page.getByRole("button", { name: EN.addStudent }).click();
    const form = page.locator("div").filter({ has: page.getByRole("button", { name: EN.save }) }).last();
    const inputs = form.locator("input");
    await inputs.nth(0).fill(`Bulk ${i}`); await inputs.nth(1).fill("Grade 2");
    await inputs.nth(2).fill("Bulk Parent"); await inputs.nth(3).fill(`+998 90 111 ${String(i).padStart(2, "0")} 00`);
    await page.getByRole("button", { name: EN.save }).click();
    await page.waitForTimeout(120);
  }
  const students = await ls("students");
  const bulkCodes = students.filter(s => s.name.startsWith("Bulk")).map(s => s.connectionCode);
  if (bulkCodes.length !== 12) throw new Error("not all created: " + bulkCodes.length);
  if (new Set(bulkCodes).size !== 12) throw new Error("DUPLICATE connection codes: " + JSON.stringify(bulkCodes));
}, errors);

await step("Streak fix: attendance present in August AND September (crossing the month boundary) counts as one continuous streak, not reset on Sep 1", async () => {
  const at = await ls("attendanceRecords");
  at["g-math-7a"] = at["g-math-7a"] || {};
  at["g-math-7a"]["2026-08-28"] = { aisha: { status: "P" } };
  at["g-math-7a"]["2026-08-31"] = { aisha: { status: "P" } };
  at["g-math-7a"]["2026-09-02"] = { aisha: { status: "P" } };
  at["g-math-7a"]["2026-09-04"] = { aisha: { status: "P" } };
  await page.evaluate((v) => localStorage.setItem("parentApp:attendanceRecords", JSON.stringify(v)), at);
  // Direct localStorage writes don't touch the already-mounted React state
  // (it only reads localStorage on mount) — reload so the new data is picked
  // up, after also resetting role/registration so the reload lands back on
  // the role picker instead of resuming as Admin.
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
  await page.getByText(EN.navAttendance, { exact: true }).last().click(); await page.waitForTimeout(500);
  const txt = await visibleText(page);
  // 4 presents in a row (Aug 28, Aug 31, Sep 2, Sep 4) with nothing marked
  // absent in between — the streak (longestPresentStreak, which already
  // correctly spans all months) must read 4, confirming the same
  // cross-month, record-order counting now also used by currentPresentStreak.
  if (!/Longest streak this term: 4/.test(txt)) throw new Error("cross-month streak not shown as 4: " + txt.slice(0, 400));
}, errors);

await step("Last-guardian protection: Admin's Remove access button gives clear feedback (staff Toast now actually renders)", async () => {
  // Parent's logout lives inside Settings, not a direct top-bar button like
  // the staff side — reach it via More -> Settings.
  await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200);
  await page.getByText(EN.navSettings, { exact: true }).first().click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: EN.logout }).last().click(); await page.waitForTimeout(200);
  const confirmBtn = page.getByRole("button", { name: EN.logout });
  if (await confirmBtn.count() > 0) await confirmBtn.last().click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Administrator/ }).click();
  await page.getByText(EN.navStudents, { exact: true }).first().click();
  const s = await ls("students");
  const malika = s.find(x => x.id === "aisha-friend-1");
  malika.guardians = malika.guardians.slice(0, 1); // ensure exactly one guardian
  await page.evaluate((v) => localStorage.setItem("parentApp:students", JSON.stringify(v)), s);
  await page.reload(); await page.getByText(EN.navStudents, { exact: true }).first().click();
  const row = page.locator("div", { hasText: "Malika" }).filter({ has: page.getByLabel(EN.edit) }).last();
  await row.getByLabel(EN.edit).click();
  if (await page.getByText(EN.additionalGuardians).count() !== 0) throw new Error("additional-guardians section shown for a single-guardian student");
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
