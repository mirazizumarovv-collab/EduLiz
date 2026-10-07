// The app now reads the REAL clock (src/utils/clock.js). Every other browser
// test pins it to the old demo date; this one moves it, to prove the app
// really follows it:
//   1. today is 6 Oct 2026 — a date the old fixed "Mar–Sep" calendar could not
//      show at all (the Parent app went blank)
//   2. time of day and midnight pass while the app stays open — no reload
//   3. the months in view cross New Year, and January 2026 is not January 2027
//   4. the Teacher's forms default to — and stop at — today
import { launch, step, report, visibleText, setNow, EN, BASE, seedGrades, readGradeStore } from "./lib.mjs";

const OCT6 = "2026-10-06T14:30:00+05:00";
const readLs = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = (page, k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
const text = (page) => visibleText(page);

const registerParent = async (page) => {
  await page.getByRole("button", { name: /Parent/ }).click(); await page.waitForTimeout(250);
  await page.getByRole("button", { name: EN.skip }).click().catch(() => {});
  await page.getByPlaceholder(EN.yourNamePlaceholder).fill("Dilnoza");
  await page.getByPlaceholder("+998 90 123 45 67").fill("998901234567");
  await page.getByRole("button", { name: EN.roleMother }).click();
  await page.getByRole("button", { name: EN.continueLabel }).click();
  const code = (await text(page)).match(/Your code: (\d{4})/)[1];
  await page.getByPlaceholder("0000").fill(code);
  await page.getByRole("button", { name: EN.verifyCode }).click(); await page.waitForTimeout(500);
};
const switchToChild = async (page, name) => {
  await page.getByText("▾").first().click(); await page.waitForTimeout(150);
  await page.getByText(name).first().click(); await page.waitForTimeout(350);
};
const goTo = async (page, label) => { await page.getByText(label, { exact: true }).last().click(); await page.waitForTimeout(450); };
const need = (cond, msg) => { if (!cond) throw new Error(msg); };
// A new day makes the screens re-fetch (the data services take a moment), so
// after moving the clock a check polls until it holds instead of looking once.
const eventually = async (check, timeout = 4000) => {
  const end = Date.now() + timeout; let last;
  for (;;) {
    try { await check(); return; } catch (e) { last = e; }
    if (Date.now() > end) throw last;
    await new Promise(r => setTimeout(r, 150));
  }
};

// =============================================================== 1. 6 Oct 2026
{
  const { browser, page, errors } = await launch({ width: 460, height: 950 }, undefined, { now: OCT6 });
  await page.goto(BASE);

  await step("1. on 6 Oct 2026 the Parent app renders (it used to be a blank screen) and counts the payment deadline from TODAY", async () => {
    await registerParent(page);
    await switchToChild(page, "Umar");                       // Umar's payment is 'pending'
    const t = await text(page);
    need(t.length > 50, "blank screen: " + JSON.stringify(t));
    need(t.includes(EN.alertPaymentDue.replace("{days}", "4")), "expected 'Payment due in 4 days' (6 Oct → 10 Oct): " + t.slice(0, 300));
  }, errors);

  await step("1. overdue counts back to the LAST 10th (10 Sep → 26 days before 6 Oct)", async () => {
    await setLs(page, "paymentsStatus", { aisha: "paid", umar: "overdue" });
    await page.reload(); await page.waitForTimeout(500);
    need((await text(page)).includes(EN.alertPaymentOverdue.replace("{days}", "26")), "expected 'overdue by 26 days': " + (await text(page)).slice(0, 300));
  }, errors);

  await step("1. Attendance: October is current, September is the month before, the window starts at April — March is gone", async () => {
    await setLs(page, "attendanceRecords", { "g-math-4a": {
      "2026-10-05": { umar: { status: "P" } }, "2026-10-02": { umar: { status: "L", lateBy: 5 } }, "2026-10-01": { umar: { status: "A" } },
      "2026-09-28": { umar: { status: "A" } },
      "2026-04-10": { umar: { status: "P" } },
      "2026-03-31": { umar: { status: "P" } },              // before the window: must not appear anywhere
    } });
    await page.reload(); await page.waitForTimeout(500);
    await goTo(page, EN.navAttendance);
    let t = await text(page);
    need(t.includes("October") && t.includes("67%"), "expected October and 67% (2 of 3 attended): " + t.slice(0, 300));
    await page.getByText("‹", { exact: true }).click(); await page.waitForTimeout(250);
    t = await text(page);
    need(t.includes("September") && t.includes("0%"), "expected September at 0%: " + t.slice(0, 300));
    for (let i = 0; i < 5; i++) { await page.getByText("‹", { exact: true }).click(); await page.waitForTimeout(120); }
    t = await text(page);
    need(t.includes("April") && t.includes("100%"), "expected April at 100%: " + t.slice(0, 300));
    need(!t.includes("March"), "March is outside the window but is showing");
    need((await page.getByText("‹", { exact: true }).isDisabled()), "the earlier-month button should be disabled at the start of the window");
  }, errors);

  await step("1. Homework: a task due 20 Oct shows '14 days left' on 6 Oct", async () => {
    await setLs(page, "homeworkRecords", { "g-math-4a": [{ id: "hw-oct", title: "Ten Days Later", dueDate: "2026-10-20", createdDate: "2026-10-01" }] });
    await page.reload(); await page.waitForTimeout(500);
    await goTo(page, EN.navHomework);
    await page.getByText("Ten Days Later").first().click(); await page.waitForTimeout(300);
    need((await text(page)).includes(EN.daysLeft.replace("{n}", "14")), "expected '14 days left': " + (await text(page)).slice(0, 300));
  }, errors);

  await step("1. a chat message is stamped with the real current moment, and 'TODAY' becomes 'YESTERDAY' once the day changes — live", async () => {
    await page.reload(); await page.waitForTimeout(400);
    await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200);
    await page.getByText(EN.navChat, { exact: true }).first().click(); await page.waitForTimeout(400);
    await page.getByPlaceholder(EN.chatPlaceholder).fill("Hello from October");
    await page.keyboard.press("Enter"); await page.waitForTimeout(400);
    const thread = (await readLs(page, "messageThreads")).umar || [];
    const mine = thread.find(m => m.text === "Hello from October");
    need(mine && mine.time === "2026-10-06T14:30:00", "message not stamped with the clock: " + JSON.stringify(mine));
    need((await text(page)).includes(EN.today.toUpperCase()), "expected the TODAY separator");
    await setNow(page, "2026-10-07T09:00:00+05:00");
    await eventually(async () => need((await text(page)).includes(EN.yesterday.toUpperCase()), "expected the separator to turn into YESTERDAY without a reload: " + (await text(page)).slice(0, 300)));
  }, errors);
  await browser.close();
}

// ===================================================== 2. time and midnight pass
{
  const { browser, page, errors } = await launch({ width: 460, height: 950 });          // 8 Sep 2026, 14:30
  await page.goto(BASE);
  const bellDot = () => page.locator("[aria-label=notifications] span").count();
  const dashCount = async () => { const m = (await text(page)).match(/(\d+)\s*\|\s*Notifications/); return m ? Number(m[1]) : null; };

  await step("2. setup: a grade notification, quiet hours 22:00–07:00, homework due today, payment pending", async () => {
    await registerParent(page);
    await seedGrades(page, [{ groupId: "g-math-7a", subject: "Mathematics", title: "Quiz", date: "2026-09-08", maxScore: 20, scores: { aisha: 18 } }], { replace: true });
    await setLs(page, "quietHours", { enabled: true, start: "22:00", end: "07:00" });
    await setLs(page, "paymentsStatus", { aisha: "pending", umar: "paid" });
    await setLs(page, "homeworkRecords", { "g-math-7a": [{ id: "hw-today", title: "Due Today", dueDate: "2026-09-08", createdDate: "2026-09-01" }] });
    await page.reload(); await page.waitForTimeout(600);
  }, errors);

  await step("2. at 14:30 it is NOT quiet: the unread dot and count show; payment due in 2 days; 1 homework pending", async () => {
    need((await bellDot()) > 0 && (await dashCount()) > 0, `bell dot=${await bellDot()}, count=${await dashCount()}`);
    const t = await text(page);
    need(t.includes(EN.alertPaymentDue.replace("{days}", "2")), "payment countdown: " + t.slice(0, 300));
    need(t.includes(EN.alertHomeworkPending.replace("{n}", "1")), "homework alert: " + t.slice(0, 300));
  }, errors);

  await step("2. at 23:30 — with the app still open — quiet hours begin by themselves: dot and count disappear", async () => {
    await setNow(page, "2026-09-08T23:30:00+05:00");
    need((await bellDot()) === 0 && (await dashCount()) === 0, `bell dot=${await bellDot()}, count=${await dashCount()}`);
  }, errors);

  await step("2. after midnight the new day arrives live: the payment is 1 day away and today's homework is now overdue (no longer 'pending')", async () => {
    await setNow(page, "2026-09-09T08:00:00+05:00");              // quiet hours are over, and it is the 9th
    await eventually(async () => {
      need((await bellDot()) > 0 && (await dashCount()) > 0, "the unread dot/count should be back after quiet hours");
      const t = await text(page);
      need(t.includes(EN.alertPaymentDue.replace("{days}", "1")), "payment countdown should now be 1 day: " + t.slice(0, 300));
      need(!t.includes(EN.alertHomeworkPending.replace("{n}", "1")), "the homework is overdue now and must not be listed as pending: " + t.slice(0, 300));
    });
  }, errors);
  await browser.close();
}

// ===================================================== 3. across New Year
{
  const { browser, page, errors } = await launch({ width: 460, height: 950 }, undefined, { now: "2027-01-10T12:00:00+05:00" });
  await page.goto(BASE);
  await step("3. on 10 Jan 2027, January shows only January 2027 — the absence of 15 Jan 2026 is not mixed in", async () => {
    await registerParent(page);
    await setLs(page, "attendanceRecords", { "g-math-7a": { "2026-01-15": { aisha: { status: "A" } }, "2027-01-07": { aisha: { status: "P" } } } });
    await setLs(page, "paymentsStatus", { aisha: "pending", umar: "paid" });
    await page.reload(); await page.waitForTimeout(500);
    need((await text(page)).includes(EN.alertPaymentDue.replace("{days}", "31")), "10 Jan → 10 Feb is 31 days: " + (await text(page)).slice(0, 300));
    await goTo(page, EN.navAttendance);
    const t = await text(page);
    need(t.includes("January") && t.includes("100%") && !t.includes("50%"), "expected January at 100%, not a 50% blend with last year: " + t.slice(0, 300));
    for (let i = 0; i < 6; i++) { await page.getByText("‹", { exact: true }).click(); await page.waitForTimeout(100); }
    need((await text(page)).includes("July"), "the window should start in July 2026");
  }, errors);
  await browser.close();
}

// ============================================ 4. the Teacher's forms follow the clock
{
  const { browser, page, errors } = await launch({ width: 1100, height: 1000 }, undefined, { now: OCT6 });
  await page.goto(BASE);
  await step("4. on 6 Oct 2026 the Teacher's date boxes default to today and end there; grades reach back to the start of the months in view", async () => {
    await page.getByRole("button", { name: /Teacher/ }).click();
    await page.getByText("Malika Yusupova").click();
    await page.getByText(EN.navAttendance, { exact: true }).first().click(); await page.waitForTimeout(250);
    const att = page.locator("input[type=date]").first();
    need((await att.inputValue()) === "2026-10-06" && (await att.getAttribute("max")) === "2026-10-06", `attendance date ${await att.inputValue()} / max ${await att.getAttribute("max")}`);
    await page.getByText(EN.navGrades, { exact: true }).first().click(); await page.waitForTimeout(250);
    const g = page.locator("input[type=date]").first();
    const got = [await g.inputValue(), await g.getAttribute("min"), await g.getAttribute("max")];
    need(JSON.stringify(got) === JSON.stringify(["2026-10-06", "2026-04-01", "2026-10-06"]), "grade date value/min/max = " + got.join(" / "));
    // and a new test is saved with today's real date
    await page.getByPlaceholder(EN.assessmentTitlePlaceholder).fill("October Quiz");
    await page.locator("input[type=number]").nth(1).fill("15");
    await page.getByRole("button", { name: EN.saveGrades }).click(); await page.waitForTimeout(300);
    const store = JSON.parse(await page.evaluate(() => localStorage.getItem("parentApp:gradeStore")));
    need(store.assessments[0].date === "2026-10-06", "saved with " + store.assessments[0].date);
  }, errors);

  await step("4. a test from 10 Mar — now BEFORE the months in view (they start 1 Apr) — can still be corrected; only moving it to another too-early date is refused", async () => {
    await seedGrades(page, [{ groupId: "g-math-7a", subject: "Mathematics", title: "March Quiz", date: "2026-03-10", maxScore: 20, scores: { aisha: 12 } }]);
    await page.reload(); await page.waitForTimeout(500);
    await page.getByText(EN.navGrades, { exact: true }).first().click(); await page.waitForTimeout(300);
    const row = page.locator("[data-assessment]", { hasText: "March Quiz — 2026-03-10" });
    await row.getByRole("button", { name: EN.edit, exact: true }).click(); await page.waitForTimeout(200);
    await page.getByPlaceholder(EN.assessmentTitlePlaceholder).fill("March Quiz (fixed)");
    await page.locator("input[type=number]").nth(1).fill("15");
    await page.getByRole("button", { name: EN.saveChanges }).click(); await page.waitForTimeout(300);
    need((await page.getByRole("alert").count()) === 0, "the edit was refused: " + await page.getByRole("alert").innerText().catch(() => ""));
    let a = (await readGradeStore(page)).assessments.find(x => x.title === "March Quiz (fixed)");
    need(a && a.date === "2026-03-10", "title not updated, or the date moved: " + JSON.stringify(a));
    // …but choosing a NEW date that is also before the window is refused with the reason
    await page.locator("[data-assessment]", { hasText: "March Quiz (fixed)" }).getByRole("button", { name: EN.edit, exact: true }).click(); await page.waitForTimeout(200);
    await page.locator("input[type=date]").fill("2026-03-15");
    await page.getByRole("button", { name: EN.saveChanges }).click();
    await page.getByRole("alert").waitFor({ timeout: 3000 });
    need((await page.getByRole("alert").innerText()).trim() === EN.errorDateTooEarly.replace("{date}", "2026-04-01"), "wrong message: " + await page.getByRole("alert").innerText());
  }, errors);
  await browser.close();
}

report();
