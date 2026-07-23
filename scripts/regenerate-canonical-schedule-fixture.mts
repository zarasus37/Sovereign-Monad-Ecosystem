/**
 * One-shot fixture regenerator. Run from the repo root:
 *   pnpm exec tsx scripts/regenerate-canonical-schedule-fixture.mts
 *
 * Writes the current DEFAULT_CONFIG schedule (seed 42) to
 *   shared/fixtures/layer6/canonical-schedule.json
 *
 * This is intentionally separate from the test runner so it can be
 * invoked by a maintainer when the schema or runtime shape changes.
 * The byte-identical reproducibility test in scheduler.test.ts will
 * fail if this fixture is out of date with the runtime output.
 */
import { generateSchedule, serializeSchedule } from '../monad-ecosystem/packages/scheduler/src/index.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const REGISTRY = resolve('shared/fixtures/layer6/wheel-registry.json');
const OUT = resolve('shared/fixtures/layer6/canonical-schedule.json');

const schedule = generateSchedule(REGISTRY);
writeFileSync(OUT, serializeSchedule(schedule));
console.log('Regenerated', OUT, '—', schedule.steps.length, 'steps');
console.log('  version  :', schedule.version);
console.log('  generator:', schedule.generator);
console.log('  weights  :', Object.keys(schedule.config.weights).join(', '));
console.log('  terms[0] :', Object.keys(schedule.steps[0]!.terms).join(', '));
