// Plain unit check (no browser). The running app translates through a MERGED
// dictionary (main + parent-app), so a key defined only in the main
// (staff-side) dictionary still renders fine for Parent screens today — which
// is exactly why 8 keys went missing from the parent-app dictionaries without
// anyone noticing: nothing visibly broke. But that leaves src/parent-app/i18n
// NOT self-contained, so the parent app couldn't be extracted or reused alone,
// and the dependency on the staff dictionary was invisible.
//
// This guards that: every key the Parent screens use must exist in the
// PARENT-APP dictionaries themselves, in all three languages.
//
// What it can and can't see:
//  - Static  t("literal") calls — all of them.
//  - Dynamic keys whose possible values live in a table in the source
//    (labelKey/titleKey/bodyKey/textKey props, *_KEY lookup tables, the
//    Homework filter ids, the navigation table, and the report status keys
//    built from overallStatus). A key built any other way at runtime would
//    not be seen here — add its table to collectUsedKeys() if one appears.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import uz from "../src/parent-app/i18n/uz.js";
import ru from "../src/parent-app/i18n/ru.js";
import en from "../src/parent-app/i18n/en.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "src");
const PARENT = path.join(SRC, "parent-app");

// Tables whose values are NOT translation keys (theme color names, ids).
const NOT_TRANSLATION_TABLES = new Set(["STATUS_COLOR_KEY"]);

function walk(dir, out = []) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) { if (f !== "i18n") walk(p, out); }
    else if (/\.(jsx?|mjs)$/.test(f)) out.push(p);
  }
  return out;
}

const unknownTemplateFamilies = [];

function collectUsedKeys() {
  const used = new Map(); // key -> first place it was seen
  const templatePrefixes = new Map(); // `prefix${x}` -> file it was seen in
  const add = (k, where) => { if (!used.has(k)) used.set(k, where); };

  for (const file of walk(PARENT)) {
    const rel = path.relative(PARENT, file);
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/\bt\(\s*["'`]([A-Za-z0-9_]+)["'`]/g)) add(m[1], `${rel}: t("${m[1]}")`);
    for (const m of src.matchAll(/\b(?:labelKey|titleKey|bodyKey|textKey|subKey|descKey)\s*:\s*["']([A-Za-z0-9_]+)["']/g)) add(m[1], `${rel}: …Key property`);
    for (const tbl of src.matchAll(/const\s+([A-Z_]*KEY[A-Z_]*)\s*=\s*\{([^}]*)\}/g)) {
      if (NOT_TRANSLATION_TABLES.has(tbl[1])) continue;
      for (const v of tbl[2].matchAll(/:\s*["']([A-Za-z0-9_]+)["']/g)) add(v[1], `${rel}: ${tbl[1]}`);
    }
    for (const arr of src.matchAll(/const\s+FILTERS\s*=\s*\[([^\]]*)\]/g))
      for (const v of arr[1].matchAll(/["']([A-Za-z0-9_]+)["']/g)) add(v[1], `${rel}: FILTERS`);
    // Template-literal keys, e.g. t(`role${r}`): the plain-literal regex
    // above can't see these. Record each prefix; expanded below.
    for (const m of src.matchAll(/\bt\(`([A-Za-z0-9_]*)\$\{/g)) templatePrefixes.set(m[1], rel);
  }

  // How each KNOWN template prefix expands. An unrecognised prefix is a
  // failure (not a silent skip) so a new dynamic family can't go unchecked.
  const TEMPLATE_EXPANDERS = {
    // guardian relationship labels: Registration, Settings invite + list
    role: () => ["Mother", "Father", "Guardian"].map(r => "role" + r),
    // report status label — built from overallStatus, expanded further below
    status: () => [],
  };
  for (const [prefix, where] of templatePrefixes) {
    if (!(prefix in TEMPLATE_EXPANDERS)) {
      unknownTemplateFamilies.push(`t(\`${prefix}\${…}\`) in ${where}`);
      continue;
    }
    for (const k of TEMPLATE_EXPANDERS[prefix]()) add(k, `${where}: t(\`${prefix}\${…}\`)`);
  }

  // Navigation table (t(item.key)) lives in the context, not under parent-app.
  const ctx = fs.readFileSync(path.join(SRC, "context", "AppContext.jsx"), "utf8");
  for (const m of ctx.matchAll(/Icon:\s*\w+,\s*key:\s*["']([A-Za-z]+)["']/g)) add(m[1], "context/AppContext.jsx: NAV_POOL");

  // Report status key is built as "status" + Capitalised(overallStatus).
  const analytics = fs.readFileSync(path.join(PARENT, "utils", "parentAnalytics.js"), "utf8");
  for (const m of analytics.matchAll(/overallStatus\s*=\s*["']([A-Za-z]+)["']/g))
    add("status" + m[1][0].toUpperCase() + m[1].slice(1), "PrintableReport: statusKey from overallStatus");

  return used;
}

const findMissing = (used, dict) => [...used.keys()].filter(k => !(k in dict)).sort();

let failed = false;
const fail = (msg) => { console.log("FAIL — " + msg); failed = true; };

const used = collectUsedKeys();
console.log(`Checking ${used.size} translation keys used by the Parent app against the parent-app dictionaries...`);

if (unknownTemplateFamilies.length) {
  fail("found dynamic translation key(s) this guard can't expand, so they would go unchecked — register them in TEMPLATE_EXPANDERS: " + unknownTemplateFamilies.join("; "));
}

// 1. Every used key is defined in every parent-app dictionary.
for (const [lang, dict] of [["uz", uz], ["ru", ru], ["en", en]]) {
  const missing = findMissing(used, dict);
  if (missing.length) fail(`parent-app/i18n/${lang}.js is missing ${missing.length} key(s): ` + missing.map(k => `${k} (${used.get(k)})`).join("; "));
}

// 2. The three dictionaries define the same keys (a key in one language but
//    not another silently falls back to English for that language's users).
const keySets = { uz: new Set(Object.keys(uz)), ru: new Set(Object.keys(ru)), en: new Set(Object.keys(en)) };
const union = new Set([...keySets.uz, ...keySets.ru, ...keySets.en]);
for (const [lang, set] of Object.entries(keySets)) {
  const missing = [...union].filter(k => !set.has(k));
  if (missing.length) fail(`parent-app/i18n/${lang}.js lacks ${missing.length} key(s) the other languages have: ${missing.slice(0, 10).join(", ")}`);
}

// 3. No key is defined twice in one file (a later duplicate silently wins).
for (const lang of ["uz", "ru", "en"]) {
  const src = fs.readFileSync(path.join(PARENT, "i18n", `${lang}.js`), "utf8");
  const counts = new Map();
  for (const m of src.matchAll(/(?<![\w"'`])([A-Za-z0-9_]+)\s*:\s*["'`]/g)) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  const dupes = [...counts].filter(([, n]) => n > 1).map(([k]) => k);
  if (dupes.length) fail(`parent-app/i18n/${lang}.js defines duplicate key(s): ${dupes.join(", ")}`);
}

// 4. Control: prove this checker can actually catch the bug it exists for.
//    Remove a key from a copy of a dictionary and confirm it's reported.
{
  const { noGradesYet, ...withoutOne } = uz;
  const reported = findMissing(used, withoutOne);
  if (!reported.includes("noGradesYet")) fail("control failed — the checker did not notice a deliberately removed key");
}

// 5. The specific keys originally found missing, kept as a named record.
for (const k of ["back", "guardianAlreadyAdded", "noGradesYet", "otpTitle", "overallSingleMonthSentence", "resendCode", "singleMonthNote", "trendNeedsMonths"]) {
  for (const [lang, dict] of [["uz", uz], ["ru", ru], ["en", en]]) {
    if (!(k in dict)) fail(`"${k}" is missing from parent-app/i18n/${lang}.js`);
  }
}

if (failed) process.exit(1);
console.log(`PASS — all ${used.size} keys are defined in all three parent-app dictionaries (${keySets.en.size} keys each, no duplicates, detector control verified)`);
