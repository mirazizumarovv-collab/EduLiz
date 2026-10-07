// Browser-level companion to 31-parent-i18n-self-contained-unit.mjs. That one
// checks the dictionaries against the source; this one looks at what a user
// actually SEES. For each language it walks the Parent screens and fails if
// any raw translation key (camelCase / snake_case identifier — real UI text
// never looks like that) appears, and it positively asserts that the keys
// that were once missing from the parent-app dictionaries render their real
// translated text on the screens that use them.
import { launch, step, report, visibleText, BASE, dictionaries, seedGrades } from "./lib.mjs";

// A raw key looks like `noGradesYet` or `paymentMethod_cash`. Visible UI text
// never contains camelCase/snake_case words, so any hit is a missing
// translation (lookup fell through and returned the key itself).
const RAW_KEY = /\b[a-z]+(?:[A-Z][a-z0-9]+)+\b|\b[a-z]+_[A-Za-z]+\b/g;

const LANGS = ["uz", "ru", "en"];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const L of LANGS) {
  const D = dictionaries[L];
  const { browser, ctx, page, errors } = await launch({ width: 1100, height: 950 });
  await ctx.addInitScript((l) => localStorage.setItem("parentApp:lang", JSON.stringify(l)), L);
  const ls = (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
  const setLs = (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
  const text = () => visibleText(page);
  const noRawKeys = async (where) => {
    const hits = [...new Set((await text()).match(RAW_KEY) || [])];
    if (hits.length) throw new Error(`[${L}] raw translation key(s) on ${where}: ${hits.join(", ")}`);
  };
  const mustShow = async (str, where) => {
    if (typeof str !== "string") throw new Error(`[${L}] ${where}: the ${L} dictionary has no text defined for this key at all`);
    if (!(await text()).includes(str)) throw new Error(`[${L}] ${where}: expected translated text "${str}" — page shows: ${(await text()).slice(0, 220)}`);
  };
  const openMore = async (label) => {
    await page.getByText(D.navMore, { exact: true }).last().click(); await page.waitForTimeout(200);
    await page.getByText(label, { exact: true }).first().click(); await page.waitForTimeout(450);
  };

  console.log(`\n--- ${L.toUpperCase()} ---`);
  await page.goto(BASE); await page.waitForTimeout(300);

  await step(`[${L}] role picker + onboarding + registration form show no raw keys`, async () => {
    await noRawKeys("role picker");
    await page.getByRole("button", { name: new RegExp(escapeRe(D.roleParent)) }).click(); await page.waitForTimeout(250);
    await noRawKeys("onboarding");
    await page.getByRole("button", { name: D.skip }).click().catch(() => {});
    await page.waitForTimeout(200);
    await noRawKeys("registration form");
  }, errors);

  await step(`[${L}] OTP step renders otpTitle + resendCode + a back arrow (keys once missing from the parent dictionaries)`, async () => {
    await page.getByPlaceholder(D.yourNamePlaceholder).fill("Dilnoza");
    await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
    await page.getByRole("button", { name: D.roleMother }).click();
    await page.getByRole("button", { name: D.continueLabel }).click(); await page.waitForTimeout(250);
    await mustShow(D.otpTitle, "OTP step");
    await mustShow(D.resendCode, "OTP step");
    if ((await page.getByLabel(D.back).count()) === 0) throw new Error(`[${L}] OTP step has no back arrow labelled "${D.back}"`);
    await noRawKeys("OTP step");
    const code = (await text()).match(/\b(\d{4})\b/)?.[1];
    if (!code) throw new Error(`[${L}] could not find the demo code on the OTP step`);
    await page.getByPlaceholder("0000").fill(code);
    await page.getByRole("button", { name: D.verifyCode }).click(); await page.waitForTimeout(500);
  }, errors);

  await step(`[${L}] every Parent screen (empty state) shows no raw keys; Grades shows noGradesYet`, async () => {
    await noRawKeys("dashboard");
    for (const [label, name] of [[D.navAttendance, "attendance"], [D.navGrades, "grades"], [D.navHomework, "homework"]]) {
      await page.getByText(label, { exact: true }).last().click(); await page.waitForTimeout(450);
      await noRawKeys(name);
      if (name === "grades") await mustShow(D.noGradesYet, "Grades (no grades yet)");
    }
    for (const [label, name] of [[D.navPayments, "payments"], [D.navInsights, "insights"], [D.navNotifications, "notifications"], [D.navChat, "chat"], [D.navProfile, "profile"], [D.navSettings, "settings"]]) {
      await openMore(label);
      await noRawKeys(name);
    }
  }, errors);

  await step(`[${L}] adding a guardian whose phone is already on the student shows guardianAlreadyAdded`, async () => {
    // Settings is already open from the previous step.
    await page.getByText(D.addGuardian, { exact: true }).first().click(); await page.waitForTimeout(250);
    await page.getByPlaceholder("Sardor Aliyev").fill("Test Person");
    await page.getByPlaceholder("+998 90 123 45 67").last().fill("901234567"); // the logged-in parent's own number
    await page.getByRole("button", { name: D.invite, exact: true }).click(); await page.waitForTimeout(250);
    await mustShow(D.guardianAlreadyAdded, "invite sheet (duplicate phone)");
    await noRawKeys("invite sheet");
  }, errors);

  await step(`[${L}] a student with exactly one graded month: Insights/Grades/PDF show the single-month texts, translated, with no unresolved {placeholders}`, async () => {
    await seedGrades(page, [{ groupId: "g-math-7a", subject: "Mathematics", title: "Only Test", date: "2026-09-05", maxScore: 20, scores: { aisha: 16 } }], { replace: true });
    await page.reload(); await page.waitForTimeout(500);
    await page.getByText(D.navGrades, { exact: true }).last().click(); await page.waitForTimeout(450);
    await noRawKeys("grades (one month)");
    await openMore(D.navInsights);
    await noRawKeys("insights (one month)");
    await mustShow(D.singleMonthNote, "Insights (one month)");
    await mustShow(D.trendNeedsMonths, "Insights (one month)");
    let t = await text();
    if (/\{(?:name|month|score)\}/.test(t)) throw new Error(`[${L}] unresolved placeholder in Insights: ${t.slice(0, 300)}`);
    // the print/PDF report reuses the same single-month wording
    await page.getByText(D.downloadPdf, { exact: false }).first().click(); await page.waitForTimeout(500);
    t = await page.evaluate(() => document.querySelector(".print-report")?.innerText || "");
    if (!t) throw new Error(`[${L}] report did not render`);
    if ((t.match(RAW_KEY) || []).length) throw new Error(`[${L}] raw key(s) in the PDF report: ${[...new Set(t.match(RAW_KEY))].join(", ")}`);
    if (/\{(?:name|month|score)\}/.test(t)) throw new Error(`[${L}] unresolved placeholder in the PDF report`);
  }, errors);

  await browser.close();
}

report();
