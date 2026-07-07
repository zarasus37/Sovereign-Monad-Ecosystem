#!/usr/bin/env node
/**
 * gen-numerics.mjs — Layer 4a code generator.
 *
 * Reads the canonical `shared/schemas/ttcl-numerics.json` and emits the
 * Python generated modules the runtimes import from:
 *
 *   - gnostic-engine/src/gnostic_engine/generated/numerics.py
 *       consumed by core/gnostic_engine.py, api/routes.py, api/gnostic_bridge.py
 *   - monad-ecosystem/packages/logoc/peirce/_numerics.py
 *       consumed by peirce/manifold.py
 *
 * The TypeScript side does NOT use codegen — it uses a hand-mirrored typed const
 * (`@sovereign/types` numerics.ts) plus a vitest parity test. That asymmetry is
 * deliberate: TS has a build/type system that makes a typed const + parity test
 * the lower-friction honest mirror; Python has no equivalent, so we generate.
 *
 * Generated files carry a `@generated DO NOT EDIT` header. Drift is caught by
 * `scripts/check-numeric-drift.mjs`, which regenerates into a temp buffer and
 * diffs against the committed files.
 *
 * Usage:
 *   node monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs           # write
 *   node monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs --check    # diff only (CI)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..'); // scripts→ttcl→packages→monad-ecosystem→root
const jsonPath = resolve(repoRoot, 'shared/schemas/ttcl-numerics.json');

const numerics = JSON.parse(readFileSync(jsonPath, 'utf-8'));

// ── Targets ────────────────────────────────────────────────────────────────
// Each target: where to write, which sections to flatten into UPPER constants.
const TARGETS = [
  {
    relPath: 'gnostic-engine/src/gnostic_engine/generated/numerics.py',
    docName: 'Python Gnostic Engine',
    flattenSections: ['gnostic_engine'],
  },
  {
    relPath: 'monad-ecosystem/packages/logoc/peirce/_numerics.py',
    docName: 'Python LOGOC manifold mirror',
    flattenSections: ['logoc_manifold'],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Python literal for a numeric value (int stays int, float stays float). */
function pyLiteral(value) {
  if (Number.isInteger(value)) return `${value}`;
  // Preserve float-ness; avoid scientific notation for these small ratios.
  return String(value);
}

/** Python annotation for a numeric value. */
function pyAnnotation(value) {
  return Number.isInteger(value) ? 'int' : 'float';
}

/** Render the full structured TTCL_NUMERICS dict (the drift-check anchor). */
function renderStructuredDict(numerics) {
  const lines = ['TTCL_NUMERICS = {', `  "version": ${JSON.stringify(numerics.version)},`, '  "sections": {'];
  for (const [secName, sec] of Object.entries(numerics.sections)) {
    lines.push(`    ${JSON.stringify(secName)}: {`);
    lines.push(`      "description": ${JSON.stringify(sec.description)},`);
    lines.push('      "constants": {');
    for (const [constName, entry] of Object.entries(sec.constants)) {
      lines.push(`        ${JSON.stringify(constName)}: {`);
      lines.push(`          "value": ${pyLiteral(entry.value)},`);
      lines.push(`          "unit": ${JSON.stringify(entry.unit)},`);
      lines.push(`          "source_doc": ${JSON.stringify(entry.source_doc ?? entry.sourceDoc ?? '')},`);
      lines.push(`          "rationale": ${JSON.stringify(entry.rationale)},`);
      lines.push(`          "owner_runtime": ${JSON.stringify(entry.owner_runtime ?? entry.ownerRuntime)},`);
      lines.push('        },');
    }
    lines.push('      },');
    lines.push('    },');
  }
  lines.push('  },');
  lines.push('}');
  return lines.join('\n');
}

/** Render the flat UPPER_SNAKE constants for the given sections. */
function renderFlatConstants(numerics, sectionNames) {
  const blocks = [];
  for (const secName of sectionNames) {
    const sec = numerics.sections[secName];
    const lines = [`# ── ${secName} ──────────────────────────────────────────────────────────────────`];
    for (const [constName, entry] of Object.entries(sec.constants)) {
      const upper = constName.toUpperCase();
      const ann = pyAnnotation(entry.value);
      lines.push(`${upper}: ${ann} = ${pyLiteral(entry.value)}`);
    }
    blocks.push(lines.join('\n'));
  }
  return blocks.join('\n\n');
}

function renderTarget(numerics, target) {
  const header = [
    '# @generated DO NOT EDIT — generated from shared/schemas/ttcl-numerics.json',
    '# by monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs.',
    '# Edit the JSON, then re-run: node monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs',
    '"""',
    `Canonical TTCL numerics for the ${target.docName} (Layer 4a).`,
    '',
    'Generated from shared/schemas/ttcl-numerics.json — the single source of truth.',
    'Drift is caught by scripts/check-numeric-drift.mjs (regenerates + diffs).',
    '"""',
    'from __future__ import annotations',
    '',
  ].join('\n');

  const flat = renderFlatConstants(numerics, target.flattenSections);
  const structured = renderStructuredDict(numerics);

  return `${header}\n${flat}\n\n\n# ── Structured mirror (drift-check anchor; full canonical set) ───────────────\n${structured}\n`;
}

// ── Exports (for scripts/check-numeric-drift.mjs) ───────────────────────────

export { repoRoot, jsonPath, TARGETS, renderTarget, loadNumerics };

/** Load + parse the canonical JSON. */
function loadNumerics() {
  return JSON.parse(readFileSync(jsonPath, 'utf-8'));
}

/**
 * Regenerate every target from the JSON and compare against the committed
 * files. Returns true if everything is in sync (no drift), false otherwise.
 * Logs each mismatch. No filesystem writes.
 */
export function check() {
  const numerics = loadNumerics();
  let clean = true;
  for (const target of TARGETS) {
    const absPath = resolve(repoRoot, target.relPath);
    const generated = renderTarget(numerics, target);
    const committed = existsSync(absPath) ? readFileSync(absPath, 'utf-8') : null;
    if (committed !== generated) {
      clean = false;
      console.error(`✗ DRIFT: ${target.relPath} does not match the canonical JSON.`);
      console.error('  Re-run: node monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs');
    } else {
      console.log(`✓ ${target.relPath} matches canonical JSON.`);
    }
  }
  return clean;
}

/** Regenerate + write every target from the JSON. */
export function writeAll() {
  const numerics = loadNumerics();
  for (const target of TARGETS) {
    const absPath = resolve(repoRoot, target.relPath);
    writeFileSync(absPath, renderTarget(numerics, target), 'utf-8');
    console.log(`✓ wrote ${target.relPath}`);
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const checkOnly = process.argv.includes('--check');
  if (checkOnly) {
    if (!check()) process.exit(1);
  } else {
    writeAll();
  }
}