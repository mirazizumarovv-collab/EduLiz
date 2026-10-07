import { launch, step, report, visibleText, EN, BASE, readGradesRecords } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
await page.goto(BASE);

await step("setup: sign in as Teacher (Malika)", async () => {
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByText("Malika Yusupova").click();
  await page.getByText(EN.navGrades, { exact: true }).first().click();
}, errors);

await step("Umar is ALONE in his group — entering a grade must NOT show a class average vs himself", async () => {
  await page.locator("select").first().selectOption({ label: "Mathematics 4A" });
  await page.getByPlaceholder("e.g. Test 3").fill("Solo Quiz");
  const nums = page.locator("input[type=number]");
  await nums.nth(0).fill("20"); // max
  await nums.nth(1).fill("18"); // Umar's only score
  await page.getByRole("button", { name: "Save grades" }).click();
  await page.waitForTimeout(300);
  const gr = await readGradesRecords(page);
  if (gr.umar?.[0]?.score !== 18) throw new Error("grade not saved: " + JSON.stringify(gr.umar));
}, errors);

await step("Parent view (Umar): shows 'No comparison data', not a false 100%-of-self average", async () => {
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
  await page.getByText(EN.navGrades, { exact: true }).last().click(); await page.waitForTimeout(400);
  const txt = await visibleText(page);
  if (!/Solo Quiz/.test(txt)) throw new Error("grade missing: " + txt.slice(0, 300));
  if (!new RegExp(EN.noComparisonData).test(txt)) throw new Error("expected 'no comparison data', got: " + txt.slice(0, 400));
  if (/At group average|Above group average|Below group average/.test(txt)) throw new Error("showed a false comparison for a lone student: " + txt.slice(0, 400));
}, errors);

let teacherPage;
await step("Give Aisha's group a second real student and grade them on the SAME assessment title", async () => {
  const teacherCtx = page.context();
  teacherPage = await teacherCtx.newPage(); teacherPage.setDefaultTimeout(4000);
  await teacherPage.goto(BASE);
  await teacherPage.evaluate(() => {
    const students = JSON.parse(localStorage.getItem("parentApp:students"));
    students.push({ id: "class-peer", name: "Peer Kid", grade: "Grade 7", groupId: "g-math-7a", guardians: [{ id: "g-peer", name: "Peer Parent", phone: "+998 90 000 22 33", role: "Guardian" }], connectionCode: null });
    localStorage.setItem("parentApp:students", JSON.stringify(students));
    const groups = JSON.parse(localStorage.getItem("parentApp:groups"));
    groups.find(g => g.id === "g-math-7a").studentIds.push("class-peer");
    localStorage.setItem("parentApp:groups", JSON.stringify(groups));
    localStorage.setItem("parentApp:role", '"teacher"'); localStorage.setItem("parentApp:currentTeacherId", '"t-malika"');
  });
  await teacherPage.reload(); await teacherPage.waitForTimeout(400);
  await teacherPage.getByText(EN.navGrades, { exact: true }).first().click();
  await teacherPage.locator("select").first().selectOption({ label: "Mathematics 7A" });
  // A different, OLDER assessment for Aisha alone first, to prove the class
  // average isn't blended across every past assessment.
  await teacherPage.getByPlaceholder("e.g. Test 3").fill("Old Solo Test");
  const oldNums = teacherPage.locator("input[type=number]");
  await oldNums.nth(0).fill("10"); await oldNums.nth(1).fill("2"); // Aisha only — deliberately terrible, must NOT affect the new comparison
  await teacherPage.getByRole("button", { name: "Save grades" }).click(); await teacherPage.waitForTimeout(300);
  // The real comparison test: both students, same title, same max score.
  await teacherPage.getByPlaceholder("e.g. Test 3").fill("Shared Quiz");
  const nums = teacherPage.locator("input[type=number]");
  await nums.nth(0).fill("20");
  await nums.nth(1).fill("16"); // Aisha
  await nums.nth(2).fill("12"); // Peer Kid
  await teacherPage.getByRole("button", { name: "Save grades" }).click(); await teacherPage.waitForTimeout(300);
}, errors);

await step("Parent view (Aisha): class average is the PEER's score only (60%), not blended with the old solo test, not including Aisha herself", async () => {
  await page.getByText("▾").first().click(); await page.getByText("Aisha").first().click(); await page.waitForTimeout(300);
  await page.getByText(EN.navGrades, { exact: true }).last().click(); await page.waitForTimeout(500);
  const txt = await visibleText(page);
  if (!/Shared Quiz/.test(txt)) throw new Error("Shared Quiz missing: " + txt.slice(0, 400));
  // Aisha scored 16/20 = 80%; peer scored 12/20 = 60%. Class average shown
  // for THIS row must be exactly the peer's 60%, not 80% (self), not a
  // blend with the unrelated 20% "Old Solo Test".
  const idx = txt.indexOf("Shared Quiz");
  const win = txt.slice(idx, idx + 250);
  // The UI shows the DERIVED comparison (score vs class average), not the raw
  // average number. Aisha scored 16/20 = 80%; the real class average is the
  // peer's 12/20 = 60% (NOT 80% if it wrongly included Aisha, NOT the old
  // unrelated 20% solo test). (80-60)/60 = 33% is the exact, correct figure
  // that can ONLY come from a peer-only, same-assessment average of 60%.
  if (!/Above group average.*by 33%/.test(win)) throw new Error("expected '+33%' (peer-only 60% average): " + win);
  if (!/at group average|noComparisonData/i.test(win) === false) {} // (kept for clarity; real check is the 33% above)
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
