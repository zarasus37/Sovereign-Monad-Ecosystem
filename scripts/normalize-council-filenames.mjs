/**
 * Normalize THE COUNCILE source files to:
 *   {Display Name} ({era}) GNOSIS EVENT EXTRACTION.txt
 * Merge multi-file members into one file (keep richest content + supplemental).
 *
 *   node scripts/normalize-council-filenames.mjs
 *   node scripts/gen-council-registry.mjs
 *   node scripts/check-council-registry.mjs
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
  existsSync,
  statSync,
  copyFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const councilDir = join(root, 'theo-techno-cosmo', 'THE COUNCILE');
const registryPath = join(councilDir, 'council-registry.json');

const registry = JSON.parse(readFileSync(registryPath, 'utf8'));

function sanitizeEra(era) {
  return String(era)
    .replace(/–|—/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalName(displayName, era) {
  const e = sanitizeEra(era);
  // Windows-safe: strip reserved chars (including colon)
  const base = `${displayName} (${e}) GNOSIS EVENT EXTRACTION.txt`;
  return base
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s*-\s*/g, (m) => (m.includes('-') && m.trim() === '-' ? '-' : m))
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

function mergeContents(parts) {
  // parts: [{ name, text, size }]
  parts.sort((a, b) => b.size - a.size);
  const primary = parts[0];
  const seen = new Set([primary.text.trim()]);
  let out = primary.text.replace(/\s+$/, '') + '\n';
  for (let i = 1; i < parts.length; i++) {
    const t = parts[i].text.trim();
    if (!t || seen.has(t)) continue;
    // Skip if secondary is largely contained in primary
    if (primary.text.includes(t.slice(0, Math.min(400, t.length)))) continue;
    out += `\n\n---\n\n## Supplemental material (merged from ${parts[i].name})\n\n`;
    out += t + '\n';
    seen.add(t);
  }
  return out;
}

const SKIP = new Set(['README.md', 'council-registry.json']);
const onDisk = readdirSync(councilDir).filter((f) => {
  const p = join(councilDir, f);
  return statSync(p).isFile() && !SKIP.has(f);
});

const planned = []; // { member_id, target, sources: string[] }

for (const m of registry.members) {
  const target = canonicalName(m.display_name, m.era);
  planned.push({
    member_id: m.member_id,
    display_name: m.display_name,
    era: m.era,
    target,
    sources: [...m.source_files],
  });
}

// Detect target collisions
const byTarget = new Map();
for (const p of planned) {
  if (!byTarget.has(p.target)) byTarget.set(p.target, []);
  byTarget.get(p.target).push(p.member_id);
}
for (const [t, ids] of byTarget) {
  if (ids.length > 1) {
    console.error('TARGET COLLISION', t, ids);
    process.exit(1);
  }
}

const usedSources = new Set();
const writeOps = [];

for (const p of planned) {
  for (const s of p.sources) {
    if (!onDisk.includes(s)) {
      console.error(`Missing source for ${p.member_id}: ${s}`);
      process.exit(1);
    }
    usedSources.add(s);
  }

  const parts = p.sources.map((name) => {
    const path = join(councilDir, name);
    const text = readText(path);
    return { name, text, size: Buffer.byteLength(text, 'utf8'), path };
  });

  const content = mergeContents(parts);
  writeOps.push({
    member_id: p.member_id,
    target: p.target,
    content,
    sources: p.sources,
  });
}

// Orphan check
const orphans = onDisk.filter((f) => !usedSources.has(f));
if (orphans.length) {
  console.error('Orphan files not in registry:', orphans);
  process.exit(1);
}

// Write to temp names first to avoid clobber, then rename
const tempSuffix = '.__normalize_tmp__';
const temps = [];

for (const op of writeOps) {
  const tmp = join(councilDir, op.target + tempSuffix);
  writeFileSync(tmp, op.content, 'utf8');
  temps.push({ tmp, final: join(councilDir, op.target), op });
}

// Delete all old sources (that aren't already the final target written as tmp)
const finals = new Set(writeOps.map((o) => o.target));
for (const f of onDisk) {
  const path = join(councilDir, f);
  // keep if it's a final name and content already written via tmp
  unlinkSync(path);
}

// Move temps to finals
for (const { tmp, final, op } of temps) {
  renameSync(tmp, final);
  const merged = op.sources.length > 1 || op.sources[0] !== op.target;
  console.log(
    `${op.member_id}: ${op.sources.join(' + ')} -> ${op.target}${op.sources.length > 1 ? ' [merged]' : ''}`,
  );
}

console.log(`\nNormalized ${writeOps.length} members. multi-merge: ${writeOps.filter((o) => o.sources.length > 1).length}`);
console.log('Next: node scripts/gen-council-registry.mjs && node scripts/check-council-registry.mjs');
