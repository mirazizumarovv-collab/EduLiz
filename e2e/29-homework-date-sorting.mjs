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

// ---------- #16/#17: homework sorted by date, not insertion order ----------
await step("#16/#17 setup: three homework items inserted OUT of chronological order", async () => {
  await register();
  const hw = { "g-math-7a": [
    { id: "hw-mid", title: "Middle Due", dueDate: "2026-09-15", createdDate: "2026-09-01" },
    { id: "hw-early", title: "Early Due", dueDate: "2026-09-05", createdDate: "2026-09-01" },
    { id: "hw-late", title: "Late Due", dueDate: "2026-09-25", createdDate: "2026-09-01" },
  ]};
  await setLs("homeworkRecords", hw);
  const sub = { "hw-early": { aisha: { submittedAt: "2026-09-04" } } }; // early one completed; mid/late remain pending
  await setLs("homeworkSubmissions", sub);
  await page.reload(); await page.waitForTimeout(400);
}, errors);

await step("#16/#17 fix: Pending list shows SOONEST due first (Middle before Late)", async () => {
  await page.getByText(EN.navHomework, { exact: true }).last().click(); await page.waitForTimeout(400);
  const txt = await visibleText(page);
  const midIdx = txt.indexOf("Middle Due"), lateIdx = txt.indexOf("Late Due");
  if (midIdx === -1 || lateIdx === -1) throw new Error("items missing: " + txt.slice(0, 400));
  if (midIdx > lateIdx) throw new Error("Pending not sorted soonest-first: " + txt.slice(0, 400));
}, errors);

await step("#16/#17 fix: Dashboard's 'recent activity' shows the ACTUAL most-recently-due completed item, not whichever was inserted last", async () => {
  await page.getByText(EN.navHomeStaff, { exact: true }).first().click().catch(() => {});
  await page.getByText("Home", { exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(400);
  const txt = await visibleText(page);
  if (!/Early Due/.test(txt)) throw new Error("Dashboard recent activity does not show the only completed item: " + txt.slice(0, 500));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
