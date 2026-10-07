// Standalone check for the useAsyncData race condition fix. Unlike the
// other e2e files, this does NOT need `npm run dev` running — it builds
// a tiny isolated test bundle (just React + the real hook, no app UI),
// serves it on its own port, and drives it with Playwright directly.
// Needs: npm install (for esbuild, bundled with vite) and
// `npm i --no-save playwright && npx playwright install chromium`.
import { spawnSync } from "child_process";
import { createServer } from "http";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const OUT = path.join(HERE, "race_test", "bundle.js");
const APP = path.join(HERE, "race_test", "app.jsx");
const HTML = path.join(HERE, "race_test", "index.html");

function findEsbuild() {
  const candidates = [
    path.join(ROOT, "node_modules", ".bin", "esbuild"),
    path.join(ROOT, "node_modules", "esbuild", "bin", "esbuild"),
    process.env.ESBUILD_BIN, // optional override, e.g. a global esbuild install
  ].filter(Boolean);
  for (const c of candidates) { const r = spawnSync(c, ["--version"]); if (r.status === 0) return c; }
  return "esbuild"; // fall back to PATH
}

console.log("Building the isolated test bundle...");
const esbuild = findEsbuild();
const build = spawnSync(esbuild, [
  APP, "--bundle", `--outfile=${OUT}`, "--jsx=automatic",
  "--format=iife", '--define:process.env.NODE_ENV="development"', "--log-level=warning",
], { stdio: "inherit" });
if (build.status !== 0) { console.log("FAIL — could not build the test bundle (is esbuild installed via `npm install`?)"); process.exit(1); }

const PORT = 8799;
const server = createServer(async (req, res) => {
  const file = req.url === "/" || req.url === "/index.html" ? HTML : path.join(HERE, "race_test", path.basename(req.url));
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": file.endsWith(".js") ? "text/javascript" : "text/html" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(PORT, resolve));

try {
  const { createRequire } = await import("module");
  const require = createRequire(import.meta.url);
  let chromium;
  try { ({ chromium } = require("playwright")); }
  catch { console.log("FAIL — playwright not installed. Run: npm i --no-save playwright && npx playwright install chromium"); process.exit(1); }

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/`);

  // Mount with key="A" (slow, 500ms resolve), then — BEFORE it resolves —
  // switch to key="B" (fast, 100ms resolve). Real-world equivalent: a
  // parent taps Child A, then quickly taps Child B before A's data has
  // come back. The late-arriving A response must NOT overwrite B's.
  await page.waitForFunction(() => typeof window.__setKey === "function");
  await page.waitForTimeout(50);
  await page.evaluate(() => window.__setKey("B"));
  await page.waitForTimeout(700);
  const finalText = await page.textContent("#result");
  console.log("Final rendered result:", finalText, "(expected RESULT_B)");
  await browser.close();
  if (finalText !== "RESULT_B") {
    console.log("FAIL — a stale, slower request (A) overwrote the newer, faster request (B)'s data");
    process.exit(1);
  }
  console.log("PASS — the request-id guard correctly discarded the stale response that arrived after a newer request had already superseded it");
} finally {
  server.close();
}
