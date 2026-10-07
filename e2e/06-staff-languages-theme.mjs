import { launch, step, report, visibleText, EN, BASE, STATE, dictionaries } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 }, STATE);
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const keys = new Set(Object.keys(dictionaries.en));
const rawKeys = async () => (await page.evaluate(() => document.body.innerText)).split(/[\s|·—:,()%/.…]+/).filter(w => keys.has(w) && (/^[a-z]+[A-Z]/.test(w) || /_/.test(w)));
const bad = (txt) => txt.match(/.{0,40}(NaN|undefined|Infinity|\[object).{0,30}/)?.[0];
await page.goto(BASE); await page.waitForTimeout(400);
const roles = [
  ["admin", ["navHomeStaff", "navStudents", "navAllGroups", "navTeachers", "navPayments"]],
  ["operator", ["navHomeStaff", "navMessages", "navRequests"]],
  ["teacher", ["navHomeStaff", "navGroups", "navAttendance", "navGrades", "navHomework"]],
];
for (const lang of ["uz", "ru", "en"]) {
  for (const [role, navKeys] of roles) {
    await step(`Staff ${role} in ${lang.toUpperCase()}: every screen renders with no raw keys / NaN / undefined`, async () => {
      await page.evaluate(([r, l]) => { localStorage.setItem("parentApp:role", JSON.stringify(r)); localStorage.setItem("parentApp:lang", JSON.stringify(l)); localStorage.setItem("parentApp:currentTeacherId", '"t-malika"'); }, [role, lang]);
      await page.reload(); await page.waitForTimeout(350);
      const D = dictionaries[lang]; const problems = [];
      for (const k of navKeys) {
        await page.getByText(D[k], { exact: true }).first().click({ timeout: 3000 }); await page.waitForTimeout(220);
        const txt = await visibleText(page);
        (await rawKeys()).forEach(w => problems.push(`${k}:${w}`)); const b = bad(txt); if (b) problems.push(`${k}: ${b}`);
      }
      if (problems.length) throw new Error(problems.join("; "));
    }, errors);
  }
}
await step("Dark theme: staff and parent render without errors", async () => {
  await page.evaluate(() => { localStorage.setItem("parentApp:themeMode", '"dark"'); localStorage.setItem("parentApp:lang", '"en"'); localStorage.setItem("parentApp:role", '"parent"'); });
  await page.reload(); await page.waitForTimeout(500);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  if (bg === "rgb(255, 255, 255)" || bg === "rgba(0, 0, 0, 0)") throw new Error("dark background not applied: " + bg);
  if ((await page.evaluate(() => document.documentElement.getAttribute("data-theme"))) !== "dark") throw new Error("data-theme missing");
}, errors);
report(); console.log("\nALL ERRORS:", errors);
await browser.close();
