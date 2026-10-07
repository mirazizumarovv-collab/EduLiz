// Plain unit check (no browser) for the real crash risk: exportChildDataToExcel
// (and the computeParentAnalytics it calls) used to throw for a student with
// zero recorded grades — grades[0].monthly, and later reduce()s with no
// initial value, both assume a non-empty array. Not currently reachable from
// any UI button (this export isn't wired up yet), but worth being safe for
// when it is.
//
// exportExcel.js resolves the bare "xlsx" specifier relative to its OWN
// location (src/parent-app/utils/), so a stub for it has to live under this
// project's real node_modules/ for Node to find it — there's no portable way
// to redirect that resolution from elsewhere. If a real `xlsx` install is
// already there (npm install has been run), this test leaves it alone and
// uses it as-is, checking only that a real file gets written. If it's not
// there, this test creates a minimal temporary stub, runs, and removes
// exactly what it created (the single xlsx/ folder, and node_modules/
// itself only if this test was the one that created it) — it never touches
// or removes anything that was already present.
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, rmSync, rmdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const NM = path.join(ROOT, "node_modules");
const XLSX_DIR = path.join(NM, "xlsx");

const nmPreexisted = existsSync(NM);
const xlsxPreexisted = existsSync(XLSX_DIR);

function findTsx() {
  const candidates = [path.join(NM, ".bin", "tsx"), process.env.TSX_BIN].filter(Boolean);
  return candidates.find(c => spawnSync(c, ["--version"]).status === 0);
}

// Removes exactly what this test created. Called from `finally` AND before the
// early process.exit below — process.exit skips `finally`, and a left-behind
// stub would make the next run think a real xlsx was installed.
function cleanup() {
  if (!xlsxPreexisted) rmSync(XLSX_DIR, { recursive: true, force: true });
  if (!nmPreexisted && existsSync(NM)) {
    try { rmdirSync(NM); } catch {} // only removes if now empty; leaves it alone otherwise
  }
}

try {
  if (!xlsxPreexisted) {
    mkdirSync(XLSX_DIR, { recursive: true });
    writeFileSync(path.join(XLSX_DIR, "package.json"),
      JSON.stringify({ name: "xlsx", version: "0.0.0", main: "index.mjs", type: "module" }));
    writeFileSync(path.join(XLSX_DIR, "index.mjs"), `
export const utils = {
  book_new: () => ({ SheetNames: [], Sheets: {} }),
  aoa_to_sheet: (aoa) => ({ __aoa: aoa }),
  book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
  encode_range: () => "A1:A1",
};
export let lastWrittenWorkbook = null;
export const writeFile = (wb) => { lastWrittenWorkbook = wb; };
`.trim());
  }

  const tsxBin = findTsx();
  if (!tsxBin) {
    console.log("FAIL — tsx not found (run `npm install`, or set TSX_BIN to a global tsx binary)");
    cleanup();
    process.exit(1);
  }

  const testScriptPath = path.join(HERE, "_tmp_export_test_runner.mjs");
  const usingRealXlsx = xlsxPreexisted;
  const testScript = `
import { updateBridge } from ${JSON.stringify(path.join(ROOT, "src/parent-app/data/liveBridge.js"))};
import { exportChildDataToExcel } from ${JSON.stringify(path.join(ROOT, "src/parent-app/utils/exportExcel.js"))};
${usingRealXlsx ? "" : 'import * as XLSX from "xlsx";'}

const groups = [{ id: "g1", subject: "Mathematics", teacherId: "t1", studentIds: ["s1"] }];
const student = { id: "s1", name: "No Grades Kid", grade: "Grade 5", groupId: "g1", group: "Mathematics 5A", guardians: [{ id: "gp1", name: "Parent", phone: "+998901112233", role: "Guardian" }], connectionCode: "REG-0001" };
const attendanceRecords = { g1: { "2026-09-01": { s1: { status: "P" } } } };
const homeworkRecords = { g1: [{ id: "h1", title: "HW1", dueDate: "2026-09-20", createdDate: "2026-09-01" }] };

updateBridge({
  students: [student], groups, teachers: [{ id: "t1", name: "Teacher", subject: "Mathematics" }],
  attendanceRecords, gradesRecords: {}, homeworkRecords, homeworkSubmissions: {},
  paymentsStatus: { s1: "pending" }, paymentTransactions: {}, messageThreads: {},
  currentDateStr: "2026-09-08", selectedStudentId: "s1",
});

try {
  exportChildDataToExcel(student);
  ${usingRealXlsx ? `
  const outFile = "No_Grades_Kid_hisobot.xlsx";
  const fs = await import("fs");
  if (!fs.existsSync(outFile)) { console.log("FAIL — no output file written"); process.exit(1); }
  fs.unlinkSync(outFile);
  console.log("PASS — exportChildDataToExcel handles a zero-grade student without crashing (real xlsx library, real file written)");
  ` : `
  const wb = XLSX.lastWrittenWorkbook;
  const expectedSheets = ["Umumiy", "Fanlar", "Davomat", "Baholar", "Uy vazifasi", "To'lov"];
  const missing = expectedSheets.filter(s => !wb.SheetNames.includes(s));
  if (missing.length) { console.log("FAIL — missing sheets:", missing); process.exit(1); }
  const body = JSON.stringify(wb.Sheets["Umumiy"].__aoa);
  if (/undefined|NaN/.test(body)) { console.log("FAIL — Umumiy sheet has undefined/NaN:", body); process.exit(1); }
  console.log("PASS — exportChildDataToExcel handles a zero-grade student without crashing, with a graceful Umumiy sheet");
  `}
} catch (e) {
  console.log("FAIL — exportChildDataToExcel crashed:", e.message);
  process.exit(1);
}
`;
  writeFileSync(testScriptPath, testScript);
  var result = spawnSync(tsxBin, [testScriptPath], { stdio: "inherit", cwd: HERE });
  rmSync(testScriptPath, { force: true });
} finally {
  cleanup();
}
process.exit(result && result.status === 0 ? 0 : 1);
