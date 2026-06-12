#!/usr/bin/env node
/**
 * i18n audit: lists keys that are present in en but missing from other locales.
 * Usage: node scripts/i18n-audit.mjs [--json] [--lang=de]
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dir = join(__dirname, "..", "lib", "i18n", "translations");

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const langArg = args.find((a) => a.startsWith("--lang="))?.split("=")[1];

function extractKeys(file) {
  const content = readFileSync(join(dir, file + ".ts"), "utf8");
  const keys = new Set();
  const regex = /^\s*["']([^"']+)["']\s*:/gm;
  let m;
  while ((m = regex.exec(content)) !== null) keys.add(m[1]);
  return keys;
}

const langs = readdirSync(dir)
  .filter((f) => f.endsWith(".ts"))
  .map((f) => f.replace(".ts", ""));

const enKeys = extractKeys("en");
const report = {};

for (const lang of langs) {
  if (lang === "en") continue;
  if (langArg && lang !== langArg) continue;
  const keys = extractKeys(lang);
  const missing = [...enKeys].filter((k) => !keys.has(k));
  report[lang] = { total: keys.size, missing: missing.length, keys: missing };
}

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

console.log(`EN total keys: ${enKeys.size}`);
console.log("");
const entries = Object.entries(report).sort((a, b) => b[1].missing - a[1].missing);
for (const [lang, { total, missing, keys }] of entries) {
  console.log(`[${lang}] total=${total}  missing=${missing}`);
  if (langArg && keys.length) {
    for (const k of keys) console.log(`  - ${k}`);
  }
}

const totalMissing = entries.reduce((s, [, v]) => s + v.missing, 0);
console.log("");
console.log(`Grand total of missing translations: ${totalMissing}`);
console.log(`Run  node scripts/i18n-audit.mjs --lang=de  for per-key details.`);
