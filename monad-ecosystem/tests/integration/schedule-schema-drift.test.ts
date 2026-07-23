/**
 * check-schedule-schema-drift.test.ts — Layer 6 cross-runtime schema guard.
 *
 *   The canonical-schedule schema at shared/ttcl-specs/
 *   canonical-schedule-schema.json declares the JSON shape the
 *   `@sovereign/scheduler` facade is allowed to emit. The runtime
 *   package (especially after the εP / ζF follow-up) can drift out
 *   of sync with the schema — emitting keys the schema does not
 *   permit, or requiring keys the runtime doesn't emit. This test
 *   is the fast, standalone guard: assemble a default schedule via
 *   the runtime, then validate it against the schema. If either
 *   side drifts, this test fails and the `pnpm validate` aggregate
 *   fails (it's wired into the chain as `pnpm check:schedule-schema`).
 *
 *   Implemented as a vitest test (rather than a standalone .mjs
 *   script) so it inherits the @sovereign/* → ./src aliases in
 *   vitest.config.ts. That means a `pnpm install --frozen-lockfile`
 *   is sufficient to run it — no separate `pnpm build` of the
 *   workspace packages is required.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import { generateSchedule } from '@sovereign/scheduler';
import type { CanonicalSchedule } from '@sovereign/scheduler';

const SCHEMA_PATH = resolve(
  process.cwd(),
  'shared/ttcl-specs/canonical-schedule-schema.json',
);
const REGISTRY_PATH = resolve(
  process.cwd(),
  'shared/fixtures/layer6/wheel-registry.json',
);

const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
const ajv = new Ajv({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

describe('Layer 6 — canonical-schedule schema ↔ runtime drift guard', () => {
  it('assembles a default schedule without throwing', () => {
    let schedule: CanonicalSchedule | undefined;
    expect(() => {
      schedule = generateSchedule(REGISTRY_PATH);
    }).not.toThrow();
    expect(schedule).toBeDefined();
    expect(schedule!.steps.length).toBeGreaterThan(0);
  });

  it('the assembled schedule validates against canonical-schedule-schema.json', () => {
    const schedule = generateSchedule(REGISTRY_PATH);
    if (!validate(schedule)) {
      const errors = validate.errors ?? [];
      const summary = errors
        .slice(0, 10)
        .map(
          (e) =>
            `  ${e.instancePath || '/'} · ${e.message}` +
            (e.params?.additionalProperty
              ? ` (extra: ${e.params.additionalProperty})`
              : ''),
        )
        .join('\n');
      throw new Error(
        `Layer 6 schema/runtime DRIFT detected: ${errors.length} ajv errors\n${summary}\n` +
          `Runtime keys (weights): ${Object.keys(schedule.config.weights).join(', ')}\n` +
          `Runtime keys (terms[0]): ${Object.keys(schedule.steps[0]!.terms).join(', ')}\n` +
          `Schema-required (weights): ${Object.keys(schema.properties.config.properties.weights.properties).join(', ')}\n` +
          `Schema-required (terms): ${Object.keys(schema.properties.steps.items.properties.terms.properties).join(', ')}`,
      );
    }
    expect(validate(schedule)).toBe(true);
  });
});
