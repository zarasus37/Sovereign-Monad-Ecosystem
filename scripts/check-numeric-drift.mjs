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
 *   2. TypeScript — the hand-mirrored `TTCL_NUMERICS` const in
 *      `@sovereign/types` (sovereign-types/src/numerics.ts) is parity-tested
 *      against the JSON by `monad-ecosystem/tests/integration/numerics-parity.test.ts`
 *      (run via `pnpm test:integration`). This script does NOT duplicate that
 *      check (a raw node script can't import TypeScript); it only confirms the
 *      const file exists and reminds the operator to run the parity test.
 *
 * Exit code 0 = no drift; 1 = drift detected.
 *
 * Usage:
 *   node scripts/check-numeric-drift.mjs
 *
 * CI wiring: invoked from scripts/run_ci.ps1 alongside `pnpm test:integration`.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { check, loadNumerics } from '../monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const JSON_PATH = resolve(repoRoot, 'shared/schemas/ttcl-numerics.json');
const TS_CONST_PATH = resolve(
  repoRoot,
  'monad-ecosystem/packages/sovereign-types/src/numerics.ts'
);

const EXPECTED_SECTIONS = [
  'gnostic_engine',
  'logoc_manifold',
  'ttcl_constitution',
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

// ── 3. TS const file present (parity is tested by vitest) ────────────────────
if (!existsSync(TS_CONST_PATH)) {
  console.error(`✗ TS mirror missing: ${TS_CONST_PATH}`);
  failed = true;
} else {
  const src = readFileSync(TS_CONST_PATH, 'utf-8');
  if (!src.includes('TTCL_NUMERICS')) {
    console.error(`✗ ${TS_CONST_PATH} does not export TTCL_NUMERICS.`);
    failed = true;
  } else {
    console.log('✓ TS mirror present (run `pnpm test:integration` to verify parity with the JSON).');
  }
}

if (failed) {
  console.error('\n✗ numeric drift detected — see above.');
  process.exit(1);
}
console.log('\n✓ no numeric drift.');
process.exit(0);