// Settings -> "Download my data" (Excel export of the selected child's history).
// exportChildDataToExcel() existed and had translations (downloadData,
// downloadDataDesc, dataDownloaded) but nothing in the UI called it. This
// checks the whole path a parent actually takes: open Settings, see the row,
// tap it, get a file.
//
// Against `npm run dev` this uses the REAL xlsx library, so a successful run
// is also the first end-to-end proof that the export works with it.
import fs from "fs";
import { launch, step, report, visibleText, EN, BASE, seedGrades } from "./lib.mjs";

const { browser, page, errors } = await launch({ width: 460, height: 950 });
const setLs = (k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
const text = () => visibleText(page);

const openSettings = async () => {
  await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200);
  await page.getByText(EN.navSettings, { exact: true }).first().click(); await page.waitForTimeout(350);
};
// Tap the row and capture the file the browser is handed.
const tapDownload = async () => {
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }),
    page.getByText(EN.downloadData, { exact: true }).first().click(),
  ]);
  const size = fs.statSync(await download.path()).size;
  return { name: download.suggestedFilename(), size };
};

await page.goto(BASE);

await step("setup: register as a parent and open Settings", async () => {
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await text()).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code);
  await page.getByRole("button", { name: EN.verifyCode }).click(); await page.waitForTimeout(450);
  await openSettings();
}, errors);

await step("Settings shows 'Download my data' with its description, right after 'Print report'", async () => {
  const t = await text();
  for (const s of [EN.downloadData, EN.downloadDataDesc, EN.printReport]) if (!t.includes(s)) throw new Error(`Settings is missing "${s}"`);
  if (t.indexOf(EN.downloadData) < t.indexOf(EN.printReport)) throw new Error("expected the download row after the print row");
}, errors);

await step("a child with NO grades yet still downloads a non-empty file named after the child, and the success message shows", async () => {
  const { name, size } = await tapDownload();
  if (name !== "Aisha_hisobot.xlsx") throw new Error("unexpected file name: " + name);
  if (!(size > 0)) throw new Error("the downloaded file is empty");
  await page.getByText(EN.dataDownloaded, { exact: false }).first().waitFor({ timeout: 3000 });
}, errors);

await step("with real grade data (first assessment in May) it downloads again without any error", async () => {
  await seedGrades(page, [
    { groupId: "g-math-7a", subject: "Mathematics", title: "May quiz", date: "2026-05-08", maxScore: 20, scores: { aisha: 16 } },
    { groupId: "g-math-7a", subject: "Mathematics", title: "Sep quiz", date: "2026-09-05", maxScore: 20, scores: { aisha: 18 } },
  ], { replace: true });
  await page.reload(); await page.waitForTimeout(500);
  await openSettings();
  const { name, size } = await tapDownload();
  if (name !== "Aisha_hisobot.xlsx" || !(size > 0)) throw new Error(`bad download: ${name}, ${size} bytes`);
}, errors);

await step("it exports the SELECTED child, not always the first one", async () => {
  await page.getByText(EN.navDashboard, { exact: true }).last().click();
  await page.waitForTimeout(300);
  await page.getByText("▾").first().click(); await page.waitForTimeout(200);
  await page.getByText("Umar").first().click(); await page.waitForTimeout(350);
  await openSettings();
  const { name } = await tapDownload();
  if (name !== "Umar_hisobot.xlsx") throw new Error("expected Umar's file, got " + name);
}, errors);

await step("when producing the file fails, the parent sees the failure message and no file is delivered", async () => {
  // Both the real xlsx library and the harness stand-in deliver the file via
  // URL.createObjectURL, so blocking it fails the export the same way in both.
  // The handler deliberately logs the error with console.error; silence it for
  // this step so the harness doesn't mistake that expected log for a failure.
  await page.evaluate(() => {
    console.error = () => {};
    URL.createObjectURL = () => { throw new Error("blocked on purpose"); };
  });
  let gotDownload = false;
  page.once("download", () => { gotDownload = true; });
  await page.getByText(EN.downloadData, { exact: true }).first().click();
  await page.getByText(EN.dataDownloadFailed, { exact: false }).first().waitFor({ timeout: 3000 });
  await page.waitForTimeout(600);
  if (gotDownload) throw new Error("a file was delivered even though the export failed");
  if ((await text()).includes(EN.dataDownloaded)) throw new Error("the SUCCESS message is showing for a failed export");
}, errors);

report();
await browser.close();
