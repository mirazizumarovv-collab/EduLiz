import { launch, step, report, visibleText, EN, BASE, STATE, dictionaries } from "./lib.mjs";
const { browser, ctx, page, errors } = await launch({ width: 460, height: 950 }, STATE);
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const goto = async (label) => {
  const nav = page.getByText(label, { exact: true });
  if (await nav.count() && await nav.last().isVisible().catch(() => false)) { await nav.last().click(); }
  else { await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200); await page.getByText(label, { exact: true }).first().click(); }
  await page.waitForTimeout(500);
};
await page.goto(BASE); await page.waitForTimeout(500);

await step("Parent: Settings — children rows show the group NAME (no 'undefined')", async () => {
  await goto(EN.navSettings);
  const txt = await visibleText(page);
  if (/undefined/.test(txt)) throw new Error("undefined shown: " + txt.slice(0, 300));
  if (!/Mathematics 7A/.test(txt)) throw new Error("group name missing");
}, errors);

await step("Parent: Settings — real guardians, '(You)' marks me even though phone formatting differs from the seed", async () => {
  const txt = await visibleText(page);
  if (!/Dilnoza \(You\)/.test(txt)) throw new Error("no (You): " + txt.slice(txt.indexOf("Guardian")).slice(0, 300));
  if (await page.getByRole("button", { name: EN.removeAccess }).count() !== 0) throw new Error("can remove own access");
}, errors);

await step("Parent: invite guardian — same digits in another format rejected; new one accepted; role kept; removal", async () => {
  await page.getByText(EN.addGuardian, { exact: false }).first().click();
  await page.getByPlaceholder("Sardor Aliyev").fill("Copy Of Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").last().fill("998901234567");
  await page.getByRole("button", { name: EN.invite, exact: true }).click();
  await expectText(EN.guardianAlreadyAdded);
  const shown = await page.getByPlaceholder("+998 90 123 45 67").last().inputValue();
  if (shown !== "+998 90 123 45 67") throw new Error("phone not formatted: " + shown);
  await page.getByPlaceholder("+998 90 123 45 67").last().fill("990007711");
  await page.getByPlaceholder("Sardor Aliyev").fill("Sardor Father");
  await page.getByRole("button", { name: EN.roleFather }).last().click();
  await page.getByRole("button", { name: EN.invite, exact: true }).click();
  await page.waitForTimeout(250);
  let g = (await ls("students")).find(s => s.id === "aisha").guardians;
  if (g.length !== 2 || g[1].role !== "Father" || g[1].phone !== "+998 99 000 77 11") throw new Error(JSON.stringify(g));
  await page.getByRole("button", { name: EN.removeAccess }).first().click();
  await page.getByRole("button", { name: EN.removeAccess }).last().click().catch(() => {});
  await page.waitForTimeout(250);
  g = (await ls("students")).find(s => s.id === "aisha").guardians;
  if (g.length !== 1) throw new Error("not removed: " + JSON.stringify(g));
}, errors);

await step("Parent: header back arrow on a drill-down screen returns Home", async () => {
  await page.getByLabel(EN.back).first().click(); await page.waitForTimeout(300);
  if (!(await has("▾"))) throw new Error("not home: " + (await visibleText(page)).slice(0, 150));
}, errors);

await step("Parent: child with NO data (Umar) — every screen shows an empty state, nothing crashes", async () => {
  await page.getByText("▾").first().click(); await page.waitForTimeout(150);
  await page.getByText("Umar").first().click(); await page.waitForTimeout(500);
  if (!(await has("Umar"))) throw new Error("switch failed");
  for (const l of [EN.navGrades, EN.navAttendance, EN.navHomework, EN.navPayments, EN.navInsights]) await goto(l);
  if (!(await has(EN.insightsNeedGrades))) throw new Error("insights empty state missing");
  await page.getByLabel(EN.back).first().click().catch(() => {});
}, errors);

await step("Parent: PDF report opens without crashing for a child with grades", async () => {
  await page.getByText("▾").first().click(); await page.getByText("Aisha").first().click(); await page.waitForTimeout(400);
  await goto(EN.navInsights);
  await page.getByText(EN.downloadPdf, { exact: false }).first().click(); await page.waitForTimeout(500);
  const txt = await visibleText(page);
  if (/undefined|NaN/.test(txt)) throw new Error("bad values in report: " + txt.match(/.{40}(undefined|NaN).{40}/)?.[0]);
  await page.getByRole("button", { name: "Close" }).click();
}, errors);

await step("Parent: 'Connect another child' — wrong code rejected; correct code links child keeping registration ROLE", async () => {
  await page.getByLabel(EN.back).first().click().catch(() => {});
  await page.getByText("▾").first().click(); await page.getByText(EN.connectAnotherChild).click();
  await page.getByPlaceholder("REG-4821").fill("REG-0000"); await page.getByRole("button", { name: EN.connect }).click();
  await expectText("couldn't find a student");
  await page.getByPlaceholder("REG-4821").fill("REG-4821"); await page.getByRole("button", { name: EN.connect }).click();
  await page.waitForTimeout(900);
  const m = (await ls("students")).find(s => s.id === "aisha-friend-1").guardians;
  const me = m.find(g => g.phone.replace(/\D/g, "") === "998901234567");
  if (!me || me.role !== "Mother" || me.name !== "Dilnoza") throw new Error(JSON.stringify(m));
  if (!(await has("Malika"))) throw new Error("Malika not selected");
}, errors);

await step("Parent: PIN lock — enable, reload locks, wrong PIN rejected, forgot-PIN flow resets it", async () => {
  await goto(EN.navSettings);
  await page.getByText(EN.pinSecurity, { exact: false }).first().click(); await page.waitForTimeout(200);
  const nums = page.locator("input[type=password], input[inputmode=numeric]");
  await nums.nth(0).fill("1234"); await nums.nth(1).fill("1234");
  await page.getByRole("button", { name: EN.savePin || EN.setPin }).last().click().catch(async () => { await page.getByRole("button", { name: /save|set/i }).last().click(); });
  await page.waitForTimeout(300);
  if (!(await ls("appLockEnabled"))) throw new Error("not enabled: " + (await visibleText(page)).slice(0, 200));
  await page.reload(); await expectText(EN.enterYourPin);
  await page.locator("input").first().fill("9999"); await page.getByRole("button", { name: EN.unlock }).click(); await expectText(EN.wrongPin);
  await page.getByText(EN.forgotPin).click(); await page.getByRole("button", { name: EN.sendCode }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code); await page.getByRole("button", { name: EN.verifyCode }).click();
  const np = page.locator("input[type=password]"); const npn = await np.count(); await np.nth(npn - 2).fill("4321"); await np.nth(npn - 1).fill("4321");
  await page.getByRole("button", { name: EN.saveNewPin }).click(); await page.waitForTimeout(300);
  if ((await ls("pin")) !== "4321") throw new Error("PIN not reset, pin=" + (await ls("pin")));
  if (await has(EN.enterYourPin)) throw new Error("still locked");
}, errors);

for (const lang of ["uz", "ru"]) {
  await step(`Parent: ${lang.toUpperCase()} — no raw translation key visible on any parent screen`, async () => {
    const D = dictionaries[lang]; const keys = new Set(Object.keys(dictionaries.en));
    await page.evaluate((l) => localStorage.setItem("parentApp:lang", JSON.stringify(l)), lang);
    await page.reload(); await page.waitForTimeout(400);
    if (await has(D.enterYourPin)) { await page.locator("input").first().fill("4321"); await page.getByRole("button", { name: D.unlock }).click(); await page.waitForTimeout(300); }
    const seen = [];
    const scan = async (tag) => { const words = (await page.evaluate(() => document.body.innerText)).split(/[\s|·—:,()%/.…]+/).filter(w => /^[a-z]+[A-Z][A-Za-z0-9_]+$/.test(w) || /^[a-z]+_[a-z]+$/.test(w)); words.forEach(w => keys.has(w) && seen.push(`${tag}:${w}`)); };
    await scan("home");
    for (const k of ["navAttendance", "navGrades", "navHomework", "navPayments", "navInsights", "navNotifications", "navChat", "navSettings"]) {
      await goto(D[k]).catch(() => {}); await scan(k);
    }
    if (seen.length) throw new Error("raw keys: " + [...new Set(seen)].join(", "));
  }, errors);
}
report();
console.log("\nALL ERRORS:", errors);
await browser.close();
