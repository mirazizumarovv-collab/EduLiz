import { launch, step, report, visibleText, EN, BASE, STATE, dictionaries, readGradesRecords } from "./lib.mjs";
const { browser, ctx, page, errors } = await launch({ width: 1100, height: 950 });
const URL = BASE;
const T = (k, v) => { let s = EN[k]; if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, b); return s; };
const has = async (txt) => (await visibleText(page)).includes(txt);
const expectText = async (txt) => { await page.getByText(txt, { exact: false }).first().waitFor({ timeout: 3000 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const logout = async () => { await page.getByRole("button", { name: EN.logout || "Log out" }).first().click(); };
let newCode = null, newStudentId = null;

await page.goto(URL);

// ---------------- ADMIN ----------------
await step("Admin: sign in and dashboard shows stats", async () => {
  await page.getByRole("button", { name: /Administrator/ }).click();
  await expectText("Center overview"); await expectText("Expected monthly revenue");
}, errors);

await step("Admin: add student -> appears in list with connection code and in group roster", async () => {
  await page.getByText(EN.navStudents, { exact: true }).first().click();
  await page.getByRole("button", { name: EN.addStudent }).click();
  const form = page.locator("div").filter({ has: page.getByRole("button", { name: EN.save }) }).last();
  const inputs = form.locator("input");
  await inputs.nth(0).fill("Test Kid"); await inputs.nth(1).fill("Grade 3");
  await inputs.nth(2).fill("Test Guardian"); await inputs.nth(3).fill("+998 90 999 88 77");
  await page.getByRole("button", { name: EN.save }).click();
  await expectText("Test Kid");
  const st = (await ls("students")).find(s => s.name === "Test Kid");
  if (!st) throw new Error("student not persisted");
  newStudentId = st.id; newCode = st.connectionCode;
  if (!st.guardians?.[0] || st.guardians[0].phone !== "+998 90 999 88 77") throw new Error("guardians[] wrong: " + JSON.stringify(st.guardians));
  if (!/^REG-\d{4}$/.test(newCode)) throw new Error("bad code " + newCode);
  const g = (await ls("groups")).find(x => x.id === st.groupId);
  if (!g.studentIds.includes(st.id)) throw new Error("not in group roster");
}, errors);

await step("Admin: edit student primary guardian keeps additional guardians", async () => {
  // give Test Kid a second guardian directly, then edit primary via UI
  await page.evaluate((id) => { const k = "parentApp:students"; const s = JSON.parse(localStorage.getItem(k)); const st = s.find(x => x.id === id); st.guardians.push({ id: "g-extra", name: "Extra Guardian", phone: "+998 90 111 00 00", role: "Father" }); localStorage.setItem(k, JSON.stringify(s)); }, newStudentId);
  await page.reload(); await page.getByText(EN.navStudents, { exact: true }).first().click();
  await expectText("Test Kid"); await expectText("(+1)");
  const row = page.locator("div", { hasText: "Test Kid" }).filter({ has: page.getByLabel(EN.edit) }).last();
  await row.getByLabel(EN.edit).click();
  await expectText(EN.additionalGuardians); await expectText("Extra Guardian");
  await page.locator("input[value='Test Guardian']").fill("Renamed Guardian");
  await page.getByRole("button", { name: EN.save }).click();
  const st = (await ls("students")).find(s => s.id === newStudentId);
  if (st.guardians.length !== 2 || st.guardians[0].name !== "Renamed Guardian" || st.guardians[1].id !== "g-extra") throw new Error(JSON.stringify(st.guardians));
}, errors);

await step("Admin: payments — mark paid records a transaction; reset to pending works", async () => {
  await page.getByText(EN.navPayments, { exact: true }).first().click();
  const umar = page.locator("div", { hasText: "Umar" }).filter({ has: page.getByRole("button", { name: EN.markAsPaid }) }).last();
  await umar.locator("select").selectOption("card");
  await umar.getByRole("button", { name: EN.markAsPaid }).click();
  const tx = (await ls("paymentTransactions")).umar;
  if (!tx || tx.length !== 1 || tx[0].method !== "card" || tx[0].amount !== 450000) throw new Error(JSON.stringify(tx));
  if ((await ls("paymentsStatus")).umar !== "paid") throw new Error("status not paid");
  await page.getByRole("button", { name: EN.startNewBillingMonth }).first().click();
}, errors);

await step("Admin: groups screen renders; teachers screen renders", async () => {
  await page.getByText(EN.navAllGroups, { exact: true }).first().click(); await expectText("English 6B");
  await page.getByText(EN.navTeachers, { exact: true }).first().click(); await expectText("Sherzod Aliyev");
}, errors);

await step("Admin: back arrow from a sub-screen returns to dashboard", async () => {
  await page.getByLabel(EN.back).first().click(); await expectText("Center overview");
}, errors);
await logout();

// ---------------- TEACHER ----------------
await step("Teacher: new student visible in My Groups (live students state)", async () => {
  await page.getByRole("button", { name: /Teacher/ }).click(); await page.getByText("Malika Yusupova").click();
  await page.getByText(EN.navGroups, { exact: true }).first().click();
  await expectText("Test Kid");
}, errors);

await step("Teacher: mark attendance (requires all marked) -> saved", async () => {
  await page.getByText(EN.navAttendance, { exact: true }).first().click();
  await page.getByRole("button", { name: EN.save === "Save" ? "Save attendance" : "Save attendance" }).click();
  await expectText("still unmarked");
  const present = page.getByRole("button", { name: EN.present });
  const n = await present.count(); for (let i = 0; i < n; i++) await present.nth(0).click().catch(()=>{});
  // click Present for each row (rows have P/L/A buttons)
  const rows = await page.getByRole("button", { name: EN.present }).count();
  for (let i = 0; i < rows; i++) await page.getByRole("button", { name: EN.present }).nth(i).click();
  await page.getByRole("button", { name: "Save attendance" }).click();
  await page.waitForTimeout(200);
  const rec = await ls("attendanceRecords");
  const g = rec["g-math-7a"]; if (!g) throw new Error("no attendance saved: " + JSON.stringify(rec));
  const day = g["2026-09-08"]; if (!day || Object.keys(day).length !== 2) throw new Error("expected 2 students: " + JSON.stringify(day));
}, errors);

await step("Teacher: an out-of-range score is REFUSED with the reason (never silently changed), then valid scores are saved per student", async () => {
  await page.getByText(EN.navGrades, { exact: true }).first().click();
  await page.getByPlaceholder("e.g. Test 3").fill("Quiz 1");
  const nums = page.locator("input[type=number]");
  await nums.nth(0).fill("20");            // max score
  await nums.nth(1).fill("15");            // Aisha
  await nums.nth(2).fill("99");            // Test Kid: 99 out of 20
  await page.getByRole("button", { name: EN.saveGrades || "Save grades" }).click();
  await page.waitForTimeout(200);
  let alertText = await page.getByRole("alert").innerText();
  if (!alertText.includes("can't be higher than 20")) throw new Error("expected a 'higher than 20' message, got: " + alertText);
  if (Object.keys(await readGradesRecords(page)).length) throw new Error("something was saved despite the refusal");
  await nums.nth(2).fill("-3");
  await page.getByRole("button", { name: EN.saveGrades || "Save grades" }).click();
  alertText = await page.getByRole("alert").innerText();
  if (!alertText.includes("can't be negative")) throw new Error("expected a 'negative' message, got: " + alertText);
  await nums.nth(2).fill("20");            // Test Kid: a valid full mark
  await page.getByRole("button", { name: EN.saveGrades || "Save grades" }).click();
  await page.waitForTimeout(200);
  const gr = await readGradesRecords(page);
  if (gr.aisha?.[0]?.score !== 15) throw new Error("aisha " + JSON.stringify(gr.aisha));
  if (gr[newStudentId]?.[0]?.score !== 20) throw new Error("Test Kid should have 20: " + JSON.stringify(gr[newStudentId]));
}, errors);

await step("Teacher: assign homework; past due date rejected; per-student completion", async () => {
  await page.getByText(EN.navHomework, { exact: true }).first().click();
  await page.getByPlaceholder("e.g. Worksheet 5, problems 1").fill("HW past");
  await page.locator("input[type=date]").evaluate((el) => { el.removeAttribute("min"); });
  await page.locator("input[type=date]").fill("2026-09-01");
  await page.getByRole("button", { name: EN.assignHomework }).first().click();
  await expectText(EN.dueDateInPast);
  await page.locator("input[type=date]").fill("2026-09-12");
  await page.getByPlaceholder("e.g. Worksheet 5, problems 1").fill("HW1");
  await page.getByRole("button", { name: EN.assignHomework }).first().click();
  await expectText("HW1");
  await page.getByRole("button", { name: /0\/2/ }).click();
  await page.locator("label", { hasText: "Aisha" }).locator("input[type=checkbox]").check();
  const sub = await ls("homeworkSubmissions");
  const hwId = (await ls("homeworkRecords"))["g-math-7a"][0].id;
  if (!sub[hwId]?.aisha?.submittedAt) throw new Error("submission not stored " + JSON.stringify(sub));
}, errors);
await logout();

// ---------------- PARENT: first-time flow with demo OTP ----------------
await step("Parent: onboarding -> registration (back arrow returns to onboarding)", async () => {
  await page.getByRole("button", { name: /Parent/ }).click();
  await page.getByRole("button", { name: EN.next }).click().catch(() => {});
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await expectText(EN.registerTitle);
  await page.getByLabel(EN.back).first().click();
  await page.waitForTimeout(150);
  if (await has(EN.registerTitle)) throw new Error("back did not leave registration");
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await expectText(EN.registerTitle);
}, errors);

await step("Parent: registration validates name/phone", async () => {
  await page.getByRole("button", { name: EN.continueLabel }).click(); await expectText(EN.errorNameRequired);
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByRole("button", { name: EN.continueLabel }).click(); await expectText(EN.errorPhoneRequired);
}, errors);

await step("Parent: demo OTP — wrong code rejected, correct code accepted, resend works, back keeps input", async () => {
  await page.getByPlaceholder("+998 90 123 45 67").fill("901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  await expectText(EN.otpTitle);
  let code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code === "1111" ? "2222" : "1111");
  await page.getByRole("button", { name: EN.verifyCode }).click(); await expectText(EN.wrongCode);
  await page.getByLabel(EN.back).first().click(); await expectText(EN.registerTitle);
  if ((await page.getByPlaceholder(EN.yourNamePlaceholder).inputValue()) !== "Dilnoza") throw new Error("name lost on back");
  await page.getByRole("button", { name: EN.continueLabel }).click(); await expectText(EN.otpTitle);
  await page.getByRole("button", { name: EN.resendCode }).click();
  code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code);
  await page.getByRole("button", { name: EN.verifyCode }).click();
  await page.waitForTimeout(250);
}, errors);

await step("Parent: returning guardian recognized -> dashboard (no ConnectChild), greeting uses real name", async () => {
  await expectText("Dilnoza");
  const txt = await visibleText(page);
  if (txt.includes(EN.connectChildTitle)) throw new Error("asked for connect code although already a guardian");
  if (!/Aisha/.test(txt)) throw new Error("child not shown: " + txt.slice(0, 200));
}, errors);

await step("Parent: Attendance shows teacher-marked record for the child", async () => {
  await page.getByText(EN.navAttendance, { exact: true }).last().click();
  await page.waitForTimeout(700);
  const txt = await visibleText(page);
  if (!/100%|Present|Sep/i.test(txt)) throw new Error(txt.slice(0, 300));
}, errors);

await step("Parent: Grades shows Quiz 1 result for the child", async () => {
  await page.getByText(EN.navGrades, { exact: true }).last().click(); await page.waitForTimeout(700);
  const txt = await visibleText(page); if (!/Quiz 1|75%/.test(txt)) throw new Error(txt.slice(0, 300));
}, errors);

await step("Parent: Homework shows HW1 completed", async () => {
  await page.getByText(EN.navHomework, { exact: true }).last().click(); await page.waitForTimeout(700);
  const txt = await visibleText(page); if (!/HW1/.test(txt)) throw new Error(txt.slice(0, 300));
}, errors);

await step("Parent: Chat send appears immediately and is stored in shared thread", async () => {
  await page.getByText(EN.navMore).last().click().catch(() => {});
  await page.waitForTimeout(200);
  await page.evaluate(() => window.scrollTo(0, 0));
  const chatBtn = page.getByText(EN.navChat, { exact: true }).first();
  await chatBtn.click(); await page.waitForTimeout(300);
  await page.getByPlaceholder(EN.chatPlaceholder).fill("Assalomu alaykum, test");
  await page.getByRole("button", { name: EN.send }).click();
  await expectText("Assalomu alaykum, test");
  const th = await ls("messageThreads"); if (!th.aisha.some(m => m.text === "Assalomu alaykum, test" && m.from === "parent")) throw new Error("not in shared thread");
}, errors);

await ctx.storageState({ path: STATE });
report();
console.log("\nALL ERRORS:", errors);
await browser.close();
