import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

// ---------- #7: Add Student required-field validation ----------
await step("#7a: Admin blocked from saving a student with empty grade", async () => {
  await page.getByRole("button", { name: /Administrator/ }).click();
  await page.getByText(EN.navStudents, { exact: true }).first().click();
  await page.getByRole("button", { name: EN.addStudent }).click();
  const form = page.locator("div").filter({ has: page.getByRole("button", { name: EN.save }) }).last();
  const inputs = form.locator("input");
  await inputs.nth(0).fill("Grade Test Kid"); // name only, grade left empty
  await inputs.nth(2).fill("Grade Test Parent");
  await inputs.nth(3).fill("901234999");
  await page.getByRole("button", { name: EN.save }).click();
  await expectText(EN.studentGradeRequired);
  if ((await ls("students")).some(s => s.name === "Grade Test Kid")) throw new Error("created despite missing grade");
}, errors);

await step("#7b: Admin blocked from saving a student with empty guardian name (no silent phone-as-name fallback)", async () => {
  const form = page.locator("div").filter({ has: page.getByRole("button", { name: EN.save }) }).last();
  const inputs = form.locator("input");
  await inputs.nth(1).fill("Grade 2");
  await inputs.nth(2).fill(""); // clear guardian name
  await page.getByRole("button", { name: EN.save }).click();
  await expectText(EN.guardianNameRequired);
  if ((await ls("students")).some(s => s.name === "Grade Test Kid")) throw new Error("created despite missing guardian name");
}, errors);

await step("#7c: filling everything required creates the student successfully", async () => {
  const form = page.locator("div").filter({ has: page.getByRole("button", { name: EN.save }) }).last();
  const inputs = form.locator("input");
  await inputs.nth(2).fill("Grade Test Parent");
  await page.getByRole("button", { name: EN.save }).click();
  await page.waitForTimeout(250);
  const kid = (await ls("students")).find(s => s.name === "Grade Test Kid");
  if (!kid) throw new Error("not created even with all fields filled");
  if (kid.guardians[0].name !== "Grade Test Parent") throw new Error("guardian name wrong: " + JSON.stringify(kid.guardians));
}, errors);

// ---------- #2: homework due in a FUTURE month (October) countdown ----------
await step("#2 setup: Teacher assigns homework due 2026-10-05 (October — outside the Mar-Sep tracked range)", async () => {
  await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByText("Malika Yusupova").click();
  await page.getByText(EN.navHomework, { exact: true }).first().click();
  await page.locator("select").first().selectOption({ label: "Mathematics 4A" });
  await page.locator("input[type=date]").evaluate((el) => el.removeAttribute("max"));
  await page.locator("input[type=date]").fill("2026-10-05");
  await page.getByPlaceholder("e.g. Worksheet 5, problems 1").fill("October HW");
  await page.getByRole("button", { name: EN.assignHomework }).first().click();
  await page.waitForTimeout(300);
  const hw = (await ls("homeworkRecords"))["g-math-4a"];
  if (!hw?.some(h => h.title === "October HW" && h.dueDate === "2026-10-05")) throw new Error("October homework not saved: " + JSON.stringify(hw));
}, errors);

await step("#2 fix: Parent sees a correct countdown (27 days) for the October homework, not 0 or a wrong value", async () => {
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
  await page.getByText("October HW").first().click(); await page.waitForTimeout(250);
  const txt = await visibleText(page);
  if (!/27/.test(txt)) throw new Error("expected a 27-day countdown, got: " + txt.slice(0, 400));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
