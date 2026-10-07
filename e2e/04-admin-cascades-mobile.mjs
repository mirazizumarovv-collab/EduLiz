import { launch, step, report, visibleText, EN, BASE, STATE, dictionaries, readGradesRecords } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 }, STATE);
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
const asAdmin = async () => { await page.goto(BASE); await page.evaluate(() => localStorage.setItem("parentApp:role", '"admin"')); await page.reload(); await page.waitForTimeout(400); };
await page.goto(BASE); await page.waitForTimeout(400);
const kid = (await ls("students")).find(s => s.name === "Test Kid");

// seed related data for Test Kid in EVERY store so the cascade has something to clean
await step("seed: Test Kid has data in grades, attendance, homework, payments, messages", async () => {
  const hw = (await ls("homeworkRecords"))["g-math-7a"][0].id;
  const sub = await ls("homeworkSubmissions"); sub[hw][kid.id] = { submittedAt: "2026-09-08" }; await setLs("homeworkSubmissions", sub);
  const ps = await ls("paymentsStatus"); ps[kid.id] = "paid"; await setLs("paymentsStatus", ps);
  const pt = await ls("paymentTransactions"); pt[kid.id] = [{ id: "tx-k", amount: 450000, date: "2026-09-08", method: "cash" }]; await setLs("paymentTransactions", pt);
  const mt = await ls("messageThreads"); mt[kid.id] = [{ id: "m1", from: "parent", text: "hi", time: "2026-09-08T10:00:00" }]; await setLs("messageThreads", mt);
  if (!(await readGradesRecords(page))[kid.id]) throw new Error("no grade seeded by stage1");
}, errors);

await step("Admin: deleting a student cascades to grades, attendance, homework submissions, payments, messages, roster", async () => {
  await asAdmin();
  await page.getByText(EN.navStudents, { exact: true }).first().click(); await expectText("Test Kid");
  const row = page.locator("div", { hasText: "Test Kid" }).filter({ has: page.getByLabel(EN.delete) }).last();
  await row.getByLabel(EN.delete).click(); await page.getByRole("button", { name: EN.confirmDelete }).click(); await page.waitForTimeout(300);
  const id = kid.id;
  const left = [];
  if ((await ls("students")).some(s => s.id === id)) left.push("students");
  if ((await readGradesRecords(page))[id]) left.push("grades");
  if (Object.values((await ls("attendanceRecords"))["g-math-7a"] || {}).some(d => id in d)) left.push("attendance");
  if (Object.values(await ls("homeworkSubmissions")).some(h => id in h)) left.push("submissions");
  if (id in (await ls("paymentsStatus"))) left.push("paymentsStatus");
  if (id in (await ls("paymentTransactions"))) left.push("transactions");
  if (id in (await ls("messageThreads"))) left.push("messages");
  if ((await ls("groups")).some(g => g.studentIds.includes(id))) left.push("group roster");
  if (left.length) throw new Error("orphans left in: " + left.join(", "));
}, errors);

await step("Admin: remove an additional guardian from the student edit form", async () => {
  const students = await ls("students"); const m = students.find(s => s.id === "aisha-friend-1");
  m.guardians.push({ id: "g-x", name: "Extra Aunt", phone: "+998 90 000 11 22", role: "Guardian" }); await setLs("students", students);
  await page.reload(); await page.getByText(EN.navStudents, { exact: true }).first().click();
  const row = page.locator("div", { hasText: "Malika" }).filter({ has: page.getByLabel(EN.edit) }).last();
  await row.getByLabel(EN.edit).click(); await expectText("Extra Aunt");
  await page.getByRole("button", { name: EN.removeAccess }).click(); await page.waitForTimeout(250);
  const g = (await ls("students")).find(s => s.id === "aisha-friend-1").guardians;
  if (g.length !== 1 || g[0].name !== "Shahnoza") throw new Error(JSON.stringify(g));
}, errors);

await step("Admin: deleting a group removes its attendance, homework and submissions; students become unassigned", async () => {
  await page.getByText(EN.navAllGroups, { exact: true }).first().click(); await expectText("Mathematics 7A");
  const hwIds = ((await ls("homeworkRecords"))["g-math-7a"] || []).map(h => h.id);
  if (!hwIds.length || !(await ls("attendanceRecords"))["g-math-7a"]) throw new Error("nothing to cascade (setup)");
  const card = page.locator("div", { hasText: "Mathematics 7A" }).filter({ has: page.getByLabel(EN.delete) }).last();
  await card.getByLabel(EN.delete).click(); await page.getByRole("button", { name: EN.confirmDelete }).click(); await page.waitForTimeout(300);
  const left = [];
  if ("g-math-7a" in (await ls("attendanceRecords"))) left.push("attendance");
  if ("g-math-7a" in (await ls("homeworkRecords"))) left.push("homework");
  const sub = await ls("homeworkSubmissions"); if (hwIds.some(id => id in sub)) left.push("submissions");
  if (left.length) throw new Error("orphans: " + left.join(", "));
  if ((await ls("students")).find(s => s.id === "aisha").groupId !== null) throw new Error("Aisha still assigned");
}, errors);

await step("Admin: deleting a teacher leaves groups without one; 'Assign teacher' fixes it inline", async () => {
  await page.getByText(EN.navTeachers, { exact: true }).first().click(); await expectText("Sherzod Aliyev");
  const row = page.locator("div", { hasText: "Sherzod Aliyev" }).filter({ has: page.getByLabel(EN.delete) }).last();
  await row.getByLabel(EN.delete).click(); await page.getByRole("button", { name: EN.confirmDelete }).click(); await page.waitForTimeout(300);
  await page.getByText(EN.navAllGroups, { exact: true }).first().click();
  await expectText(EN.noTeacherAssigned);
  if ((await ls("groups")).filter(g => g.teacherId === null).length < 2) throw new Error("groups not cleared");
  await page.locator("select").filter({ has: page.locator("option", { hasText: EN.assignTeacher }) }).first().selectOption({ label: "Malika Yusupova" });
  await page.waitForTimeout(250);
  if ((await ls("groups")).filter(g => g.teacherId === null).length !== 1) throw new Error("assign did not stick");
}, errors);

await step("Teacher screens with a group that has no students / a teacher with no groups don't crash", async () => {
  await page.evaluate(() => { localStorage.setItem("parentApp:role", '"teacher"'); localStorage.setItem("parentApp:currentTeacherId", '"t-malika"'); });
  await page.reload(); await page.waitForTimeout(400);
  for (const n of [EN.navGroups, EN.navAttendance, EN.navGrades, EN.navHomework]) { await page.getByText(n, { exact: true }).first().click(); await page.waitForTimeout(250); }
  // teacher with NO groups at all
  const groups = await ls("groups"); groups.forEach(g => { g.teacherId = null; }); await setLs("groups", groups);
  await page.reload(); await page.waitForTimeout(400);
  for (const n of [EN.navHomeStaff, EN.navGroups, EN.navAttendance, EN.navGrades, EN.navHomework]) { await page.getByText(n, { exact: true }).first().click(); await page.waitForTimeout(250); }
}, errors);

await step("Staff mobile layout: hamburger opens a labelled drawer, navigation works, drawer closes", async () => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.evaluate(() => { localStorage.setItem("parentApp:role", '"admin"'); });
  await page.reload(); await page.waitForTimeout(400);
  await page.getByLabel(EN.menu).click(); await page.waitForTimeout(200);
  await page.locator("div[style*='position: fixed']").getByText(EN.navPayments, { exact: true }).click(); await page.waitForTimeout(300);
  await expectText(EN.paymentsOverview);
  if (await page.getByLabel(EN.closeLabel).count() !== 0) throw new Error("drawer stayed open after navigating");
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
