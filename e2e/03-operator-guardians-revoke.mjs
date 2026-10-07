import { launch, step, report, visibleText, EN, BASE, STATE, dictionaries } from "./lib.mjs";
const { browser, ctx, page, errors } = await launch({ width: 1100, height: 950 }, STATE);
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
const logoutStaff = async () => { await page.getByRole("button", { name: EN.logout }).first().click(); await page.waitForTimeout(200); };
const parentLogout = async () => { // via Settings on the parent side
  await page.getByText(EN.navMore, { exact: true }).last().click(); await page.getByText(EN.navSettings, { exact: true }).first().click(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: EN.logout }).last().click(); await page.waitForTimeout(300);
  const confirm = page.getByRole("button", { name: EN.logout }); if (await confirm.count() > 1) await confirm.last().click();
  await page.waitForTimeout(300);
};
await page.goto(BASE); await page.waitForTimeout(600);

// The parent session from stage 1 (Dilnoza) is open; the parent's chat message is in the shared thread.
await step("Parent logout returns to role picker and clears parent identity (not students)", async () => {
  await parentLogout();
  await expectText(EN.chooseRole);
  if ((await ls("parentPhone")) !== "") throw new Error("phone kept: " + (await ls("parentPhone")));
  if (!(await ls("students")).some(s => s.id === "aisha")) throw new Error("students wiped by logout");
}, errors);

await step("Operator: parent's message from the shared thread is visible and can be answered", async () => {
  await page.getByRole("button", { name: /Operator/ }).click();
  await page.getByText(EN.navMessages, { exact: true }).first().click(); await page.waitForTimeout(300);
  await page.getByText("Aisha").first().click();
  await expectText("Assalomu alaykum, test");
  await page.getByPlaceholder(EN.replyPlaceholder).fill("Vaalaykum assalom!"); await page.getByRole("button", { name: EN.send }).click();
  await expectText("Vaalaykum assalom!");
  if (!(await ls("messageThreads")).aisha.some(m => m.from === "center" && m.text === "Vaalaykum assalom!")) throw new Error("reply not stored");
}, errors);

await step("Operator: dashboard counts + approve request creates a real student with guardians[] and a code", async () => {
  await page.getByText(EN.navHomeStaff, { exact: true }).first().click(); await expectText(EN.pendingRequests);
  await page.getByText(EN.navRequests, { exact: true }).first().click(); await expectText("Javlon");
  await page.locator("select").first().selectOption({ label: "English 5C" });
  await page.getByRole("button", { name: EN.approve }).click(); await page.waitForTimeout(300);
  const st = (await ls("students")).find(s => s.name === "Javlon");
  if (!st || st.groupId !== "g-eng-5c" || !/^REG-\d{4}$/.test(st.connectionCode)) throw new Error(JSON.stringify(st));
  if (st.guardians?.[0]?.name !== "Nodira Karimova" || st.guardians[0].phone !== "+998 90 444 55 66") throw new Error("guardian wrong " + JSON.stringify(st.guardians));
  if (!(await ls("groups")).find(g => g.id === "g-eng-5c").studentIds.includes(st.id)) throw new Error("not in roster");
  await expectText(st.connectionCode);
}, errors);
await logoutStaff();

// ---------- second guardian connects with a code ----------
const regParent = async (name, phone, roleLabel) => {
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  if (await has(EN.registerTitle) === false) throw new Error("registration not shown: " + (await visibleText(page)).slice(0, 150));
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill(name);
  await page.getByPlaceholder("+998 90 123 45 67").fill(phone);
  await page.getByRole("button", { name: roleLabel }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code); await page.getByRole("button", { name: EN.verifyCode }).click(); await page.waitForTimeout(300);
};
await step("Second guardian (new phone) is NOT auto-linked; connect screen has a back arrow to registration", async () => {
  await regParent("Nodir", "55 500 11 22", EN.roleFather);
  await expectText(EN.connectChildTitle);
  await page.getByLabel(EN.back).first().click(); await expectText(EN.registerTitle);
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Nodir");
  await page.getByPlaceholder("+998 90 123 45 67").fill("55 500 11 22");
  await page.getByRole("button", { name: EN.roleFather }).click(); await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code); await page.getByRole("button", { name: EN.verifyCode }).click(); await expectText(EN.connectChildTitle);
}, errors);

await step("Second guardian connects Sardor with REG-1190 -> role Father kept, greeting uses own name, Settings shows both guardians", async () => {
  await page.getByPlaceholder("REG-4821").fill("REG-1190"); await page.getByRole("button", { name: EN.connect }).click(); await page.waitForTimeout(900);
  await expectText("Nodir"); if (!(await has("Sardor"))) throw new Error("Sardor not shown");
  const g = (await ls("students")).find(s => s.id === "aisha-friend-2").guardians;
  const me = g.find(x => x.name === "Nodir"); if (!me || me.role !== "Father" || g.length !== 2) throw new Error(JSON.stringify(g));
  await page.getByText(EN.navMore, { exact: true }).last().click(); await page.getByText(EN.navSettings, { exact: true }).first().click(); await page.waitForTimeout(300);
  const txt = await visibleText(page);
  if (!/Jasur/.test(txt) || !/Nodir \(You\)/.test(txt)) throw new Error("guardian list wrong: " + txt.slice(txt.indexOf("Guardian")).slice(0, 300));
}, errors);

await step("REVOKE: removing the logged-in guardian's access signs them out with a notice (Admin edit path)", async () => {
  const students = await ls("students");
  const s = students.find(x => x.id === "aisha-friend-2"); s.guardians = s.guardians.filter(g => g.name !== "Nodir");
  await setLs("students", students);
  await page.reload(); await page.waitForTimeout(600);
  await expectText(EN.accessRevokedNotice);
  if ((await ls("parentPhone")) !== "" ) throw new Error("session not cleared");
}, errors);

await step("Notice is dismissible and disappears when a role is chosen", async () => {
  await page.getByRole("button", { name: EN.cancel }).click();
  if (await has(EN.accessRevokedNotice)) throw new Error("notice still visible");
}, errors);

await step("Original guardian (Dilnoza) logs back in via OTP and is auto-recognised — sees BOTH children, no code asked", async () => {
  await regParent("Dilnoza", "998901234567", EN.roleMother);
  await page.waitForTimeout(500);
  if (await has(EN.connectChildTitle)) throw new Error("asked for a code");
  await page.getByText("▾").first().click(); await page.waitForTimeout(200);
  const txt = await visibleText(page);
  if (!/Aisha/.test(txt) || !/Umar/.test(txt)) throw new Error("children wrong: " + txt.slice(-300));
  if (/Sardor|Malika/.test(txt.slice(txt.indexOf("Switch child")))) throw new Error("sees a child she is not a guardian of");
}, errors);
await page.evaluate(() => {}); 
report(); console.log("\nALL ERRORS:", errors);
await browser.close();
