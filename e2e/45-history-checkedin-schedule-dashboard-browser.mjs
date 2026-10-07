// Browser-level checks (the rules are unit-tested in 44):
//   1. A move: the day of the move belongs to ONE group, so the Parent sees that
//      day once; a history saved by the old overlapping rule still shows it once
//   2. "Checked in by" is whoever took the register — never an invented "Front desk"
//   3. A schedule with an end time still gives the class START time everywhere
//   4. Admin dashboard: expected revenue is labelled as an expectation, next to
//      what the recorded payments actually add up to this month
//   5. "Mark all as read" marks what the person can SEE — notifications held back by
//      quiet hours stay unread and are there when quiet hours end
import { launch, step, report, visibleText, setNow, seedGrades, EN, BASE } from "./lib.mjs";

const need = (cond, msg) => { if (!cond) throw new Error(msg); };
const ls = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
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
const asTeacher = async (page) => { await page.getByRole("button", { name: /Teacher/ }).click(); await page.getByText("Malika Yusupova").click(); await page.waitForTimeout(250); };
const goTo = async (page, label) => { await page.getByText(label, { exact: true }).first().click(); await page.waitForTimeout(300); };
const logout = async (page) => { await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(250); };
const adminMovesAisha = async (page, toGroup) => {
  await page.getByRole("button", { name: /Administrator/ }).click(); await page.waitForTimeout(250);
  await goTo(page, EN.navStudents);
  const row = page.locator("div", { hasText: "Aisha" }).filter({ has: page.getByLabel(EN.edit) }).last();
  await row.getByLabel(EN.edit).click();
  await page.locator("select").last().selectOption({ label: toGroup });
  await page.getByRole("button", { name: EN.save, exact: true }).click(); await page.waitForTimeout(300);
};
const openAttendance = async (page) => { await goTo(page, EN.navAttendance); await page.getByRole("button", { name: /^\d+: / }).first().waitFor({ timeout: 4000 }); };
const dayButtons = (page, day) => page.getByRole("button", { name: new RegExp(`^${day}: `) });
const TODAY = "2026-09-08";

// =============================================================== 1a. the move day — already marked in the old group
{
  const { browser, page, errors } = await launch({ width: 1100, height: 1000 });
  await page.goto(BASE);
  await step("setup: Aisha was marked Present in Mathematics 7A today (8 Sep); 4A's register has a stray Absent for today and a back-filled mark for 2 Sep", async () => {
    await setLs(page, "attendanceRecords", {
      "g-math-7a": { "2026-09-03": { aisha: { status: "P" } }, [TODAY]: { aisha: { status: "P" } } },
      "g-math-4a": { [TODAY]: { aisha: { status: "A" } }, "2026-09-02": { aisha: { status: "P" } } },
    });
    await page.reload(); await page.waitForTimeout(400);
  }, errors);

  await step("Admin moves her to 4A: today stays with the OLD group (she attended its lesson) and the new group begins tomorrow", async () => {
    await adminMovesAisha(page, "Mathematics 4A");
    const aisha = (await ls(page, "students")).find(s => s.id === "aisha");
    need(aisha.groupId === "g-math-4a", "the move did not apply");
    need(JSON.stringify(aisha.groupHistory) === JSON.stringify([{ groupId: "g-math-7a", from: null, to: TODAY }, { groupId: "g-math-4a", from: "2026-09-09", to: null }]), "history: " + JSON.stringify(aisha.groupHistory));
  }, errors);

  await step("the Parent sees 8 Sep ONCE — as Present (the lesson she attended), not Absent from the other register — and not 2 Sep, which is 4A's back-filled mark from before she joined", async () => {
    await logout(page); await registerParent(page);
    await openAttendance(page);
    need(await dayButtons(page, 8).count() === 1, "day 8 appears " + await dayButtons(page, 8).count() + " times");
    need(await page.getByRole("button", { name: "8: " + EN.present }).count() === 1, "day 8 should be Present");
    need(await dayButtons(page, 3).count() === 1, "her earlier day is gone");
    need(await dayButtons(page, 2).count() === 0, "a mark in 4A's register for a day before she was in 4A is showing as hers");
  }, errors);
  console.log("ERRORS:", errors); await browser.close();
}

// =============================================================== 1b. the move day — not yet marked: it is the NEW group's
{
  const { browser, page, errors } = await launch({ width: 1100, height: 1000 });
  await page.goto(BASE);
  await step("setup: Aisha was marked in 7A on 7 Sep; today (8 Sep) she has not been marked anywhere yet", async () => {
    await setLs(page, "attendanceRecords", { "g-math-7a": { "2026-09-07": { aisha: { status: "P" } } } });
    await page.reload(); await page.waitForTimeout(400);
  }, errors);
  await step("Admin moves her to 4A: the old group ends YESTERDAY and the new one starts today", async () => {
    await adminMovesAisha(page, "Mathematics 4A");
    const aisha = (await ls(page, "students")).find(s => s.id === "aisha");
    need(JSON.stringify(aisha.groupHistory) === JSON.stringify([{ groupId: "g-math-7a", from: null, to: "2026-09-07" }, { groupId: "g-math-4a", from: TODAY, to: null }]), "history: " + JSON.stringify(aisha.groupHistory));
  }, errors);
  await step("a mark the new group's teacher makes for her today counts (the day is the new group's); yesterday's old-group mark still shows", async () => {
    const att = await ls(page, "attendanceRecords");
    att["g-math-4a"] = { [TODAY]: { aisha: { status: "L", lateBy: 6 } } };
    await setLs(page, "attendanceRecords", att);
    await logout(page); await page.reload(); await page.waitForTimeout(400);
    await registerParent(page); await openAttendance(page);
    need(await page.getByRole("button", { name: "8: " + EN.late }).count() === 1, "today's late mark from 4A is missing");
    need(await dayButtons(page, 7).count() === 1, "yesterday's mark from 7A is missing");
  }, errors);
  console.log("ERRORS:", errors); await browser.close();
}

// =============================================================== 1c. a history saved by the OLD rule (both groups claim the 8th)
{
  const { browser, page, errors } = await launch({ width: 460, height: 950 });
  await page.goto(BASE);
  await step("a history that still has both groups claiming 8 Sep, with a mark in each register: ONE day, no duplicate-key warning", async () => {
    const students = await ls(page, "students");
    const aisha = students.find(s => s.id === "aisha");
    aisha.groupId = "g-math-4a";
    aisha.groupHistory = [{ groupId: "g-math-7a", from: null, to: TODAY }, { groupId: "g-math-4a", from: TODAY, to: null }];
    await setLs(page, "students", students);
    await setLs(page, "attendanceRecords", { "g-math-7a": { [TODAY]: { aisha: { status: "P" } } }, "g-math-4a": { [TODAY]: { aisha: { status: "A" } } } });
    await page.reload(); await page.waitForTimeout(400);
    await registerParent(page); await openAttendance(page);
    need(await dayButtons(page, 8).count() === 1, "day 8 appears " + await dayButtons(page, 8).count() + " times");
    need(await page.getByRole("button", { name: "8: " + EN.absent }).count() === 1, "the later stay's mark (Absent, from 4A) should be the one shown");
  }, errors);
  console.log("ERRORS:", errors); await browser.close();
}

// =============================================================== 2 + 3. checked in by, and a schedule with an end time
{
  const { browser, page, errors } = await launch({ width: 1100, height: 1000 });
  await page.goto(BASE);
  await step("setup: Mathematics 7A runs 15:00-16:30; 3 Sep was taken by a cover teacher, 4 Sep is an older record without the stamp, 5 Sep is an absence", async () => {
    const groups = await ls(page, "groups");
    groups.find(g => g.id === "g-math-7a").schedule = "Mon/Wed/Fri 15:00-16:30";
    await setLs(page, "groups", groups);
    await setLs(page, "attendanceRecords", { "g-math-7a": {
      "2026-09-03": { aisha: { status: "P", lesson: { subject: "Mathematics", teacher: "Malika Yusupova", time: "15:00" }, markedBy: { role: "teacher", name: "Cover Teacher" } } },
      "2026-09-04": { aisha: { status: "P" } },
      "2026-09-05": { aisha: { status: "A", markedBy: { role: "teacher", name: "Cover Teacher" } } },
    } });
    await page.reload(); await page.waitForTimeout(400);
  }, errors);

  await step("Teacher saves today's register: each entry records WHO took it (the signed-in teacher) and the class START time", async () => {
    await asTeacher(page); await goTo(page, EN.navAttendance);
    await page.locator("select").first().selectOption({ label: "Mathematics 7A" });
    await page.getByRole("button", { name: EN.present, exact: true }).click();
    await page.getByRole("button", { name: EN.saveAttendance }).click();
    await page.getByText(EN.attendanceSaved).waitFor({ timeout: 3000 });
    const e = (await ls(page, "attendanceRecords"))["g-math-7a"][TODAY].aisha;
    need(JSON.stringify(e.markedBy) === JSON.stringify({ role: "teacher", name: "Malika Yusupova" }), "markedBy: " + JSON.stringify(e.markedBy));
    need(e.lesson && e.lesson.time === "15:00", "the lesson time should be the START (15:00), got: " + JSON.stringify(e.lesson));
    const others = (await ls(page, "attendanceRecords"))["g-math-7a"];
    need(others["2026-09-03"].aisha.markedBy.name === "Cover Teacher", "an earlier day's marker was overwritten");
  }, errors);

  await step("Parent: the day detail names the teacher who took the register; an older record shows no name (not 'Front desk'); an absence has no check-in", async () => {
    await logout(page); await registerParent(page);
    await goTo(page, EN.navAttendance);
    const open = async (day, label) => { await page.getByRole("button", { name: `${day}: ${label}` }).click(); await page.waitForTimeout(250); return text(page); };
    const close = async () => { await page.getByLabel(EN.back).last().click(); await page.waitForTimeout(200); };

    let t = await open(3, EN.present);
    need(t.includes(EN.checkedInAt) && t.includes("Cover Teacher"), "day 3 should show who checked her in: " + t.slice(-300));
    await close();
    t = await open(4, EN.present);
    need(t.includes(EN.checkedInAt) && !t.includes("Cover Teacher") && !t.includes("Front desk"), "day 4 (no stamp) must not name anyone: " + t.slice(-300));
    need(t.includes("15:00") && !t.includes("15:00-16:30"), "the lesson time should be the start, 15:00: " + t.slice(-300));
    await close();
    t = await open(5, EN.absent);
    need(!t.includes(EN.checkedInAt), "an absent day has no check-in row: " + t.slice(-300));
    await close();
    need(!(await text(page)).includes("Front desk"), "'Front desk' is still on the screen");
  }, errors);
  console.log("ERRORS:", errors); await browser.close();
}

// =============================================================== 4. Admin dashboard
{
  const { browser, page, errors } = await launch({ width: 1100, height: 1000 });
  await page.goto(BASE);
  const money = async (label) => {
    const m = (await text(page)).match(new RegExp(`([\\d.,\\s\\u00a0]+?) so'm \\| ${label}`));
    need(m, `no "${label}" card: ` + (await text(page)).slice(0, 400));
    return Number(m[1].replace(/\D/g, ""));
  };
  await step("Admin dashboard: 'Expected monthly revenue' is students × the flat fee, and a separate 'Collected this month' sums the real payments", async () => {
    await setLs(page, "paymentTransactions", {
      aisha: [{ id: "t1", amount: 450000, date: "2026-08-31", method: "cash" }, { id: "t2", amount: 450000, date: "2026-09-04", method: "card" }],
      "aisha-friend-2": [{ id: "t3", amount: 120000, date: "2026-09-02", method: "cash" }],
    });
    await page.reload(); await page.waitForTimeout(400);
    await page.getByRole("button", { name: /Administrator/ }).click(); await page.waitForTimeout(300);
    const n = (await ls(page, "students")).length;
    need(await money("Expected monthly revenue") === n * 450000, `expected ${n * 450000}`);
    need(await money("Collected this month") === 570000, "collected should be 450,000 + 120,000 (31 Aug is last month): " + await money("Collected this month"));
  }, errors);

  await step("it is the CALENDAR month: on 2 Oct nothing recorded in September counts; a payment recorded then does", async () => {
    await setNow(page, "2026-10-02T10:00:00+05:00");
    need(await money("Collected this month") === 0, "September's payments are still counted in October");
    const tx = await ls(page, "paymentTransactions");
    tx.aisha.push({ id: "t4", amount: 450000, date: "2026-10-02", method: "cash" });
    await setLs(page, "paymentTransactions", tx);
    await page.reload(); await page.waitForTimeout(400);
    await setNow(page, "2026-10-02T10:00:00+05:00");
    need(await money("Collected this month") === 450000, "an October payment should count: " + await money("Collected this month"));
  }, errors);
  console.log("ERRORS:", errors); await browser.close();
}

// =============================================================== 5. "Mark all as read" and quiet hours
{
  const { browser, page, errors } = await launch({ width: 460, height: 950 });
  await page.goto(BASE);
  const bellDot = () => page.locator("[aria-label=notifications] span").count();
  await step("setup: all-day quiet hours; Aisha has a late mark (attendance — always delivered) and a new grade (held back by quiet hours)", async () => {
    await seedGrades(page, [{ groupId: "g-math-7a", subject: "Mathematics", title: "Quiz", date: TODAY, maxScore: 20, scores: { aisha: 18 } }], { replace: true });
    await setLs(page, "attendanceRecords", { "g-math-7a": { "2026-09-07": { aisha: { status: "L", lateBy: 7 } } } });
    await setLs(page, "quietHours", { enabled: true, start: "00:00", end: "23:59" });
    await page.reload(); await page.waitForTimeout(400);
    await registerParent(page);
    need(await bellDot() > 0, "the late mark should light the bell even in quiet hours");
  }, errors);

  await step("'Mark all as read' marks only what is shown: the late notice is read, the grade held back by quiet hours is NOT", async () => {
    await page.locator("[aria-label=notifications]").click(); await page.waitForTimeout(300);
    await page.getByText(EN.markAllRead, { exact: true }).click(); await page.waitForTimeout(300);
    const read = await ls(page, "readNotifIds") || [];
    need(read.includes("late-aisha-2026-09-07"), "the visible late notice was not marked read: " + JSON.stringify(read));
    need(!read.some(id => id.startsWith("grade-")), "a notification the person could not see was marked read: " + JSON.stringify(read));
    need(await bellDot() === 0, "nothing visible is unread now, so the bell should be quiet");
  }, errors);

  await step("when quiet hours end, the held-back grade is there, still unread (the bell lights again)", async () => {
    await setLs(page, "quietHours", { enabled: false, start: "22:00", end: "07:00" });
    await page.reload(); await page.waitForTimeout(500);
    need(await bellDot() > 0, "the grade notification should be unread once quiet hours are over");
  }, errors);
  console.log("ERRORS:", errors); await browser.close();
}

report();
