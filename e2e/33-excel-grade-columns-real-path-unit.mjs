// Plain unit check (no browser) for Excel's grade sheet: the month HEADERS
// must line up with the score CELLS beneath them.
//
// getGrades() trims every subject's `monthly` series to start at the earliest
// month where ANY subject has a real assessment (a child first graded in May
// is reported "from May", not "from March"). The Excel sheet used to build its
// header from the full fixed Mar–Sep list while the cells came from that
// trimmed series, so every score sat under the wrong month (May's 80% under
// "Mart").
//
// This drives the REAL path — bridge data -> getGrades() (with its trimming)
// -> exportChildDataToExcel — rather than hand-built subjects, because a
// hand-built full-length subject (which an earlier version of this check
// used) bypasses the trimming and cannot show the bug.
//
// It runs in a throwaway copy of src/ with a minimal `xlsx` stub that records
// the workbook, so it works with or without `npm install` and never touches
// this project's own node_modules.
import { spawnSync } from "child_process";
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const sandbox = mkdtempSync(path.join(tmpdir(), "excel-cols-"));
let status = 1;

try {
  cpSync(path.join(ROOT, "src"), path.join(sandbox, "src"), { recursive: true });
  writeFileSync(path.join(sandbox, "package.json"), JSON.stringify({ type: "module" }));
  mkdirSync(path.join(sandbox, "node_modules", "xlsx"), { recursive: true });
  writeFileSync(path.join(sandbox, "node_modules", "xlsx", "package.json"),
    JSON.stringify({ name: "xlsx", version: "0.0.0", main: "index.mjs", type: "module" }));
  writeFileSync(path.join(sandbox, "node_modules", "xlsx", "index.mjs"), `
export const utils = {
  book_new: () => ({ SheetNames: [], Sheets: {} }),
  aoa_to_sheet: (aoa) => ({ __aoa: aoa }),
  book_append_sheet: (wb, ws, name) => { wb.SheetNames.push(name); wb.Sheets[name] = ws; },
  encode_range: () => "A1:A1",
};
export let lastWrittenWorkbook = null;
export const writeFile = (wb) => { lastWrittenWorkbook = wb; };
`.trim());

  writeFileSync(path.join(sandbox, "run.mjs"), `
import { updateBridge } from "./src/parent-app/data/liveBridge.js";
import { exportChildDataToExcel } from "./src/parent-app/utils/exportExcel.js";
import { MONTH_NAMES } from "./src/parent-app/constants/months.js";
import * as XLSX from "xlsx";

const student = { id: "s1", name: "Col Test", grade: "Grade 7", groupId: "g1", group: "Mathematics 7A",
  guardians: [{ id: "gp1", name: "Parent", phone: "+998901112233", role: "Guardian" }], connectionCode: null };

// First real assessment is in MAY (Mathematics); English first graded in JULY.
const gradesRecords = { s1: [
  { id: "a", groupId: "g1", subject: "Mathematics", title: "May quiz", score: 16, maxScore: 20, date: "2026-05-08" },
  { id: "b", groupId: "g1", subject: "Mathematics", title: "Sep quiz", score: 18, maxScore: 20, date: "2026-09-05" },
  { id: "c", groupId: "g1", subject: "English",     title: "Jul quiz", score: 14, maxScore: 20, date: "2026-07-10" },
] };

updateBridge({
  students: [student], groups: [{ id: "g1", subject: "Mathematics", teacherId: "t1", studentIds: ["s1"] }],
  teachers: [{ id: "t1", name: "Teacher", subject: "Mathematics" }],
  attendanceRecords: {}, gradesRecords, homeworkRecords: {}, homeworkSubmissions: {},
  paymentsStatus: { s1: "paid" }, paymentTransactions: {}, messageThreads: {},
  currentDateStr: "2026-09-08", selectedStudentId: "s1",
});

exportChildDataToExcel(student);
const aoa = XLSX.lastWrittenWorkbook.Sheets["Baholar"].__aoa;
const headerIdx = aoa.findIndex(r => r[0] === "Fan");
const header = aoa[headerIdx];
const rows = aoa.slice(headerIdx + 1);
const dump = () => "\\n  header: " + JSON.stringify(header) + rows.map(r => "\\n  row:    " + JSON.stringify(r)).join("");

let ok = true;
const bad = (msg) => { ok = false; console.log("FAIL — " + msg + dump()); };

const expectedMonths = ["May", "Jun", "Jul", "Aug", "Sep"].map(m => MONTH_NAMES.uz[m]);
const monthHeader = header.slice(3);
if (JSON.stringify(monthHeader) !== JSON.stringify(expectedMonths))
  bad("month headers should start at the first real month (May) and be " + JSON.stringify(expectedMonths) + ", got " + JSON.stringify(monthHeader));

for (const r of rows)
  if (r.length !== header.length) bad("row for " + r[0] + " has " + r.length + " cells but the header has " + header.length + " columns — scores are shifted");

const cell = (subject, monthKey) => {
  const row = rows.find(r => r[0] === subject);
  const col = header.indexOf(MONTH_NAMES.uz[monthKey]);
  return col === -1 || !row ? "<no such column>" : row[col];
};
const expect = [
  ["Mathematics", "May", 80], ["Mathematics", "Jun", "—"], ["Mathematics", "Jul", "—"], ["Mathematics", "Sep", 90],
  ["English", "May", "—"], ["English", "Jul", 70], ["English", "Sep", "—"],
];
for (const [subject, m, want] of expect) {
  const got = cell(subject, m);
  if (got !== want) bad(subject + " under " + MONTH_NAMES.uz[m] + ": expected " + JSON.stringify(want) + ", got " + JSON.stringify(got));
}

// ---- the same export on 6 Oct 2026: the window is Apr–Oct, not Mar–Sep ----
updateBridge({
  students: [student], groups: [{ id: "g1", subject: "Mathematics", teacherId: "t1", studentIds: ["s1"] }],
  teachers: [{ id: "t1", name: "Teacher" }], attendanceRecords: {}, gradesRecords, homeworkRecords: {}, homeworkSubmissions: {},
  paymentsStatus: { s1: "paid" }, paymentTransactions: {}, messageThreads: {},
  currentDateStr: "2026-10-06", selectedStudentId: "s1",
});
exportChildDataToExcel(student);
const wb2 = XLSX.lastWrittenWorkbook;
const oct = wb2.Sheets["Baholar"].__aoa;
const octHeader = oct[oct.findIndex(r => r[0] === "Fan")];
const octExpected = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"].map(m => MONTH_NAMES.uz[m]);
if (JSON.stringify(octHeader.slice(3)) !== JSON.stringify(octExpected)) { ok = false; console.log("FAIL — on 6 Oct the grade columns should be " + JSON.stringify(octExpected) + ", got " + JSON.stringify(octHeader.slice(3))); }
const octMath = oct.find(r => r[0] === "Mathematics");
if (octMath.length !== octHeader.length || octMath[3] !== 80 || octMath[octMath.length - 1] !== "—") { ok = false; console.log("FAIL — on 6 Oct Mathematics row misaligned: " + JSON.stringify(octMath)); }
const title = wb2.Sheets["Davomat"].__aoa[0][0];
if (!title.includes(MONTH_NAMES.uz.Apr + "–" + MONTH_NAMES.uz.Oct)) { ok = false; console.log("FAIL — the attendance sheet title should name the months in view (Aprel–Oktyabr), got: " + title); }
const sub = wb2.Sheets["Baholar"].__aoa[1][0];
if (!sub.includes("06.10.2026")) { ok = false; console.log("FAIL — the report date should be 06.10.2026, got: " + sub); }

if (!ok) process.exit(1);
console.log("PASS — every score sits under its own month (Sep: starts at May, Mathematics 80/—/—/—/90, English —/—/70/—/—; Oct: May–Oct, Aprel–Oktyabr sheet title, report dated 06.10.2026)");
`);

  const r = spawnSync(process.execPath, [path.join(sandbox, "run.mjs")], { stdio: "inherit" });
  status = r.status === 0 ? 0 : 1;
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}
process.exit(status);
