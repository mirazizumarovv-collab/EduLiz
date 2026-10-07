import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

// ---------- #3: late-but-completed homework status ----------
await step("#3 setup: inject a homework item due 2026-09-05 with a submission recorded on 2026-09-08 (late) — Teacher's own UI correctly refuses to ASSIGN a past-due date, so this real-world-only state is seeded directly, same as a backend would eventually store it", async () => {
  await page.getByRole("button", { name: /Administrator/ }).click();
  const hw = await ls("homeworkRecords");
  hw["g-math-4a"] = hw["g-math-4a"] || [];
  hw["g-math-4a"].push({ id: "hw-late-test", title: "Late Submission HW", dueDate: "2026-09-05", createdDate: "2026-09-01" });
  await setLs("homeworkRecords", hw);
  const sub = await ls("homeworkSubmissions");
  sub["hw-late-test"] = { umar: { submittedAt: "2026-09-08" } }; // submitted AFTER the 09-05 due date = late
  await setLs("homeworkSubmissions", sub);
  await page.evaluate(() => { localStorage.setItem("parentApp:role", "null"); });
  await page.reload(); await page.waitForTimeout(300);
}, errors);

await step("#3 fix: Parent sees 'Submitted late', NOT a plain 'Completed', for the late submission", async () => {
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
  let txt = await visibleText(page);
  const idx = txt.indexOf("Late Submission HW");
  if (idx === -1) throw new Error("homework item missing: " + txt.slice(0, 300));
  const cardWindow = txt.slice(idx, idx + 150);
  if (!new RegExp(EN.completedLate).test(cardWindow)) throw new Error("card does not show 'Submitted late': " + cardWindow);
  if (/^Completed$/m.test(cardWindow)) throw new Error("card wrongly shows plain 'Completed'");
  await page.getByText("Late Submission HW").first().click(); await page.waitForTimeout(250);
  txt = await visibleText(page);
  if (!new RegExp(EN.completedLate).test(txt)) throw new Error("detail sheet does not show 'Submitted late': " + txt.slice(0, 400));
}, errors);

// ---------- #5: class-average must not leak across two DIFFERENT groups with the same subject+title+date ----------
await step("#5 setup: TWO different groups each grade 'Mathematics Quiz 1' on the SAME date with DIFFERENT scores", async () => {
  await page.getByLabel(EN.back).first().click().catch(() => {});
  await page.getByText(EN.navMore, { exact: true }).last().click(); await page.getByText(EN.navSettings, { exact: true }).first().click();
  await page.getByRole("button", { name: EN.logout }).last().click(); await page.waitForTimeout(200);
  const confirmBtn = page.getByRole("button", { name: EN.logout }); if (await confirmBtn.count() > 0) await confirmBtn.last().click();
  await page.waitForTimeout(300);
  // Give Umar's group (Mathematics 4A) a real peer so BOTH groups have 2 students each.
  const students = await ls("students");
  students.push({ id: "group-b-peer", name: "Group B Peer", grade: "Grade 4", groupId: "g-math-4a", guardians: [{ id: "g-gbp", name: "Group B Parent", phone: "+998 90 333 22 11", role: "Guardian" }], connectionCode: null });
  await setLs("students", students);
  const groups = await ls("groups"); groups.find(g => g.id === "g-math-4a").studentIds.push("group-b-peer");
  await setLs("groups", groups);
  await page.evaluate(() => { localStorage.setItem("parentApp:role", '"teacher"'); localStorage.setItem("parentApp:currentTeacherId", '"t-malika"'); });
  await page.reload(); await page.waitForTimeout(400);
  // Group A: Mathematics 7A — Aisha scores 90 on "Quiz 1" dated 2026-09-08
  await page.getByText(EN.navGrades, { exact: true }).first().click();
  await page.locator("select").first().selectOption({ label: "Mathematics 7A" });
  await page.getByPlaceholder("e.g. Test 3").fill("Quiz 1");
  let nums = page.locator("input[type=number]");
  await nums.nth(0).fill("100"); await nums.nth(1).fill("90");
  await page.getByRole("button", { name: "Save grades" }).click(); await page.waitForTimeout(300);
  // Group B: Mathematics 4A — Umar scores 40, Group B Peer scores 20, SAME title "Quiz 1", SAME date (today)
  await page.locator("select").first().selectOption({ label: "Mathematics 4A" });
  await page.getByPlaceholder("e.g. Test 3").fill("Quiz 1");
  nums = page.locator("input[type=number]");
  await nums.nth(0).fill("100"); await nums.nth(1).fill("40"); await nums.nth(2).fill("20");
  await page.getByRole("button", { name: "Save grades" }).click(); await page.waitForTimeout(300);
}, errors);

await step("#5 fix: Umar's class average reflects ONLY his real Group B peer (20%), never Aisha's unrelated Group A score (90%)", async () => {
  await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
  // logout() correctly clears registration too, so Dilnoza must register again.
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code2 = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code2); await page.getByRole("button", { name: EN.verifyCode }).click();
  await page.waitForTimeout(400);
  await page.getByText("▾").first().click(); await page.waitForTimeout(200);
  await page.getByText("Umar").first().click(); await page.waitForTimeout(300);
  await page.getByText(EN.navGrades, { exact: true }).last().click(); await page.waitForTimeout(400);
  const txt = await visibleText(page);
  const idx = txt.indexOf("Quiz 1");
  if (idx === -1) throw new Error("Quiz 1 missing for Umar: " + txt.slice(0, 300));
  const win = txt.slice(idx, idx + 200);
  // Umar scored 40%, his real Group B peer scored 20% -> diff = 20, pctDiff = (20/20)*100 = 100%
  if (!/Above group average/.test(win)) throw new Error("expected Above group average: " + win);
  if (!/by 100%/.test(win)) throw new Error("expected +100% vs the REAL 20% Group B peer, got: " + win);
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
