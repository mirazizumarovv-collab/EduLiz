// Browser-level checks (the rules themselves are unit-tested in 42):
//   1. Teacher: attendance (empty date, late minutes, a sheet changed in another
//      tab) and homework (duplicate, order)
//   2. Admin: the group form refuses a missing subject / unreadable schedule
//   3. Parent: siblings given the same homework keep separate notification state,
//      and a deleted notification can be undone
//   4. A student moved to another group keeps their attendance and homework
//   5. The Dashboard's "Latest result" is the newest assessment, whichever subject it is
//   6. Admin: a payment is recorded once — a late second tap on "Mark as paid" is refused
import { launch, step, report, visibleText, setNow, EN, BASE, seedGrades } from "./lib.mjs";

const need = (cond, msg) => { if (!cond) throw new Error(msg); };
const eventually = async (check, timeout = 4000) => {
  const end = Date.now() + timeout; let last;
  for (;;) {
    try { await check(); return; } catch (e) { last = e; }
    if (Date.now() > end) throw last;
    await new Promise(r => setTimeout(r, 150));
  }
};
const ls = (page, k) => page.evaluate((key) => JSON.parse(localStorage.getItem("parentApp:" + key) || "null"), k);
const setLs = (page, k, v) => page.evaluate(([key, val]) => localStorage.setItem("parentApp:" + key, JSON.stringify(val)), [k, v]);
const text = (page) => visibleText(page);
const alertText = async (page) => { const a = page.getByRole("alert"); await a.waitFor({ timeout: 3000 }); return (await a.innerText()).trim(); };
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
const TODAY = "2026-09-08";

// =============================================================== 1. Teacher forms
{
  const { browser, ctx, page, errors } = await launch({ width: 1100, height: 1000 });
  await page.goto(BASE);
  const nums = () => page.locator("input[type=number]");
  const save = () => page.getByRole("button", { name: EN.saveAttendance }).click();
  const mark = (label) => page.getByRole("button", { name: label, exact: true }).click();
  const sheet = async () => ((await ls(page, "attendanceRecords")) || {})["g-math-7a"]?.[TODAY]?.aisha;

  await step("setup: Teacher on Attendance, Mathematics 7A (one student: Aisha)", async () => {
    await asTeacher(page); await goTo(page, EN.navAttendance);
    await page.locator("select").first().selectOption({ label: "Mathematics 7A" });
    await mark(EN.present);
  }, errors);

  await step("an EMPTY date is refused with a message — nothing is stored under \"\"", async () => {
    await page.locator("input[type=date]").fill("");
    await save();
    need(await alertText(page) === EN.errorDateInvalid, "wrong message: " + await alertText(page));
    const att = (await ls(page, "attendanceRecords")) || {};
    need(!Object.values(att).some(byDate => "" in byDate), "a record was stored under the empty date: " + JSON.stringify(att));
    await page.locator("input[type=date]").fill(TODAY);
  }, errors);

  await step("minutes late: 0, blank and negative are refused (and 0 is not secretly shown as 5); 12 saves as 12, stamped with the lesson", async () => {
    await mark(EN.late);
    need((await nums().inputValue()) === "5", "the default should be 5");
    await nums().fill("0");
    need((await nums().inputValue()) === "0", "0 must stay 0 on screen, not turn into 5");
    for (const bad of ["0", "", "-5"]) {
      await nums().fill(bad); await save();
      const msg = await alertText(page);
      need(msg.includes("Aisha") && msg.includes("from 1 to 240"), `"${bad}" → unexpected message: ${msg}`);
      need(!(await sheet()), `"${bad}" was saved`);
    }
    await nums().fill("12"); await save();
    await page.getByText(EN.attendanceSaved).waitFor({ timeout: 3000 });
    const s = await sheet();
    need(s && s.status === "L" && s.lateBy === 12, "expected L / 12: " + JSON.stringify(s));
    need(s.lesson && s.lesson.subject === "Mathematics" && s.lesson.teacher === "Malika Yusupova" && s.lesson.time === "15:00", "lesson not stamped: " + JSON.stringify(s.lesson));
  }, errors);

  // ---- a sheet changed in another tab while this one is open
  const page2 = await ctx.newPage();
  await page2.goto(BASE);
  await page2.waitForTimeout(400);
  await goTo(page2, EN.navAttendance);
  await page2.locator("select").first().selectOption({ label: "Mathematics 7A" });
  const markIn = (p, label) => p.getByRole("button", { name: label, exact: true }).click();
  const saveIn = async (p) => { await p.getByRole("button", { name: EN.saveAttendance }).click(); await p.getByText(EN.attendanceSaved).waitFor({ timeout: 3000 }); };

  await step("another tab changes the sheet while this form has NO edits → this form simply shows the new sheet", async () => {
    await markIn(page2, EN.absent); await saveIn(page2);                     // stored: Absent
    await eventually(async () => need((await nums().count()) === 0, "the form still shows the old 'late' state"));  // 'late' (12 min) is gone
    need((await page.locator("[data-conflict]").count()) === 0, "no conflict banner expected when nothing was edited");
  }, errors);

  await step("…but with UNSAVED edits here, a Save is refused and the choice is offered: nothing is overwritten", async () => {
    await mark(EN.present);                                                    // unsaved edit in this tab
    await markIn(page2, EN.late); await saveIn(page2);                         // the other tab stores Late (5)
    await eventually(async () => need((await page.locator("[data-conflict]").count()) === 1, "the conflict banner did not appear"));
    await save();
    need(await alertText(page) === EN.attendanceChangedElsewhere, "Save should have been refused with the 'changed elsewhere' message");
    const s = await sheet();
    need(s.status === "L" && s.lateBy === 5, "the other tab's sheet was overwritten: " + JSON.stringify(s));
  }, errors);

  await step("'Load latest' drops my edits and shows the other tab's sheet", async () => {
    await page.getByRole("button", { name: EN.loadLatest }).click();
    need((await page.locator("[data-conflict]").count()) === 0, "banner still showing");
    need((await nums().inputValue()) === "5", "the latest sheet (late, 5) should be showing");
  }, errors);

  await step("'Keep my changes' lets me overwrite on purpose: the next Save wins", async () => {
    await mark(EN.present);                                                    // edit again
    await markIn(page2, EN.absent); await saveIn(page2);                       // other tab stores Absent again
    await eventually(async () => need((await page.locator("[data-conflict]").count()) === 1, "banner did not appear"));
    await page.getByRole("button", { name: EN.keepMine }).click();
    need((await page.locator("[data-conflict]").count()) === 0, "banner still showing");
    await save(); await page.getByText(EN.attendanceSaved).waitFor({ timeout: 3000 });
    need((await sheet()).status === "P", "my deliberate Save should have stored Present: " + JSON.stringify(await sheet()));
  }, errors);
  await page2.close();

  // ---- homework
  await step("Homework: the same title due the same day is refused (not saved twice); a different day is fine", async () => {
    await goTo(page, EN.navHomework);
    const title = page.getByPlaceholder("e.g. Worksheet 5, problems 1");
    const add = () => page.getByRole("button", { name: EN.assignHomework }).first().click();
    await page.locator("input[type=date]").fill("2026-09-20");
    await title.fill("Far Away"); await add();
    await page.locator("input[type=date]").fill("2026-09-10");
    await title.fill("Worksheet"); await add();
    await title.fill("  worksheet "); await add();                                  // same title (case/spaces), same day
    need(await alertText(page) === EN.errorHomeworkDuplicate.replace("{title}", "worksheet"), "wrong message: " + await alertText(page));
    need(((await ls(page, "homeworkRecords"))["g-math-7a"] || []).filter(h => h.title.toLowerCase() === "worksheet").length === 1, "the duplicate was saved");
    await page.locator("input[type=date]").fill("2026-09-11");
    await title.fill("Worksheet"); await add();                                    // another day: allowed
    need(((await ls(page, "homeworkRecords"))["g-math-7a"] || []).filter(h => h.title === "Worksheet").length === 2, "a different day should be allowed");
  }, errors);

  await step("Homework: the Teacher's list is ordered like the Parent's — coming up soonest first, then past most-recent first", async () => {
    const records = await ls(page, "homeworkRecords");
    records["g-math-7a"].push({ id: "hw-past", title: "Long Ago", dueDate: "2026-09-01", createdDate: "2026-08-25" });
    await setLs(page, "homeworkRecords", records);
    await page.reload(); await page.waitForTimeout(500);
    await goTo(page, EN.navHomework);
    const t = await text(page);
    const pos = (s) => t.indexOf(s);
    need(pos("Worksheet") > -1 && pos("Far Away") > -1 && pos("Long Ago") > -1, "items missing: " + t.slice(0, 300));
    need(pos("Worksheet") < pos("Far Away") && pos("Far Away") < pos("Long Ago"), `expected soonest-due first then the past: Worksheet@${pos("Worksheet")} Far Away@${pos("Far Away")} Long Ago@${pos("Long Ago")}`);
  }, errors);
  await browser.close();
}

// =============================================================== 2. Admin: group form
{
  const { browser, page, errors } = await launch({ width: 1100, height: 1000 });
  await page.goto(BASE);
  const groups = async () => await ls(page, "groups");
  await step("Admin: a group needs a subject and a readable schedule — each refusal says which", async () => {
    await page.getByRole("button", { name: /Administrator/ }).click(); await page.waitForTimeout(250);
    await goTo(page, EN.navAllGroups);
    const before = (await groups()).length;
    await page.getByRole("button", { name: EN.addGroup }).first().click();
    const name = page.getByPlaceholder(EN.groupName), subject = page.getByPlaceholder(EN.subject), schedule = page.getByPlaceholder(EN.schedulePlaceholder);
    const submit = () => page.getByRole("button", { name: EN.save, exact: true }).first().click();
    await submit();                                                  need(await alertText(page) === EN.errorGroupName, "empty form → " + await alertText(page));
    await name.fill("Physics 9"); await submit();                    need(await alertText(page) === EN.errorGroupSubject, "no subject → " + await alertText(page));
    await subject.fill("Physics"); await submit();                   need(await alertText(page) === EN.errorGroupSchedule, "no schedule → " + await alertText(page));
    await schedule.fill("Mon/Wed/Fri"); await submit();              need(await alertText(page) === EN.errorGroupSchedule, "days but no time → " + await alertText(page));
    await schedule.fill("15:00-16:00"); await submit();              need(await alertText(page) === EN.errorGroupSchedule, "a time but no days → " + await alertText(page));
    need((await groups()).length === before, "a group was created despite the refusals");
    // typed loosely, saved in the one canonical form the rest of the app reads
    await schedule.fill("Monday, Wednesday 15:00-16:30"); await submit(); await page.waitForTimeout(300);
    const created = (await groups()).find(g => g.name === "Physics 9");
    need(created && created.subject === "Physics" && created.schedule === "Mon/Wed 15:00-16:30", "valid group not created (or not saved canonically): " + JSON.stringify(created));
  }, errors);

  await step("Admin: editing a group's schedule into nonsense is refused and the group is left as it was", async () => {
    const card = page.locator("div", { hasText: "Physics 9" }).filter({ has: page.getByLabel(EN.edit) }).last();
    await card.getByLabel(EN.edit).click();
    await page.locator("input[value='Mon/Wed 15:00-16:30']").fill("whenever");
    await page.getByRole("button", { name: EN.save, exact: true }).first().click();
    need(await alertText(page) === EN.errorGroupSchedule, "wrong message: " + await alertText(page));
    need((await groups()).find(g => g.name === "Physics 9").schedule === "Mon/Wed 15:00-16:30", "the bad schedule was saved");
  }, errors);
  await browser.close();
}

// ================================================ 3. Parent: siblings + undo delete
{
  const { browser, page, errors } = await launch({ width: 460, height: 950 });
  await page.goto(BASE);
  const homeworkRow = () => page.locator("div", { has: page.getByText("Shared HW") }).filter({ has: page.getByText(EN.markRead, { exact: true }) }).last();

  await step("setup: Aisha and Umar in the SAME group, both given 'Shared HW' (now overdue)", async () => {
    const students = await ls(page, "students"); students.find(s => s.id === "umar").groupId = "g-math-7a"; await setLs(page, "students", students);
    const groups = await ls(page, "groups");
    groups.find(g => g.id === "g-math-7a").studentIds.push("umar");
    groups.find(g => g.id === "g-math-4a").studentIds = groups.find(g => g.id === "g-math-4a").studentIds.filter(id => id !== "umar");
    await setLs(page, "groups", groups);
    await setLs(page, "homeworkRecords", { "g-math-7a": [{ id: "hw-shared", title: "Shared HW", dueDate: "2026-09-05", createdDate: "2026-09-01" }] });
    await page.reload(); await page.waitForTimeout(400);
    await registerParent(page);
    await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200);
    await page.getByText(EN.navNotifications, { exact: true }).first().click(); await page.waitForTimeout(500);
    need((await text(page)).includes("Shared HW"), "Aisha should see the overdue reminder: " + (await text(page)).slice(0, 300));
  }, errors);

  await step("reading Aisha's reminder does NOT mark Umar's as read", async () => {
    await homeworkRow().getByText(EN.markRead, { exact: true }).click(); await page.waitForTimeout(300);
    const read = await ls(page, "readNotifIds");
    need(read.includes("hw-aisha-hw-shared") && !read.includes("hw-umar-hw-shared"), "read ids: " + JSON.stringify(read));
    // the child switcher lives on the top-level screens, so go Home, switch, and come back
    await page.getByText(EN.navDashboard, { exact: true }).last().click(); await page.waitForTimeout(300);
    await page.getByText("▾").first().click(); await page.getByText("Umar").first().click(); await page.waitForTimeout(400);
    await page.getByText(EN.navMore, { exact: true }).last().click(); await page.waitForTimeout(200);
    await page.getByText(EN.navNotifications, { exact: true }).first().click(); await page.waitForTimeout(500);
    need((await homeworkRow().count()) === 1, "Umar's reminder should still be UNREAD (its own 'Mark read' button)");
  }, errors);

  await step("deleting Umar's reminder shows 'Notification deleted' with Undo; Aisha's is untouched; Undo brings it back", async () => {
    await homeworkRow().getByLabel(EN.deleteNotificationAria).click(); await page.waitForTimeout(300);
    need((await text(page)).includes(EN.notificationDeleted), "no 'deleted' message");
    need(!(await text(page)).includes("Shared HW"), "the reminder should be gone from Umar's list");
    const deleted = await ls(page, "deletedNotifIds");
    need(JSON.stringify(deleted) === JSON.stringify(["hw-umar-hw-shared"]), "deleted ids: " + JSON.stringify(deleted));
    await page.getByRole("button", { name: EN.undo }).click(); await page.waitForTimeout(300);
    need((await text(page)).includes("Shared HW"), "Undo did not bring the reminder back");
    need(((await ls(page, "deletedNotifIds")) || []).length === 0, "the deleted mark should be cleared");
    need(!(await text(page)).includes(EN.notificationDeleted) || (await page.getByRole("button", { name: EN.undo }).count()) === 0, "the Undo toast should go away once used");
  }, errors);
  await browser.close();
}

// ================================================= 4. a move keeps the student's history
{
  const { browser, page, errors } = await launch({ width: 1100, height: 1000 });
  await page.goto(BASE);

  await step("setup: Aisha has attendance and homework from Mathematics 7A (3 Sep / given 5 Sep)", async () => {
    await setLs(page, "attendanceRecords", { "g-math-7a": { "2026-09-03": { aisha: { status: "P" } } } });
    await setLs(page, "homeworkRecords", { "g-math-7a": [{ id: "hw-before", title: "Before Move", dueDate: "2026-09-20", createdDate: "2026-09-05" }] });
    await page.reload(); await page.waitForTimeout(400);
  }, errors);

  await step("Admin moves Aisha from Mathematics 7A to Mathematics 4A (on 8 Sep); the move is recorded in her history", async () => {
    await page.getByRole("button", { name: /Administrator/ }).click(); await page.waitForTimeout(250);
    await goTo(page, EN.navStudents);
    const row = page.locator("div", { hasText: "Aisha" }).filter({ has: page.getByLabel(EN.edit) }).last();
    await row.getByLabel(EN.edit).click();
    await page.locator("select").last().selectOption({ label: "Mathematics 4A" });
    await page.getByRole("button", { name: EN.save, exact: true }).click(); await page.waitForTimeout(300);
    const aisha = (await ls(page, "students")).find(s => s.id === "aisha");
    need(aisha.groupId === "g-math-4a", "move did not apply");
    need(JSON.stringify(aisha.groupHistory) === JSON.stringify([{ groupId: "g-math-7a", from: null, to: "2026-09-07" }, { groupId: "g-math-4a", from: TODAY, to: null }]), "history: " + JSON.stringify(aisha.groupHistory));
  }, errors);

  await step("two days later the old group is given NEW homework (after Aisha left it)", async () => {
    await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
    await setNow(page, "2026-09-10T10:00:00+05:00");
    await asTeacher(page); await goTo(page, EN.navHomework);
    await page.locator("select").first().selectOption({ label: "Mathematics 7A" });
    await page.locator("input[type=date]").fill("2026-09-25");
    await page.getByPlaceholder("e.g. Worksheet 5, problems 1").fill("After Move");
    await page.getByRole("button", { name: EN.assignHomework }).first().click(); await page.waitForTimeout(300);
    need(((await ls(page, "homeworkRecords"))["g-math-7a"] || []).some(h => h.title === "After Move" && h.createdDate === "2026-09-10"), "setup homework not created");
  }, errors);

  await step("the Parent still sees Aisha's attendance and homework from the OLD group — but not the work given after she left it", async () => {
    await page.getByRole("button", { name: EN.logout }).click(); await page.waitForTimeout(200);
    await registerParent(page);
    await goTo(page, EN.navHomework); await page.waitForTimeout(300);
    let t = await text(page);
    need(t.includes("Before Move"), "homework from her old group is gone: " + t.slice(0, 300));
    need(!t.includes("After Move"), "homework given to the old group AFTER she left is showing: " + t.slice(0, 300));
    await goTo(page, EN.navAttendance); await page.waitForTimeout(300);
    t = await text(page);
    need(t.includes("100%") && !t.includes(EN.noAttendanceData), "her attendance from the old group is gone: " + t.slice(0, 300));
  }, errors);
  await browser.close();
}

// ============================================== 5. Dashboard "Latest result"
{
  const { browser, page, errors } = await launch({ width: 460, height: 950 });
  await page.goto(BASE);
  await step("Dashboard 'Latest result' is the NEWEST assessment (English, 5 Sep) — not the subject assessed first (Mathematics, 1 Sep)", async () => {
    await seedGrades(page, [
      { groupId: "g-math-7a", subject: "Mathematics", title: "Maths quiz", date: "2026-09-01", maxScore: 100, scores: { aisha: 80 } },
      { groupId: "g-math-7a", subject: "English", title: "English quiz", date: "2026-09-05", maxScore: 100, scores: { aisha: 90 } },
    ], { replace: true });
    await page.reload(); await page.waitForTimeout(400);
    await registerParent(page);
    await page.waitForTimeout(500);
    const t = await text(page);
    const at = t.indexOf(EN.latestResult);
    need(at > -1, "no 'Latest result' row: " + t.slice(0, 300));
    const row = t.slice(at, at + 60);
    need(row.includes("90%") && row.includes("English") && !row.includes("80%"), "expected English 90% as the latest result, row says: " + row);
    need(t.includes(EN.activityNewGrade.replace("{subject}", "English").replace("{score}", "90")), "'Recent activity' should name the same newest grade: " + t.slice(0, 500));
  }, errors);
  await browser.close();
}

// ================================================= 6. Admin: one payment, not two
{
  const { browser, page, errors } = await launch({ width: 1100, height: 1000 });
  await page.goto(BASE);
  const totalTx = async () => Object.values((await ls(page, "paymentTransactions")) || {}).reduce((n, list) => n + list.length, 0);
  await step("Admin: 'Mark as paid' records ONE transaction; a late second tap (the button is already gone) is refused with a message", async () => {
    await page.getByRole("button", { name: /Administrator/ }).click(); await page.waitForTimeout(250);
    await goTo(page, EN.navPayments);
    const button = page.getByRole("button", { name: EN.markAsPaid }).first();
    // Keep hold of THIS button's click handler now (React strips it from a button once it is removed).
    await (await button.elementHandle()).evaluate((el) => { const key = Object.keys(el).find(k => k.startsWith("__reactProps")); window.__lateTap = el[key].onClick; });
    const before = await totalTx();
    await button.click(); await page.waitForTimeout(300);
    need((await totalTx()) === before + 1, "the first tap should record one payment");
    // The first tap re-rendered the screen and the button no longer exists, so a real second tap
    // can't happen — but a tap already in flight, or a stale screen, can still reach the handler.
    await page.evaluate(() => window.__lateTap());
    await page.getByText(EN.errorPaymentAlreadyPaid).first().waitFor({ timeout: 3000 });
    need((await totalTx()) === before + 1, "a second transaction was written for the same payment");
  }, errors);

  await step("…and two taps that reach the handler BEFORE the screen has re-rendered still record only one payment", async () => {
    const button = page.getByRole("button", { name: EN.markAsPaid }).first();     // the next unpaid student
    await (await button.elementHandle()).evaluate((el) => { const key = Object.keys(el).find(k => k.startsWith("__reactProps")); window.__rapidTap = el[key].onClick; });
    const before = await totalTx();
    // Both calls happen in ONE synchronous task: React cannot render in between, so the
    // second one sees whatever the first left behind — which must already say "paid".
    await page.evaluate(() => { window.__rapidTap(); window.__rapidTap(); });
    await page.waitForTimeout(300);
    need((await totalTx()) === before + 1, `two taps wrote ${(await totalTx()) - before} payments, expected 1`);
  }, errors);
  await browser.close();
}

report();
