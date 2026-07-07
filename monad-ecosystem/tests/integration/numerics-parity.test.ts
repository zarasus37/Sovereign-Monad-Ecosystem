/**
 * Layer 4a parity: the hand-mirrored TypeScript `TTCL_NUMERICS` const MUST
 * equal the canonical `shared/schemas/ttcl-numerics.json`.
 *
 * This is one of the two drift guards. The other is
 * `scripts/check-numeric-drift.mjs`, which regenerates the Python generated
 * files from the JSON and diffs them against the committed copies.
 *
 * If this test fails, someone edited the JSON (or the const) without updating
 * the other — exactly the cross-runtime drift the ecosystem exists to prevent.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TTCL_NUMERICS } from '@sovereign/types';

const here = dirname(fileURLToPath(import.meta.url));
// monad-ecosystem/tests/integration → repo root → shared/schemas
const schemaPath = resolve(here, '../../../shared/schemas/ttcl-numerics.json');
const json = JSON.parse(readFileSync(schemaPath, 'utf-8')) as typeof TTCL_NUMERICS & {
  sections: typeof TTCL_NUMERICS.sections;
};

describe('Layer 4a — TTCL numerics parity', () => {
  it('exposes the same version as the canonical JSON', () => {
    expect(TTCL_NUMERICS.version).toBe(json.version);
  });

  it('mirrors every section the JSON declares (no missing, no extra)', () => {
    expect(Object.keys(TTCL_NUMERICS.sections).sort()).toEqual(
      Object.keys(json.sections).sort()
    );
  });

  it('deep-equals the JSON sections (every value, unit, owner_runtime)', () => {
    // Compare the structured subset that the TS const mirrors: version +
    // sections (description + constants with value/unit/sourceDoc/rationale/
    // ownerRuntime). We normalize owner_runtime → ownerRuntime key casing by
    // comparing the JSON as-is against the const as-is via a structured
    // projection on both sides.
    const projectEntry = (e: {
      value: number;
      unit: string;
      sourceDoc?: string;
      source_doc?: string;
      rationale: string;
      ownerRuntime?: readonly string[];
      owner_runtime?: readonly string[];
    }) => ({
      value: e.value,
      unit: e.unit,
      // TS const uses camelCase (sourceDoc); the JSON uses snake_case
      // (source_doc). Normalize both to one key for comparison.
      sourceDoc: e.sourceDoc ?? e.source_doc ?? '',
      rationale: e.rationale,
      ownerRuntime: [...(e.ownerRuntime ?? e.owner_runtime ?? [])].sort(),
    });

    for (const sectionName of Object.keys(json.sections)) {
      const tsSection = TTCL_NUMERICS.sections[sectionName];
      const jsonSection = json.sections[sectionName];
      expect(tsSection.description).toBe(jsonSection.description);
      expect(Object.keys(tsSection.constants).sort()).toEqual(
        Object.keys(jsonSection.constants).sort()
      );
      for (const constName of Object.keys(jsonSection.constants)) {
        expect(projectEntry(tsSection.constants[constName])).toEqual(
          projectEntry(jsonSection.constants[constName])
        );
      }
    }
  });

  it('gnostic-engine focal lock + boundary thresholds are the canonical values', () => {
    // A smoke check on the most safety-critical constants so a future
    // refactor can't silently flip them without this test also failing.
    const ge = TTCL_NUMERICS.sections.gnostic_engine.constants;
    expect(ge.focal_lock_threshold.value).toBe(0.85);
    expect(ge.boundary_threshold.value).toBe(0.65);
    expect(ge.lane_c_kill_host_ratio.value).toBe(0.25);
    expect(ge.lane_c_kill_user_ratio.value).toBe(0.5);
    expect(ge.max_blinks.value).toBe(3);
    expect(ge.max_tvl_reference.value).toBe(500_000_000);
  });
});