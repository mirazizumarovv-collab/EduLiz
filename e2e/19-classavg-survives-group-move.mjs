import { launch, step, report, visibleText, EN, BASE, readGradesRecords } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

// ---------- #3: class average survives a group move correctly ----------
await step("#3 setup: Umar graded 'Quiz 1' in Mathematics 4A (40/100) alongside a real peer (20/100)", async () => {
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByText("Malika Yusupova").click();
  const students = await ls("students");
  students.push({ id: "mover-peer", name: "Mover Peer", grade: "Grade 4", groupId: "g-math-4a", guardians: [{ id: "g-mp", name: "Mover Peer Parent", phone: "+998 90 444 00 11", role: "Guardian" }], connectionCode: null });
  await setLs("students", students);
  const groups = await ls("groups"); groups.find(g => g.id === "g-math-4a").studentIds.push("mover-peer");
  await setLs("groups", groups);
  await page.reload(); await page.waitForTimeout(400);
  await page.getByText(EN.navGrades, { exact: true }).first().click();
  await page.locator("select").first().selectOption({ label: "Mathematics 4A" });
  await page.getByPlaceholder("e.g. Test 3").fill("Quiz 1");
  const nums = page.locator("input[type=number]");
  await nums.nth(0).fill("100"); await nums.nth(1).fill("40"); await nums.nth(2).fill("20");
  await page.getByRole("button", { name: "Save grades" }).click(); await page.waitForTimeout(300);
  const gr = await readGradesRecords(page);
  if (gr.umar?.[0]?.groupId !== "g-math-4a") throw new Error("grade not tagged with groupId: " + JSON.stringify(gr.umar));
}, errors);

await step("#3 fix: Admin moves Umar to Mathematics 7A — his OLD Quiz 1 class average still reflects his ORIGINAL Group B peer (20%), not his new groupmates (who have no such assessment)", async () => {
  await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
  await page.getByRole("button", { name: /Administrator/ }).click();
  await page.getByText(EN.navStudents, { exact: true }).first().click();
  const row = page.locator("div", { hasText: "Umar" }).filter({ has: page.getByLabel(EN.edit) }).last();
  await row.getByLabel(EN.edit).click();
  const selects = page.locator("select");
  await selects.last().selectOption({ label: "Mathematics 7A" });
  await page.getByRole("button", { name: EN.save }).click();
  await page.waitForTimeout(300);
  const updated = (await ls("students")).find(s => s.id === "umar");
  if (updated.groupId !== "g-math-7a") throw new Error("move did not apply: " + updated.groupId);

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
  const idx = txt.indexOf("Quiz 1");
  if (idx === -1) throw new Error("Quiz 1 missing after move: " + txt.slice(0, 300));
  const win = txt.slice(idx, idx + 200);
  // Umar 40%, his REAL original peer 20% -> +100% (unchanged by the move).
  // If the bug were present, his NEW group (Aisha, 90% on an unrelated
  // assessment) would never match (different title/date), so this would
  // incorrectly show "No comparison data" instead of the real +100%.
  if (!/Above group average/.test(win) || !/by 100%/.test(win)) throw new Error("class average broken after group move: " + win);
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
