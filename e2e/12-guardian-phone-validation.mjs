import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

await step("#5a: Admin cannot save a new student with an empty guardian phone", async () => {
  await page.getByRole("button", { name: /Administrator/ }).click();
  await page.getByText(EN.navStudents, { exact: true }).first().click();
  await page.getByRole("button", { name: EN.addStudent }).click();
  const form = page.locator("div").filter({ has: page.getByRole("button", { name: EN.save }) }).last();
  const inputs = form.locator("input");
  await inputs.nth(0).fill("No Phone Kid"); await inputs.nth(1).fill("Grade 1");
  await inputs.nth(2).fill("No Phone Parent"); // phone left empty
  await page.getByRole("button", { name: EN.save }).click();
  await expectText(EN.invalidGuardianPhone);
  const students = await ls("students");
  if (students.some(s => s.name === "No Phone Kid")) throw new Error("student was created despite missing phone");
}, errors);

await step("#5b: entering a valid phone clears the error and the student IS created with a normalized phone", async () => {
  const form = page.locator("div").filter({ has: page.getByRole("button", { name: EN.save }) }).last();
  const inputs = form.locator("input");
  await inputs.nth(3).fill("901112233");
  await page.getByRole("button", { name: EN.save }).click();
  await page.waitForTimeout(250);
  const students = await ls("students");
  const kid = students.find(s => s.name === "No Phone Kid");
  if (!kid) throw new Error("student not created with a valid phone");
  if (kid.guardians[0].phone !== "+998 90 111 22 33") throw new Error("phone not normalized: " + kid.guardians[0].phone);
}, errors);

await step("#5c: Admin editing a student's primary phone to collide with that SAME student's other guardian is blocked", async () => {
  const students = await ls("students");
  const malika = students.find(s => s.id === "aisha-friend-1");
  malika.guardians.push({ id: "g-second", name: "Second Guardian", phone: "+998 90 999 11 22", role: "Father" });
  await setLs("students", students);
  await page.reload(); await page.waitForTimeout(400);
  await page.getByText(EN.navStudents, { exact: true }).first().click(); await page.waitForTimeout(300);
  const row = page.locator("div", { hasText: "Malika" }).filter({ has: page.getByLabel(EN.edit) }).last();
  await row.getByLabel(EN.edit).click();
  // Find the open edit container via its unique "Additional guardians"
  // label (static text), not a value-based CSS selector — the latter stops
  // matching the moment .fill() changes the input's value.
  const editBox = page.locator("div", { hasText: EN.additionalGuardians }).filter({ has: page.getByRole("button", { name: EN.save }) }).last();
  const editPhoneInput = editBox.locator("input").nth(3); // name, grade, guardianName, guardianPhone
  await editPhoneInput.fill("90 999 11 22");
  await page.getByRole("button", { name: EN.save }).click();
  await expectText(EN.duplicateGuardianPhone);
  const after = (await ls("students")).find(s => s.id === "aisha-friend-1");
  if (after.guardians[0].phone !== "+998 90 555 12 34") throw new Error("primary phone changed despite duplicate block: " + after.guardians[0].phone);
}, errors);

await step("#5d: fixing the phone to a non-colliding, valid number saves successfully", async () => {
  const editBox = page.locator("div", { hasText: EN.additionalGuardians }).filter({ has: page.getByRole("button", { name: EN.save }) }).last();
  const editPhoneInput = editBox.locator("input").nth(3);
  await editPhoneInput.fill("905554433");
  await page.getByRole("button", { name: EN.save }).click();
  await page.waitForTimeout(250);
  const after = (await ls("students")).find(s => s.id === "aisha-friend-1");
  if (after.guardians[0].phone !== "+998 90 555 44 33") throw new Error("valid edit did not save: " + JSON.stringify(after.guardians));
  if (after.guardians.length !== 2) throw new Error("second guardian lost during edit: " + JSON.stringify(after.guardians));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
