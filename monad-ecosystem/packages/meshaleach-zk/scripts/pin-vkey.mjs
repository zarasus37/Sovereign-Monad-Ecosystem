#!/usr/bin/env node
/**
 * Hash verification_key.json and write pin into circuit_meta.json + vkey.sha256.
 *
 * Usage:
 *   node scripts/pin-vkey.mjs              # pin current disk vkey (keep mode)
 *   node scripts/pin-vkey.mjs --mode=demo
 *   node scripts/pin-vkey.mjs --mode=production --contributors=a,b --phase1=hermez-pot20
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const vkeyPath = join(pkgRoot, 'artifacts', 'verification_key.json');
const metaPath = join(pkgRoot, 'artifacts', 'circuit_meta.json');
const pinPath = join(pkgRoot, 'artifacts', 'vkey.sha256');

function arg(name, fallback = undefined) {
  const p = process.argv.find((a) => a.startsWith(`--${name}=`));
  return p ? p.slice(name.length + 3) : fallback;
}

if (!existsSync(vkeyPath)) {
  console.error('Missing', vkeyPath);
  process.exit(1);
}

const sha = createHash('sha256').update(readFileSync(vkeyPath)).digest('hex');
const mode = arg('mode');
const contributors = arg('contributors');
const phase1 = arg('phase1');
const beacon = arg('beacon');

let meta = {};
if (existsSync(metaPath)) {
  meta = JSON.parse(readFileSync(metaPath, 'utf8'));
}

const prevCeremony = meta.ceremony ?? {};
const nextMode = mode ?? prevCeremony.mode ?? (meta.note?.includes?.('Demo') ? 'demo' : 'unknown');

meta.vkeySha256 = sha;
meta.ceremony = {
  ...prevCeremony,
  mode: nextMode,
  vkeySha256: sha,
  pinnedAt: new Date().toISOString(),
};
if (phase1) meta.ceremony.phase1 = phase1;
if (contributors) {
  meta.ceremony.phase2Contributors = contributors.split(',').map((s) => s.trim()).filter(Boolean);
}
if (beacon !== undefined) meta.ceremony.beacon = beacon || null;

if (nextMode === 'production') {
  meta.note = 'production — multi-party ceremony; see PRODUCTION_PTAU.md';
} else if (nextMode === 'demo') {
  meta.note = 'Demo ptau — re-run trusted setup for production';
}

writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
writeFileSync(pinPath, sha + '\n');

console.log('Pinned vkey sha256:', sha);
console.log('Mode:', nextMode);
console.log('Wrote', metaPath);
console.log('Wrote', pinPath);
