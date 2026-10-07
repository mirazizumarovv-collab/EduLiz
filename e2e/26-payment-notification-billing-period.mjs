import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
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

await step("setup: register and set a pending payment status", async () => {
  await register();
  await setLs("paymentsStatus", { aisha: "pending" });
  await page.reload(); await page.waitForTimeout(500);
}, errors);

await step("Marking September's payment notification read does NOT silently mark October's (a later billing period) as read too", async () => {
  // Read September's notification (deadline 2026-09-10, since today is 09-08, before the 10th).
  await page.getByText(EN.navMore, { exact: true }).last().click().catch(() => {});
  await page.getByText(EN.navNotifications, { exact: true }).first().click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: EN.markRead }).first().click();
  await page.waitForTimeout(200);
  const readIds = await page.evaluate(() => JSON.parse(localStorage.getItem("parentApp:readNotifIds") || "[]"));
  if (!readIds.some(id => id.includes("2026-09-10"))) throw new Error("September's payment notification id does not carry its real deadline: " + JSON.stringify(readIds));

  // Now simulate a new billing month: status still pending/overdue, but the
  // deadline has moved forward (Admin's "Start new billing month" + time passing).
  await setLs("paymentsStatus", { aisha: "overdue" }); // a later period now overdue
  await page.evaluate(() => { localStorage.setItem("parentApp:currentDateStrOverrideForTest", "unused"); });
  await page.reload(); await page.waitForTimeout(500);
  await page.getByText(EN.navMore, { exact: true }).last().click().catch(() => {});
  await page.getByText(EN.navNotifications, { exact: true }).first().click(); await page.waitForTimeout(400);
  const txt = await visibleText(page);
  // The OVERDUE status now produces a DIFFERENT deadline (2026-08-10, a past
  // date) -> a DIFFERENT notification id than September's -> must show as
  // unread (not silently inherited as already-read from the old id).
  if ((await page.getByRole("button", { name: EN.markRead }).count()) === 0) throw new Error("no unread payment notification shown for the new overdue period: " + txt.slice(0, 400));
  const readIds2 = await page.evaluate(() => JSON.parse(localStorage.getItem("parentApp:readNotifIds") || "[]"));
  if (readIds2.some(id => id.includes("2026-08-10"))) throw new Error("the NEW billing period's notification was somehow already marked read: " + JSON.stringify(readIds2));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
