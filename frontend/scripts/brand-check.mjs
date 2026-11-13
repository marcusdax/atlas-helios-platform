#!/usr/bin/env node
/**
 * Brand guard.
 *
 * 01 — Brand architecture §3 lists strings whose appearance on a customer-facing
 * surface is "a release blocker", and notes that equivalent guards already exist
 * in the sibling repositories (`scripts/brand-check.mjs` in Atlas,
 * `scripts/voice.test.ts` in coffee, `scripts/check-vocab.ts` in FACET) — but
 * there was none in this one, which is how "PropertyInsight Dashboard" stayed on
 * the dashboard heading and a retired brand stayed in the NOAA User-Agent.
 *
 * The blueprint's framing is the reason this is a script and not a style note:
 * "Brand drift is a trust leak. If two surfaces disagree about what 'verified'
 * looks like, a customer is entitled to conclude that neither is real."
 *
 * Run: npm run brand:check
 */

import { readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { readdir } from 'node:fs/promises';

const ROOT = new URL('..', import.meta.url).pathname;

/** Where customer-facing text lives. Tests and this script are exempt. */
const ROOTS = ['src', 'public'];
const SKIP_DIRS = new Set(['node_modules', 'build', 'coverage', '.git', 'storybook-static']);
const TEXT_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.html', '.json', '.css', '.md']);

/**
 * Forbidden strings, verbatim from §3 with the reason each one is blocked, so a
 * failure explains itself rather than sending someone to find the document.
 */
const FORBIDDEN = [
  { re: /PropertyInsight/i, why: 'retired engine mark; collides with a live product and a registered mark' },
  { re: /Luminall/i, why: 'retired precursor brand; forbidden on all surfaces, exports and metadata' },
  { re: /Vivella/i, why: 'legacy internal name; the product brand is FACET' },
  { re: /Verified partner/i, why: 'retired term; the correct term is "Verified relationship"' },
  { re: /group sell/i, why: 'retired term; the correct term is "custom lot sale"' },
  { re: /\bthis release\b/i, why: 'developer phrasing leaking into product copy' },
  { re: /\bAuctum Platform\b/i, why: 'AUCTUM is set in capitals and is not called a "platform"' }
];

/**
 * §2a — "if the word *verified* is unqualified in customer copy, it is a defect."
 * The estate uses it for four different things, so a bare use is ambiguous.
 * These are the qualified forms that are allowed to stand.
 */
const VERIFIED_OK = [
  /Verified by AUCTUM/,          // the seal, evidence tier 5
  /Verified relationship/,       // two businesses have traded
  /[a-z]+ verified/,             // badge state, e.g. "origin verified", "payment verified"
  /Payment-verified/,            // tier 4 name
  /verified\s*[:=]/i,            // a field or key, not prose
  /'verified'|"verified"|`verified`/ // a literal value in code
];

async function* walk(dir) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walk(full);
    else if (TEXT_EXT.has(extname(e.name))) yield full;
  }
}

const findings = [];

for (const base of ROOTS) {
  for await (const file of walk(join(ROOT, base))) {
    const rel = relative(ROOT, file);
    if (rel.includes('brand-check')) continue;

    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // A line that explains why a string is banned must be allowed to name it.
      const isExplanatory = /forbidden|retired|release blocker|§3|was a |used to/i.test(line);

      for (const { re, why } of FORBIDDEN) {
        if (re.test(line) && !isExplanatory) {
          findings.push({ rel, line: i + 1, text: line.trim().slice(0, 110), why, kind: 'forbidden' });
        }
      }

      if (/\bverified\b/i.test(line) && !isExplanatory) {
        if (!VERIFIED_OK.some((ok) => ok.test(line))) {
          findings.push({
            rel, line: i + 1, text: line.trim().slice(0, 110), kind: 'vocabulary',
            why: 'unqualified "verified" — say which of the four it is (see §2a)'
          });
        }
      }
    });
  }
}

if (findings.length === 0) {
  console.log('Brand check: clean — no forbidden strings, no unqualified "verified".');
  process.exit(0);
}

console.log(`Brand check: ${findings.length} finding(s)\n`);
for (const f of findings) {
  console.log(`  ${f.kind === 'forbidden' ? 'BLOCKER ' : 'VOCAB   '} ${f.rel}:${f.line}`);
  console.log(`            ${f.text}`);
  console.log(`            ${f.why}\n`);
}
process.exit(1);
