// Runs every check in order (01 creates the browser state the others start from).
// Usage:  npm run dev   (other terminal)   then   node e2e/run-all.mjs
// Optional range by file number, to run part of the suite:  node e2e/run-all.mjs 01 20
// (a range that doesn't start at 01 reuses the browser state a previous run left behind).
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const here = path.dirname(fileURLToPath(import.meta.url));
const [from = "00", to = "99"] = process.argv.slice(2);
const files = fs.readdirSync(here).filter(f => /^\d\d-.*\.mjs$/.test(f) && f.slice(0, 2) >= from && f.slice(0, 2) <= to).sort();
let failed = 0;
for (const f of files) {
  console.log(`\n=== ${f}`);
  const r = spawnSync(process.execPath, [path.join(here, f)], { stdio: "inherit", env: process.env });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} file(s) had failures` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
