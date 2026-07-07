#!/usr/bin/env node
/**
 * check-numeric-drift.mjs — Layer 4a cross-runtime numeric drift guard.
 *
 * The canonical thresholds live in `shared/schemas/ttcl-numerics.json`. Two
 * runtimes derive from it and must never drift:
 *
 *   1. Python (Gnostic Engine + LOGOC manifold) — generated modules
 *      (`gnostic-engine/src/gnostic_engine/generated/numerics.py` and
 *      `monad-ecosystem/packages/logoc/peirce/_numerics.py`) are produced by
 *      `gen-numerics.mjs`. This script regenerates them in-memory and diffs
 *      against the committed copies. A mismatch means someone hand-edited a
 *      generated file OR the JSON changed without re-running the generator.
 *
 *   2. TypeScript — the generated `TTCL_NUMERICS` const in `@sovereign/types`
 *      (`sovereign-types/src/generated/numerics.ts`, produced by
 *      `gen-sign-types.mjs`) is drift-guarded against the JSON by
 *      `scripts/check-sign-types-drift.mjs`, and its semantic invariants are
 *      held by `monad-ecosystem/tests/integration/numerics-semantic.test.ts`
 *      (run via `pnpm test:integration`). This script owns the Python side only;
 *      the TS side is `pnpm check:sign-types`.
 *
 * Exit code 0 = no drift; 1 = drift detected.
 *
 * Usage:
 *   node scripts/check-numeric-drift.mjs
 *
 * CI wiring: invoked from scripts/run_ci.ps1 alongside `pnpm test:integration`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { check, loadNumerics } from '../monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const JSON_PATH = resolve(repoRoot, 'shared/schemas/ttcl-numerics.json');

const EXPECTED_SECTIONS = [
  'gnostic_engine',
  'logoc_manifold',
  'ttcl_constitution',
  'ttcl_logoc_tier',
  'ttcl_pps',
  'gnosis_plurality',
];

let failed = false;

// ── 1. JSON sanity ───────────────────────────────────────────────────────────
try {
  const numerics = loadNumerics();
  if (typeof numerics.version !== 'string') {
    console.error('✗ ttcl-numerics.json missing `version` string.');
    failed = true;
  }
  for (const sec of EXPECTED_SECTIONS) {
    if (!numerics.sections?.[sec]) {
      console.error(`✗ ttcl-numerics.json missing section: ${sec}`);
      failed = true;
    }
  }
  console.log(`✓ canonical JSON well-formed (version ${numerics.version}, ${EXPECTED_SECTIONS.length} sections).`);
} catch (err) {
  console.error(`✗ failed to load/parse ${JSON_PATH}: ${err.message}`);
  process.exit(1);
}

// ── 2. Python generated files match the JSON ────────────────────────────────
const clean = check();
if (!clean) failed = true;

// (The TypeScript side is drift-guarded by `scripts/check-sign-types-drift.mjs`
// — `pnpm check:sign-types`. This script owns the Python side only.)

if (failed) {
  console.error('\n✗ numeric drift detected — see above.');
  process.exit(1);
}
console.log('\n✓ no numeric drift.');
process.exit(0);