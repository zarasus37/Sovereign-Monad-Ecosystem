#!/usr/bin/env node
/**
 * gen-sign-types.mjs — Layer 3 code generator (Goal A).
 *
 * Reads canonical shared/ JSON sources of truth and emits the TypeScript
 * generated modules the @sovereign/types runtime imports from:
 *
 *   - shared/schemas/ttcl-numerics.json
 *     → monad-ecosystem/packages/sovereign-types/src/generated/numerics.ts
 *       consumed by every TS package that imports from `@sovereign/types`
 *       (logoc, ttcl, gnosis-core, sovereign-bus, …) via the barrel.
 *
 *   - shared/peirce-spec/peirce_sign_classes.json
 *     → monad-ecosystem/packages/sovereign-types/src/generated/peirce-sign-classes.ts
 *       the canonical 66-class Peirce manifold table, consumed by the
 *       @sovereign/types PeirceManifold (the runtime relocated from
 *       @sovereign/logoc). Codegen-fed so the manifold is pure TS: no fs,
 *       no path, no __dirname/import.meta.url at runtime (matches the
 *       numerics pattern exactly).
 *
 * This retires the hand-mirrored `sovereign-types/src/numerics.ts` (Layer 4a):
 * the TS side now uses codegen, symmetric with the Python side
 * (`gen-numerics.mjs`). One JSON source of truth → codegen → runtime, no
 * hand-mirror to drift.
 *
 * Generated files carry a `@generated DO NOT EDIT` header + `@source` pointer
 * to the input spec. Drift is caught by `scripts/check-sign-types-drift.mjs`,
 * which regenerates each target into memory and diffs against the committed copy.
 *
 * Usage:
 *   node monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs           # write
 *   node monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs --check    # diff only (CI)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../../..'); // scripts→ttcl→packages→monad-ecosystem→root
const jsonPath = resolve(repoRoot, 'shared/schemas/ttcl-numerics.json');
const peirceClassesPath = resolve(repoRoot, 'shared/peirce-spec/peirce_sign_classes.json');

// ── Targets ────────────────────────────────────────────────────────────────
// Each target carries its own JSON source + render fn. The numerics target
// flattens EVERY section (consumers import flat UPPER constants across all
// sections); the peirce-classes target emits one readonly const array. Both
// share the `check()` / `writeAll()` / `isMain` scaffold below.
const TARGETS = [
  {
    relPath: 'monad-ecosystem/packages/sovereign-types/src/generated/numerics.ts',
    sourcePath: jsonPath,
    render: (data) => renderNumerics(data),
  },
  {
    relPath: 'monad-ecosystem/packages/sovereign-types/src/generated/peirce-sign-classes.ts',
    sourcePath: peirceClassesPath,
    render: (data) => renderPeirceSignClasses(data),
  },
];

// ── Flat-export naming ──────────────────────────────────────────────────────
// The flat UPPER_SNAKE export names are the public TS API consumed across the
// monorepo (logoc/ttcl/gnosis-core/tests all import them), so the generator
// must reproduce the exact hand-curated names the old mirror exposed — changing
// them would break consumers. The scheme is a per-section prefix, with one
// per-constant override for an ergonomic elision:
//
//   - Most sections: FLAT = SECTION_PREFIX + constName.toUpperCase()
//   - ttcl_logoc_tier.tier_neighbor_radius: the section prefix `LOGOC_TIER_`
//     plus the constant's own leading `tier_` would double to
//     `LOGOC_TIER_TIER_NEIGHBOR_RADIUS`, so the hand-mirror elided the redundant
//     `TIER_` → `LOGOC_TIER_NEIGHBOR_RADIUS`. The override preserves that.
//
// A section added to the JSON without an entry here fails loud (assert below)
// so the public-API naming can't silently change.
const SECTION_PREFIX = {
  gnostic_engine: '',
  logoc_manifold: 'MANIFOLD_',
  ttcl_constitution: 'CONSTITUTION_',
  ttcl_logoc_tier: 'LOGOC_TIER_',
  ttcl_pps: 'PPS_',
  gnosis_plurality: '',
};

const FLAT_NAME_OVERRIDE = {
  'ttcl_logoc_tier.tier_neighbor_radius': 'LOGOC_TIER_NEIGHBOR_RADIUS',
};

function flatName(secName, constName) {
  const key = `${secName}.${constName}`;
  if (Object.prototype.hasOwnProperty.call(FLAT_NAME_OVERRIDE, key)) {
    return FLAT_NAME_OVERRIDE[key];
  }
  if (!Object.prototype.hasOwnProperty.call(SECTION_PREFIX, secName)) {
    throw new Error(
      `gen-sign-types: section ${JSON.stringify(secName)} has no SECTION_PREFIX entry — ` +
        'add it (or an override) before flattening, so the public flat-export name is intentional.'
    );
  }
  return SECTION_PREFIX[secName] + constName.toUpperCase();
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Load + parse the canonical JSON. */
function loadNumerics() {
  return JSON.parse(readFileSync(jsonPath, 'utf-8'));
}

/** TS literal for a numeric value. JSON.stringify is deterministic and never
 *  emits scientific notation for the value range in this file (smallest is 0.08,
 *  largest is 5e8). JSON.parse already normalized trailing zeros (0.30→0.3). */
function tsNumber(value) {
  return JSON.stringify(value);
}

/** TS literal for a string. Double-quoted, fully escaped. There is no active
 *  formatter in the pipeline, so double-quoted output is drift-stable. */
function tsString(value) {
  return JSON.stringify(value);
}

/** TS literal for the ownerRuntime array, preserving JSON order. */
function tsOwnerRuntime(arr) {
  return `[${arr.map((s) => tsString(s)).join(', ')}]`;
}

// ── Rendering ──────────────────────────────────────────────────────────────

function header(sourcePath, docName, editHint) {
  const relSource = sourcePath.slice(repoRoot.length + 1).replace(/\\/g, '/');
  return [
    '/**',
    ` * @generated DO NOT EDIT — generated from ${relSource}`,
    ` * @source ${relSource}`,
    ' * by monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs.',
    ' *',
    ` * ${docName} (Layer 3 — codegen).`,
    ' *',
    ' * This file is generated wholesale from the JSON source of truth on every',
    ' * gen-sign-types.mjs run. Drift (a hand-edit, or the JSON changing without a',
    ' * re-run) is caught by `scripts/check-sign-types-drift.mjs`, which regenerates',
    ' * this file into memory and diffs it against the committed copy.',
    ' *',
    ` * Edit ${relSource}, then re-run:`,
    ' *   node monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs',
    ` * ${editHint}`,
    ' */',
  ].join('\n');
}

function renderTypes() {
  return [
    '// ── Types ────────────────────────────────────────────────────────────────────',
    '',
    '/** Which runtime(s) own a constant. Matches the JSON `owner_runtime` array. */',
    "export type OwnerRuntime = 'python' | 'ts';",
    '',
    '/** One canonical numeric entry — matches the JSON leaf shape. */',
    'export interface NumericEntry {',
    '  readonly value: number;',
    '  readonly unit: string;',
    '  readonly sourceDoc: string;',
    '  readonly rationale: string;',
    '  readonly ownerRuntime: readonly OwnerRuntime[];',
    '}',
    '',
    '/** A named group of related constants — matches the JSON `sections[*]`. */',
    'export interface NumericSection {',
    '  readonly description: string;',
    '  readonly constants: Readonly<Record<string, NumericEntry>>;',
    '}',
    '',
    '/** The full canonical numerics document — matches the JSON parity subset. */',
    'export interface TTCLNumerics {',
    '  readonly version: string;',
    '  readonly sections: Readonly<Record<string, NumericSection>>;',
    '}',
  ].join('\n');
}

function renderConst(numerics) {
  const lines = [
    '// ── The single literal mirror ────────────────────────────────────────────────',
    '',
    'export const TTCL_NUMERICS: TTCLNumerics = {',
    `  version: ${tsString(numerics.version)},`,
    '  sections: {',
  ];
  for (const [secName, sec] of Object.entries(numerics.sections)) {
    lines.push(`    ${tsString(secName)}: {`);
    lines.push(`      description: ${tsString(sec.description)},`);
    lines.push('      constants: {');
    for (const [constName, entry] of Object.entries(sec.constants)) {
      const sourceDoc = entry.source_doc ?? entry.sourceDoc ?? '';
      const ownerRuntime = entry.owner_runtime ?? entry.ownerRuntime;
      lines.push(`        ${tsString(constName)}: {`);
      lines.push(`          value: ${tsNumber(entry.value)},`);
      lines.push(`          unit: ${tsString(entry.unit)},`);
      lines.push(`          sourceDoc: ${tsString(sourceDoc)},`);
      lines.push(`          rationale: ${tsString(entry.rationale)},`);
      lines.push(`          ownerRuntime: ${tsOwnerRuntime(ownerRuntime)},`);
      lines.push('        },');
    }
    lines.push('      },');
    lines.push('    },');
  }
  lines.push('  },');
  lines.push('};');
  return lines.join('\n');
}

function renderFlatExports(numerics) {
  const lines = [
    '// ── Flat named exports (derived from the single literal above) ─────────────',
    '// Consumers import these. They are read-only references into TTCL_NUMERICS;',
    '// the drift guard guarantees the literal above matches the JSON, so these',
    '// transitively match the JSON too.',
    '',
  ];
  const sections = Object.entries(numerics.sections);
  sections.forEach(([secName, sec], i) => {
    if (i > 0) lines.push('');
    lines.push(`// ${secName}`);
    for (const constName of Object.keys(sec.constants)) {
      const name = flatName(secName, constName);
      lines.push(`export const ${name} =`);
      lines.push(`  TTCL_NUMERICS.sections.${secName}.constants.${constName}.value;`);
    }
  });
  return lines.join('\n');
}

function renderNumerics(numerics) {
  return [
    header(
      jsonPath,
      'Canonical TTCL numerics for the TypeScript runtime (@sovereign/types)',
      '(numerics: no runtime hint — pure const, imported at module load.)'
    ),
    renderTypes(),
    '',
    renderConst(numerics),
    '',
    renderFlatExports(numerics),
    '',
  ].join('\n');
}

// ── Peirce sign-classes target ──────────────────────────────────────────────
// Emits `PEIRCE_SIGN_CLASSES: readonly PeirceSignClass[]` — the canonical
// 66-class table, sourced from shared/peirce-spec/peirce_sign_classes.json.
// The @sovereign/types PeirceManifold imports this const and builds its maps
// from it (codegen-fed: no fs/path/__dirname at runtime). The `PeirceSignClass`
// interface is a TYPE-ONLY import (no runtime cycle: the generated file has no
// runtime dependency on the manifold module).

function tsClassEntry(c) {
  return [
    '  {',
    `    id: ${tsNumber(c.id)},`,
    `    label: ${tsString(c.label)},`,
    `    path: [${c.path.map((p) => tsString(p)).join(', ')}],`,
    `    firstness_weight: ${tsNumber(c.firstness_weight)},`,
    `    secondness_weight: ${tsNumber(c.secondness_weight)},`,
    `    thirdness_weight: ${tsNumber(c.thirdness_weight)},`,
    `    pragmatism_band: ${tsString(c.pragmatism_band)},`,
    `    ring_radius: ${tsNumber(c.ring_radius)},`,
    `    ring_angle_deg: ${tsNumber(c.ring_angle_deg)},`,
    '  },',
  ].join('\n');
}

function renderPeirceSignClasses(classes) {
  return [
    header(
      peirceClassesPath,
      'Canonical 66-class Peirce sign-class table for the TypeScript runtime (@sovereign/types)',
      '(peirce-classes: consumed by PeirceManifold at module load — pure const, no fs/path.)'
    ),
    '// The PeirceSignClass interface lives in ../peirce/manifold.js (same package).',
    '// TYPE-ONLY import so this generated const carries no runtime dependency on the',
    '// manifold module (no cycle: manifold imports this const by value, this file',
    '// imports the interface by type only).',
    'import type { PeirceSignClass } from "../peirce/manifold.js";',
    '',
    'export const PEIRCE_SIGN_CLASSES: readonly PeirceSignClass[] = [',
    classes.map(tsClassEntry).join('\n'),
    '];',
    '',
  ].join('\n');
}

// ── Exports (for scripts/check-sign-types-drift.mjs) ───────────────────────

export { repoRoot, jsonPath, peirceClassesPath, TARGETS, loadNumerics };

/** Load a target's JSON source. */
function loadTarget(target) {
  return JSON.parse(readFileSync(target.sourcePath, 'utf-8'));
}

/**
 * Regenerate every target from its JSON source and compare against the
 * committed files. Returns true if everything is in sync (no drift), false
 * otherwise. Logs each mismatch. No filesystem writes.
 */
export function check() {
  let clean = true;
  for (const target of TARGETS) {
    const data = loadTarget(target);
    const absPath = resolve(repoRoot, target.relPath);
    const generated = target.render(data);
    const committed = existsSync(absPath) ? readFileSync(absPath, 'utf-8') : null;
    if (committed !== generated) {
      clean = false;
      console.error(`✗ DRIFT: ${target.relPath} does not match its canonical JSON.`);
      console.error('  Re-run: node monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs');
    } else {
      console.log(`✓ ${target.relPath} matches canonical JSON.`);
    }
  }
  return clean;
}

/** Regenerate + write every target from its JSON source. */
export function writeAll() {
  for (const target of TARGETS) {
    const data = loadTarget(target);
    const absPath = resolve(repoRoot, target.relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, target.render(data), 'utf-8');
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