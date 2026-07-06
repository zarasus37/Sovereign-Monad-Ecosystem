#!/usr/bin/env node
/**
 * Compare two HCD drift reports and emit a concise markdown diff.
 *
 * Usage: node hcd-diff.mjs <base-report.json> <pr-report.json>
 */

import { readFileSync } from 'node:fs';

const [basePath, prPath] = process.argv.slice(2);
if (!basePath || !prPath) {
  console.error('Usage: node hcd-diff.mjs <base-report.json> <pr-report.json>');
  process.exit(1);
}

function load(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

const base = load(basePath);
const pr = load(prPath);

const baseById = new Map(base.metrics.map((m) => [m.id, m]));
const prById = new Map(pr.metrics.map((m) => [m.id, m]));
const ids = Array.from(new Set([...baseById.keys(), ...prById.keys()])).sort();

function fmt(value, unit) {
  if (typeof value !== 'number') return value;
  if (unit === 'ms') return `${Math.round(value).toLocaleString()} ms`;
  if (unit === 'ratio' || unit === 'normalized_entropy') return value.toFixed(3);
  return value.toString();
}

function delta(baseVal, prVal, unit) {
  if (typeof baseVal !== 'number' || typeof prVal !== 'number') return '-';
  const d = prVal - baseVal;
  const prefix = d > 0 ? '+' : '';
  if (unit === 'ms') return `${prefix}${Math.round(d).toLocaleString()} ms`;
  return `${prefix}${d.toFixed(3)}`;
}

const rows = [];
for (const id of ids) {
  const b = baseById.get(id);
  const p = prById.get(id);
  const name = p?.name ?? b?.name ?? id;
  const bVal = b?.value ?? '-';
  const pVal = p?.value ?? '-';
  const bStatus = b?.status ?? 'missing';
  const pStatus = p?.status ?? 'missing';
  const unit = p?.unit ?? b?.unit ?? '';
  const statusMarker = bStatus !== pStatus ? `${bStatus} → **${pStatus}**` : pStatus;
  rows.push(
    `| ${id} | ${name} | ${fmt(bVal, unit)} | ${fmt(pVal, unit)} | ${delta(bVal, pVal, unit)} | ${statusMarker} |`
  );
}

console.log('| Metric | Name | Base | PR | Delta | Status |');
console.log('|---|---|---|---|---|---|');
for (const row of rows) console.log(row);

const baseWarnings = base.warnings ?? [];
const prWarnings = pr.warnings ?? [];
if (baseWarnings.length || prWarnings.length) {
  console.log('');
  console.log('**Warnings**');
  for (const w of baseWarnings) console.log(`- Base: ${w}`);
  for (const w of prWarnings) console.log(`- PR: ${w}`);
}
