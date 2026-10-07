import { launch, step, report, visibleText, EN, BASE, seedGrades } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
const expectText = async (t) => { await page.getByText(t, { exact: false }).first().waitFor({ timeout: 3500 }); };
const ls = async (k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = async (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
await page.goto(BASE);

const register = async () => {
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code); await page.getByRole("button", { name: EN.verifyCode }).click();
  await page.waitForTimeout(400);
};

// ---------- #4: Dashboard badge matches Header badge during quiet hours ----------
await step("#4 setup: create a real grade notification, then enable quiet hours covering CURRENT_TIME_STR (14:30)", async () => {
  await register();
  await seedGrades(page, [{ groupId: "g-math-7a", subject: "Mathematics", title: "Quiet Hours Quiz", date: "2026-09-08", maxScore: 20, scores: { aisha: 18 } }], { replace: true });
  await setLs("quietHours", { enabled: true, start: "00:00", end: "23:59" }); // covers all day, including 14:30
  await page.reload(); await page.waitForTimeout(500);
}, errors);

await step("#4 fix: Header bell badge and Dashboard's notification stat pill AGREE (both suppressed by quiet hours)", async () => {
  const headerHasDot = await page.locator("[aria-label=notifications] span").count(); // the red unread dot, if present
  const txt = await visibleText(page);
  const dashboardMatch = txt.match(/(\d+)\s*\|\s*Notifications/);
  const dashboardCount = dashboardMatch ? Number(dashboardMatch[1]) : null;
  if (dashboardCount === null) throw new Error("could not read Dashboard's notification count: " + txt.slice(0, 400));
  const bellSuppressed = headerHasDot === 0;
  const dashboardSuppressed = dashboardCount === 0;
  if (bellSuppressed !== dashboardSuppressed) {
    throw new Error(`Header bell suppressed=${bellSuppressed} but Dashboard count=${dashboardCount} (suppressed=${dashboardSuppressed}) — they disagree`);
  }
  if (!bellSuppressed) throw new Error("expected BOTH to be suppressed during all-day quiet hours, neither was: dot=" + headerHasDot + " count=" + dashboardCount);
}, errors);

await step("#4 fix (contrast): disabling quiet hours makes BOTH show the real unread count again, still in agreement", async () => {
  await setLs("quietHours", { enabled: false, start: "22:00", end: "07:00" });
  await page.reload(); await page.waitForTimeout(500);
  const headerHasDot = await page.locator("[aria-label=notifications] span").count();
  const txt = await visibleText(page);
  const dashboardMatch = txt.match(/(\d+)\s*\|\s*Notifications/);
  const dashboardCount = dashboardMatch ? Number(dashboardMatch[1]) : null;
  if (dashboardCount === 0) throw new Error("expected a real unread count once quiet hours are off, got 0");
  if (headerHasDot === 0) throw new Error("expected the Header bell dot to reappear once quiet hours are off");
}, errors);

// ---------- #5: Homework 'Late' filter is distinct from 'Completed' ----------
await step("#5 setup: inject one on-time completed item and one late-completed item", async () => {
  const hw = await ls("homeworkRecords");
  hw["g-math-7a"] = hw["g-math-7a"] || [];
  hw["g-math-7a"].push(
    { id: "hw-ontime", title: "On Time HW", dueDate: "2026-09-12", createdDate: "2026-09-01" },
    { id: "hw-late", title: "Late HW", dueDate: "2026-09-05", createdDate: "2026-09-01" }
  );
  await setLs("homeworkRecords", hw);
  const sub = await ls("homeworkSubmissions");
  sub["hw-ontime"] = { aisha: { submittedAt: "2026-09-08" } }; // before due 09-12 = on time
  sub["hw-late"] = { aisha: { submittedAt: "2026-09-08" } };   // after due 09-05 = late
  await setLs("homeworkSubmissions", sub);
  await page.evaluate(() => { localStorage.setItem("parentApp:role", "null"); });
  await page.reload(); await page.waitForTimeout(300);
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(400); // already registered — auto-recognized
}, errors);

await step("#5 fix: 'Late' filter shows ONLY the late item; 'Completed' filter shows ONLY the on-time item", async () => {
  await page.getByText(EN.navHomework, { exact: true }).last().click(); await page.waitForTimeout(400);
  await page.getByText(EN.lateHw, { exact: true }).click(); await page.waitForTimeout(250);
  let txt = await visibleText(page);
  if (!/Late HW/.test(txt)) throw new Error("Late filter missing the late item: " + txt.slice(0, 400));
  if (/On Time HW/.test(txt)) throw new Error("Late filter wrongly includes the on-time item: " + txt.slice(0, 400));
  await page.getByText(EN.completed, { exact: true }).click(); await page.waitForTimeout(250);
  txt = await visibleText(page);
  if (!/On Time HW/.test(txt)) throw new Error("Completed filter missing the on-time item: " + txt.slice(0, 400));
  if (/Late HW/.test(txt)) throw new Error("Completed filter wrongly includes the late item: " + txt.slice(0, 400));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
