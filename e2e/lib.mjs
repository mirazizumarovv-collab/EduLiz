// Shared helpers for the browser end-to-end checks.
// Needs Playwright:  npm i --no-save playwright && npx playwright install chromium
// (--no-save keeps it out of package.json so Vercel never installs it.)
import path from "path";
import { fileURLToPath } from "url";

let chromium;
try { ({ chromium } = await import("playwright")); }
catch {
  if (!process.env.PLAYWRIGHT_NODE_PATH) throw new Error("Playwright not found. Run: npm i --no-save playwright");
  const { createRequire } = await import("module");
  chromium = createRequire(process.env.PLAYWRIGHT_NODE_PATH.replace(/\/?$/, "/"))("playwright").chromium;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BASE = process.env.BASE_URL || "http://localhost:5174/";
export const STATE = path.join(HERE, ".state-after-setup.json");
import { dictionaries } from "../src/i18n/index.js";
export const EN = dictionaries.en;
export { dictionaries };
export const results = [];

import { installFixedDate, DEFAULT_TEST_NOW } from "./fakeClock.mjs";
export { DEFAULT_TEST_NOW };

// Move the page's pinned clock to another instant, as if time had passed, and
// wake the app the way a real tab wakes (a focus event) so it re-reads the clock.
export async function setNow(page, isoInstant) {
  await page.evaluate((iso) => {
    window.__fakeNowMs = new window.__RealDate(iso).getTime();
    window.dispatchEvent(new Event("focus"));
  }, isoInstant);
  await page.waitForTimeout(250);
}

// ---- Grades --------------------------------------------------------------
// The app stores grades as Assessments + Grade rows keyed by assessmentId
// (src/utils/gradeModel.js), persisted under "parentApp:gradeStore". These
// helpers let a test put grades in, or read them back, without hand-writing
// that shape each time. Like every localStorage edit, a seed only takes
// effect once the page is reloaded.
import { deriveGradesRecords, createId } from "../src/utils/gradeModel.js";

export async function readGradeStore(page) {
  const raw = await page.evaluate(() => localStorage.getItem("parentApp:gradeStore"));
  const parsed = raw ? JSON.parse(raw) : null;
  return parsed && Array.isArray(parsed.assessments) ? parsed : { assessments: [], grades: [] };
}

// The per-student view (what the screens read): { [studentId]: [entry...] },
// each entry { id, assessmentId, groupId, subject, title, score, maxScore, date }.
export async function readGradesRecords(page) {
  return deriveGradesRecords(await readGradeStore(page));
}

// tests: [{ id?, groupId, subject, title, date, maxScore, scores: { studentId: score } }]
// Appends to what is already stored, or replaces it with { replace: true }.
export async function seedGrades(page, tests, { replace = false } = {}) {
  const store = replace ? { assessments: [], grades: [] } : await readGradeStore(page);
  for (const t of tests) {
    const id = t.id || createId("as");
    store.assessments.push({ id, groupId: t.groupId, subject: t.subject, title: t.title, date: t.date, maxScore: t.maxScore });
    for (const [studentId, score] of Object.entries(t.scores)) store.grades.push({ assessmentId: id, studentId, score });
  }
  await page.evaluate((v) => localStorage.setItem("parentApp:gradeStore", JSON.stringify(v)), store);
  return store;
}

// `now` pins the page's clock (see fakeClock.mjs). The app reads the REAL clock,
// so every browser test starts from the same chosen moment — 8 Sep 2026, 14:30
// in Tashkent unless a test asks for another — and results are reproducible.
export async function launch(viewport = { width: 420, height: 900 }, storageState, { now = DEFAULT_TEST_NOW } = {}) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext(storageState ? { viewport, storageState } : { viewport });
  await ctx.addInitScript(installFixedDate, now);
  // English UI so the text selectors are stable (the app defaults to Uzbek).
  await ctx.addInitScript(() => { if (!localStorage.getItem("parentApp:lang")) localStorage.setItem("parentApp:lang", JSON.stringify("en")); });
  const page = await ctx.newPage();
  page.setDefaultTimeout(4000);
  const errors = [];
  page.on("pageerror", e => errors.push("PAGEERROR: " + e.message));
  page.on("response", r => { if (r.status() >= 400 && !/favicon|fonts\.googleapis/.test(r.url())) errors.push("HTTP " + r.status() + " " + r.url()); });
  page.on("console", m => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push("CONSOLE: " + m.text().slice(0, 300)); });
  return { browser, ctx, page, errors };
}

export async function step(name, fn, errors) {
  const before = errors.length;
  try {
    await fn();
    const newErr = errors.slice(before);
    const r = { name, ok: newErr.length === 0, note: newErr.join(" | ") };
    results.push(r); console.log((r.ok ? "PASS " : "FAIL ") + name + (r.note ? "  -> " + r.note : ""));
  } catch (e) {
    const r = { name, ok: false, note: String(e.message).split("\n")[0].slice(0, 300) };
    results.push(r); console.log("FAIL " + name + "  -> " + r.note);
  }
}
export const report = () => {
  const passed = results.filter(r => r.ok).length;
  console.log(`\n${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
};
export async function visibleText(page) { return (await page.evaluate(() => document.body.innerText)).replace(/\n+/g, " | "); }
