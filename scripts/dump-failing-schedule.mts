/**
 * Local debugging helper: dump the failing canonical schedule JSON to disk
 * for inspection. Used to triage the integration test failures surfaced
 * in issue #76.
 *
 * Why this exists:
 *   The runtime @sovereign/scheduler now emits 6 weights and 7 terms
 *   (the Layer 6 εP / ζF follow-up), but the schema at
 *   shared/ttcl-specs/canonical-schedule-schema.json only declares 4
 *   weights and 5 terms. `generateSchedule` validates the assembled
 *   schedule against that schema and throws ScheduleSchemaError on
 *   the drift. To debug, we need to see both the emitted shape and
 *   the specific validation errors. This script captures both.
 *
 * Usage:  pnpm exec tsx scripts/dump-failing-schedule.mts
 * Output:
 *   /tmp/canonical-schedule-emitted.json  (the assembled schedule,
 *     captured BEFORE validation — the shape the runtime wants to emit)
 *   /tmp/canonical-schedule-errors.json   (the ajv error list, full)
 *   /tmp/canonical-schedule-summary.txt   (a human-readable summary
 *     of the first 10 errors + counts of the extra-property flags)
 */
import {
  generateSchedule,
  assembleSchedule,
  loadRegistry,
  anneal,
  mulberry32,
  DEFAULT_CONFIG,
  ScheduleSchemaError,
  ARTIFACT_VERSION,
  GENERATOR_ID,
} from '../monad-ecosystem/packages/scheduler/src/index.js';
import { Ajv } from 'ajv';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REGISTRY = resolve('shared/fixtures/layer6/wheel-registry.json');
const SCHEMA = resolve('shared/ttcl-specs/canonical-schedule-schema.json');
const OUT_OK = '/tmp/canonical-schedule-emitted.json';
const OUT_ERR = '/tmp/canonical-schedule-errors.json';
const OUT_SUMMARY = '/tmp/canonical-schedule-summary.txt';

// Step 1: assemble the schedule WITHOUT going through generateSchedule's
// ajv gate, so we can dump the runtime's full emit shape. This is the
// artifact we'd want to see in CI logs.
const registry = loadRegistry(REGISTRY);
const rng = mulberry32(DEFAULT_CONFIG.seed);
const run = anneal(registry, DEFAULT_CONFIG, rng);
const schedule = assembleSchedule(run, registry);

writeFileSync(OUT_OK, JSON.stringify(schedule, null, 2));
console.log('[dump] schedule assembled (validation bypassed for inspection)');
console.log('[dump]   version :', schedule.version);
console.log('[dump]   generator:', schedule.generator);
console.log('[dump]   steps   :', schedule.steps.length);
console.log('[dump]   weights :', Object.keys(schedule.config.weights));
console.log('[dump]   terms[0]:', Object.keys(schedule.steps[0]!.terms));
console.log('[dump]   written to', OUT_OK);

// Step 2: now run the official ajv check and capture the validation errors.
let validationFailed = false;
try {
  generateSchedule(REGISTRY);
  console.log('[dump] validation PASSED — schema and runtime are in sync.');
} catch (e) {
  if (e instanceof ScheduleSchemaError) {
    validationFailed = true;
    writeFileSync(OUT_ERR, JSON.stringify(e.errors, null, 2));
    console.log('[dump] validation FAILED — captured error list:');
    console.log('[dump]   total errors:', e.errors.length);

    // Group errors by instancePath for human-readable summary.
    const byPath = new Map<string, { msg: string; extra?: string; count: number }>();
    for (const err of e.errors) {
      const key = err.instancePath || '/';
      const cur = byPath.get(key) ?? { msg: err.message, extra: err.params?.additionalProperty, count: 0 };
      cur.count += 1;
      byPath.set(key, cur);
    }
    const summary = [
      'Canonical-schedule schema validation: FAIL',
      `  schedule: ${OUT_OK}`,
      `  errors:   ${OUT_ERR}`,
      `  total ajv errors: ${e.errors.length}`,
      `  distinct instance paths: ${byPath.size}`,
      '',
      'Distinct failures:',
      ...[...byPath.entries()].slice(0, 20).map(
        ([p, v]) => `  [×${v.count}] ${p}  ·  ${v.msg}${v.extra ? `  (extra: ${v.extra})` : ''}`,
      ),
      '',
      'First 5 raw errors:',
      ...e.errors.slice(0, 5).map(
        (err) =>
          `  - ${err.instancePath || '/'}  ·  ${err.message}` +
          (err.params?.additionalProperty ? `  (extra: ${err.params.additionalProperty})` : ''),
      ),
    ];
    writeFileSync(OUT_SUMMARY, summary.join('\n') + '\n');
    console.log('[dump]   summary written to', OUT_SUMMARY);
    console.log('[dump]   full list at', OUT_ERR);
  } else {
    throw e;
  }
}

// Step 3: print a one-line verdict so a CI log can grep for it.
console.log('');
console.log(
  validationFailed
    ? 'VERDICT: schema-and-runtime drift (issue #76 confirmed)'
    : 'VERDICT: schema and runtime are in sync (issue #76 closed)',
);

// Cross-check: load the schema directly and report the same drift with the
// schema's perspective, so a reviewer can see what the schema *expects*.
// This is informational — the real source of truth is generateSchedule above.
const schema = JSON.parse(readFileSync(SCHEMA, 'utf8')) as Record<string, any>;
const expectedWeightKeys = Object.keys(schema.properties.config.properties.weights.properties);
const expectedTermKeys = Object.keys(schema.properties.steps.items.properties.terms.properties);
const emittedWeightKeys = Object.keys(schedule.config.weights as object);
const emittedTermKeys = Object.keys(schedule.steps[0]!.terms as object);
const missingFromSchema = {
  weights: emittedWeightKeys.filter((k) => !expectedWeightKeys.includes(k)),
  terms: emittedTermKeys.filter((k) => !expectedTermKeys.includes(k)),
};
console.log('');
console.log('Schema vs runtime key diff:');
console.log('  schema weights  :', expectedWeightKeys);
console.log('  runtime weights :', emittedWeightKeys);
console.log('  schema terms    :', expectedTermKeys);
console.log('  runtime terms   :', emittedTermKeys);
console.log('  runtime-only weights (schema must add):', missingFromSchema.weights);
console.log('  runtime-only terms   (schema must add):', missingFromSchema.terms);
