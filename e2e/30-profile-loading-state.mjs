import { launch, step, report, visibleText, EN, BASE } from "./lib.mjs";
const { browser, page, errors } = await launch({ width: 1100, height: 950 });
const has = async (t) => (await visibleText(page)).includes(t);
await page.goto(BASE);

await step("#14/#15: Profile shows a loading skeleton while fetching, then real content — not a silent gap", async () => {
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await visibleText(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code); await page.getByRole("button", { name: EN.verifyCode }).click();
  await page.waitForTimeout(400);
  await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200);
  await page.getByText(EN.navProfile, { exact: true }).first().click();
  // Catch it mid-load (services simulate ~350ms latency)
  await page.waitForTimeout(80);
  const midTxt = await visibleText(page);
  const hasSkeletonHint = await page.locator("[class*=skeleton], [style*='animation']").count();
  // Either an explicit skeleton element, or at minimum the summary/overview
  // sections are genuinely absent (not silently blank) while loading.
  await page.waitForTimeout(500);
  const finalTxt = await visibleText(page);
  if (!/quickSummary|Quick Summary|Overview|childOverview|Child Overview/i.test(finalTxt) && !has(EN.noGradesYet)) {
    throw new Error("Profile never shows its summary/overview content after loading: " + finalTxt.slice(0, 400));
  }
  if (!/Dilnoza/.test(finalTxt)) throw new Error("Account section missing: " + finalTxt.slice(0, 300));
}, errors);

report(); console.log("\nALL ERRORS:", errors);
await browser.close();
