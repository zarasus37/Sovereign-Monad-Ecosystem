#!/usr/bin/env node
/**
 * check-schedule-schema-drift.mjs — Layer 6 cross-runtime schema guard.
 *
 *   The canonical-schedule schema at shared/ttcl-specs/
 *   canonical-schedule-schema.json declares the JSON shape the
 *   `@sovereign/scheduler` facade is allowed to emit. The runtime
 *   package (especially after the εP / ζF follow-up) can drift out
 *   of sync with the schema — emitting keys the schema does not
 *   permit, or requiring keys the runtime doesn't emit. This script
 *   is the fast, standalone guard: assemble a default schedule via
 *   the runtime, then validate it against the schema. If either side
 *   drifts, this script fails and blocks merges (it's part of the
 *   `pnpm check:*` aggregate).
 *
 *   This is the same gate that `monad-ecosystem/tests/integration/
 *   scheduler.test.ts > the assembled artifact validates against
 *   canonical-schedule-schema.json` runs, but a fraction of the time —
 *   the integration test waits on the full vitest setup, the JSONL
 *   fixtures, and the other 100+ tests in the suite. This script
 *   exists so a contributor iterating on the schema or the runtime
 *   can validate alignment in <1s.
 *
 *   Exit code 0 = schema and runtime are in sync.
 *   Exit code 1 = drift detected; diff written to stdout.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(__filename, '..', '..');
const SCHEMA_PATH = resolve(
  ROOT,
  'shared/ttcl-specs/canonical-schedule-schema.json',
);
const REGISTRY_PATH = resolve(ROOT, 'shared/fixtures/layer6/wheel-registry.json');
const SCHEDULER_INDEX = pathToFileURL(
  resolve(ROOT, 'monad-ecosystem/packages/scheduler/dist/index.js'),
).href;

const { generateSchedule } = await import(SCHEDULER_INDEX);

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

let schedule;
try {
  schedule = generateSchedule(REGISTRY_PATH);
} catch (e) {
  // If generateSchedule itself throws, the runtime is broken or the
  // schema is unreachable. Report and fail.
  console.error(
    'generateSchedule() threw — runtime is broken or the schema is unreachable.\n' +
      (e?.stack ?? e),
  );
  process.exit(1);
}

if (validate(schedule)) {
  console.log('Layer 6 — schema and runtime in sync (no drift).');
  process.exit(0);
}

// Drift detected. Print a compact, human-readable diff.
const errors = validate.errors ?? [];
const byPath = new Map();
for (const err of errors) {
  const p = err.instancePath || '/';
  const cur = byPath.get(p) ?? { msg: err.message, extra: err.params?.additionalProperty, count: 0 };
  cur.count += 1;
  byPath.set(p, cur);
}

console.error('Layer 6 — schema/runtime DRIFT detected.');
console.error(`  schema : ${SCHEMA_PATH.replace(ROOT + '/', '')}`);
console.error(`  registry: ${REGISTRY_PATH.replace(ROOT + '/', '')}`);
console.error(`  total ajv errors: ${errors.length}`);
console.error(`  distinct paths: ${byPath.size}`);
console.error('');
console.error('Distinct failures (top 10):');
for (const [p, v] of [...byPath.entries()].slice(0, 10)) {
  console.error(
    `  [×${v.count}] ${p}  ·  ${v.msg}${v.extra ? `  (extra: ${v.extra})` : ''}`,
  );
}
console.error('');
console.error('Side-by-side key diff:');
const expectedWeights = Object.keys(schema.properties.config.properties.weights.properties);
const expectedTerms = Object.keys(schema.properties.steps.items.properties.terms.properties);
const runtimeWeights = Object.keys(schedule.config.weights);
const runtimeTerms = Object.keys(schedule.steps[0].terms);
console.error(`  schema weights  : [${expectedWeights.join(', ')}]`);
console.error(`  runtime weights : [${runtimeWeights.join(', ')}]`);
console.error(`  schema terms    : [${expectedTerms.join(', ')}]`);
console.error(`  runtime terms   : [${runtimeTerms.join(', ')}]`);
const onlyInRuntime = {
  weights: runtimeWeights.filter((k) => !expectedWeights.includes(k)),
  terms: runtimeTerms.filter((k) => !expectedTerms.includes(k)),
};
if (onlyInRuntime.weights.length || onlyInRuntime.terms.length) {
  console.error('');
  console.error('Runtime keys NOT declared by the schema (likely drift source):');
  if (onlyInRuntime.weights.length) {
    console.error(`  weights: [${onlyInRuntime.weights.join(', ')}]`);
  }
  if (onlyInRuntime.terms.length) {
    console.error(`  terms:   [${onlyInRuntime.terms.join(', ')}]`);
  }
}
process.exit(1);
