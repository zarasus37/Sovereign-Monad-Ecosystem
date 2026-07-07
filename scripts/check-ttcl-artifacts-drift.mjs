#!/usr/bin/env node
/**
 * check-ttcl-artifacts-drift.mjs — Layer 3 Phase B drift guard (Sign→event codegen).
 *
 * The canonical Sign-event spec lives in `shared/ttcl-specs/sign-events.json`. The
 * TS runtime derives three artifacts from it via codegen:
 *
 *   `monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs` reads the spec
 *   (+ the 4 hand-written shared/schemas/*.json payloads) and emits:
 *     - sovereign-types/src/generated/ttcl-observation-event.json (Sign-event schema)
 *     - ttcl/src/generated/sign-factories.ts                   (Sign factories)
 *     - sovereign-types/src/generated/sign-event-validators.ts (ajv validators)
 *
 * This script regenerates all three in-memory and diffs each against its committed
 * copy. A mismatch means someone hand-edited a generated file OR the spec / a
 * hand-written schema changed without re-running the generator — exactly the
 * cross-runtime drift the ecosystem exists to prevent. (Semantic + negative-case
 * invariants a diff can't catch — a validator that always returns true, a factory
 * whose output no longer conforms — are held by
 * `monad-ecosystem/tests/integration/schema-validators.test.ts`.)
 *
 * Exit code 0 = no drift; 1 = drift detected.
 *
 * Usage:
 *   node scripts/check-ttcl-artifacts-drift.mjs
 *
 * CI wiring: invoked via `pnpm check:ttcl-artifacts`, which is part of `pnpm validate`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { check, loadSpec } from '../monad-ecosystem/packages/ttcl/scripts/gen-ttcl-artifacts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const SPEC_PATH = resolve(repoRoot, 'shared/ttcl-specs/sign-events.json');

// Every event type the canonical spec must declare. A new event type added to
// the generator without a spec entry would silently miss codegen, so this list
// is the floor the guard enforces.
const EXPECTED_EVENT_TYPES = [
  'ttcl.observation.emitted',
];

let failed = false;

// ── 1. JSON sanity ───────────────────────────────────────────────────────────
try {
  const spec = loadSpec();
  if (typeof spec.version !== 'string') {
    console.error('✗ sign-events.json missing `version` string.');
    failed = true;
  }
  if (!spec.event_types || typeof spec.event_types !== 'object') {
    console.error('✗ sign-events.json missing `event_types` object.');
    failed = true;
  } else {
    for (const et of EXPECTED_EVENT_TYPES) {
      if (!spec.event_types[et]) {
        console.error(`✗ sign-events.json missing event type: ${et}`);
        failed = true;
      }
    }
  }
  console.log(
    `✓ canonical spec well-formed (version ${spec.version}, ${EXPECTED_EVENT_TYPES.length} event type(s) expected).`
  );
} catch (err) {
  console.error(`✗ failed to load/parse ${SPEC_PATH}: ${err.message}`);
  process.exit(1);
}

// ── 2. Generated artifacts match the spec + shared schemas ───────────────────
const clean = check();
if (!clean) failed = true;

if (failed) {
  console.error('\n✗ ttcl-artifacts drift detected — see above.');
  process.exit(1);
}
console.log('\n✓ no ttcl-artifacts drift.');
process.exit(0);