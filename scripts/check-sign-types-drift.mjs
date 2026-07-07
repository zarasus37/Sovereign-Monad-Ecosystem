#!/usr/bin/env node
/**
 * check-sign-types-drift.mjs — Layer 3 TypeScript numeric drift guard (Goal A).
 *
 * The canonical thresholds live in `shared/schemas/ttcl-numerics.json`. The
 * TypeScript runtime derives from it via codegen:
 *
 *   `monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs` reads the JSON
 *   and emits `monad-ecosystem/packages/sovereign-types/src/generated/numerics.ts`
 *   wholesale (types + `TTCL_NUMERICS` const + flat UPPER exports). This script
 *   regenerates that file in-memory and diffs it against the committed copy.
 *
 * A mismatch means someone hand-edited the generated file OR the JSON changed
 * without re-running the generator — exactly the cross-runtime drift the
 * ecosystem exists to prevent. (The Python side is guarded separately by
 * `scripts/check-numeric-drift.mjs`; semantic invariants a diff can't catch —
 * weights summing to 1.0, monotonicity, safety-critical values — are held by
 * `monad-ecosystem/tests/integration/numerics-semantic.test.ts`.)
 *
 * Exit code 0 = no drift; 1 = drift detected.
 *
 * Usage:
 *   node scripts/check-sign-types-drift.mjs
 *
 * CI wiring: invoked via `pnpm check:sign-types`, which is part of `pnpm validate`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { check, loadNumerics } from '../monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const JSON_PATH = resolve(repoRoot, 'shared/schemas/ttcl-numerics.json');

// Every section the canonical JSON must declare. A new section added to the
// JSON without wiring it through codegen would silently miss the TS runtime,
// so this list is the floor the guard enforces.
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
  console.log(
    `✓ canonical JSON well-formed (version ${numerics.version}, ${EXPECTED_SECTIONS.length} sections expected).`
  );
} catch (err) {
  console.error(`✗ failed to load/parse ${JSON_PATH}: ${err.message}`);
  process.exit(1);
}

// ── 2. TS generated file matches the JSON ────────────────────────────────────
const clean = check();
if (!clean) failed = true;

if (failed) {
  console.error('\n✗ sign-types drift detected — see above.');
  process.exit(1);
}
console.log('\n✓ no sign-types drift.');
process.exit(0);