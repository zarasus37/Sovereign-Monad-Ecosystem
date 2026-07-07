/**
 * Layer 3 — TTCL numerics semantic invariants.
 *
 * The drift guards (`scripts/check-numeric-drift.mjs` for the Python side,
 * `scripts/check-sign-types-drift.mjs` for the TS side) catch *change*: they
 * regenerate from `shared/schemas/ttcl-numerics.json` and diff against the
 * committed generated files. They cannot catch *wrongness* — a JSON edit that
 * changes a value but keeps the file self-consistent passes the diff.
 *
 * This test holds the invariants the diff can't: weights that must sum to 1.0,
 * tiers/bands that must be monotonic, and the safety-critical constants whose
 * numeric values are load-bearing (a silent flip there is the exact failure
 * mode the ecosystem exists to prevent). If the JSON is edited to a
 * self-consistent-but-wrong value, this test fails.
 *
 * Values come from `@sovereign/types` — the generated `TTCL_NUMERICS` const +
 * flat exports — which the drift guard already pins to the JSON. So this test
 * asserts on the canonical runtime surface, not the JSON directly.
 */

import { describe, it, expect } from 'vitest';
import {
  TTCL_NUMERICS,
  // gnostic_engine
  FOCAL_LOCK_THRESHOLD,
  BOUNDARY_THRESHOLD,
  LANE_B_BLEND_RAW_WEIGHT,
  LANE_B_BLEND_VMASK_WEIGHT,
  LANE_C_KILL_RHCP_SPIN,
  LANE_C_KILL_HOST_RATIO,
  LANE_C_KILL_USER_RATIO,
  SPIN_EXPANDING_GATE,
  MAX_BLINKS,
  MAX_TVL_REFERENCE,
  // logoc_manifold
  MANIFOLD_WEIGHT_RING,
  MANIFOLD_WEIGHT_ANGLE,
  MANIFOLD_WEIGHT_HAMMING,
  MANIFOLD_MAX_DISTANCE,
  // ttcl_constitution
  CONSTITUTION_C1_TRIPARTITE_WEIGHT,
  CONSTITUTION_C2_LOGIC_COMPRESSION_WEIGHT,
  CONSTITUTION_C3_SOURCE_ALIGNED_WEIGHT,
  CONSTITUTION_C4_EPISTEMIC_HUMILITY_WEIGHT,
  CONSTITUTION_C5_NO_RLHF_SIGNAL_WEIGHT,
  CONSTITUTION_PASS_THRESHOLD,
  // ttcl_logoc_tier
  LOGOC_TIER_NEIGHBOR_RADIUS,
  LOGOC_TIER_COHERENT_DENSITY_THRESHOLD,
  LOGOC_TIER_EMERGENT_DENSITY_THRESHOLD,
  LOGOC_TIER_COHERENT_LANE_B_WEIGHT,
  LOGOC_TIER_EMERGENT_LANE_B_WEIGHT,
  LOGOC_TIER_DIVERGENT_LANE_B_WEIGHT,
  // ttcl_pps
  PPS_STATIC_BAND,
  PPS_HEAP_BAND,
  PPS_VOLATILE_BAND,
} from '@sovereign/types';

const EPSILON = 1e-9;
const sum = (...xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('Layer 3 — TTCL numerics semantic invariants', () => {
  // ── ttcl_constitution ──────────────────────────────────────────────────────
  describe('ttcl_constitution — the single scoring path (Layer 6)', () => {
    it('pins the constitution pass threshold at 0.72', () => {
      // The 0.72 pass threshold is the constitution gate. A silent change here
      // re-grades every sign's verdict.
      expect(CONSTITUTION_PASS_THRESHOLD).toBe(0.72);
    });

    it('the five criterion weights sum to exactly 1.0', () => {
      // Weights must partition the score. If they drift off 1.0 the pass
      // threshold changes meaning without anything else moving.
      const total = sum(
        CONSTITUTION_C1_TRIPARTITE_WEIGHT,
        CONSTITUTION_C2_LOGIC_COMPRESSION_WEIGHT,
        CONSTITUTION_C3_SOURCE_ALIGNED_WEIGHT,
        CONSTITUTION_C4_EPISTEMIC_HUMILITY_WEIGHT,
        CONSTITUTION_C5_NO_RLHF_SIGNAL_WEIGHT
      );
      expect(Math.abs(total - 1.0)).toBeLessThan(EPSILON);
    });

    it('C1 (tripartite) is the heaviest weight — triadic completeness is the core axiom', () => {
      expect(CONSTITUTION_C1_TRIPARTITE_WEIGHT).toBeGreaterThan(
        CONSTITUTION_C2_LOGIC_COMPRESSION_WEIGHT
      );
    });
  });

  // ── ttcl_logoc_tier ────────────────────────────────────────────────────────
  describe('ttcl_logoc_tier — manifold-derived Lane B weighting (Layer 7)', () => {
    it('Lane B weights are monotonically attenuated: coherent > emergent > divergent', () => {
      // A more-embedded tier must carry at least as much Lane B weight as the
      // next looser tier. Inversion here would reward isolation.
      expect(LOGOC_TIER_COHERENT_LANE_B_WEIGHT).toBeGreaterThan(
        LOGOC_TIER_EMERGENT_LANE_B_WEIGHT
      );
      expect(LOGOC_TIER_EMERGENT_LANE_B_WEIGHT).toBeGreaterThan(
        LOGOC_TIER_DIVERGENT_LANE_B_WEIGHT
      );
    });

    it('coherent Lane B weight preserves the full blend (1.0); divergent is the hard floor', () => {
      expect(LOGOC_TIER_COHERENT_LANE_B_WEIGHT).toBe(1.0);
      expect(LOGOC_TIER_DIVERGENT_LANE_B_WEIGHT).toBeLessThan(1.0);
    });

    it('density thresholds are ordered: coherent threshold > emergent threshold', () => {
      // A class needs more neighbors to be COHERENT than to be EMERGENT.
      expect(LOGOC_TIER_COHERENT_DENSITY_THRESHOLD).toBeGreaterThan(
        LOGOC_TIER_EMERGENT_DENSITY_THRESHOLD
      );
    });

    it('tier neighbor radius is broader than the classifier local radius (max_distance)', () => {
      // The tier is measured over a wider neighborhood than local sign adjacency;
      // at the tight local radius every class is an island and the tier degenerates.
      expect(LOGOC_TIER_NEIGHBOR_RADIUS).toBeGreaterThan(MANIFOLD_MAX_DISTANCE);
    });
  });

  // ── logoc_manifold ─────────────────────────────────────────────────────────
  describe('logoc_manifold — composite distance metric', () => {
    it('the three manifold distance weights sum to exactly 1.0', () => {
      const total = sum(MANIFOLD_WEIGHT_RING, MANIFOLD_WEIGHT_ANGLE, MANIFOLD_WEIGHT_HAMMING);
      expect(Math.abs(total - 1.0)).toBeLessThan(EPSILON);
    });
  });

  // ── gnostic_engine ─────────────────────────────────────────────────────────
  describe('gnostic_engine — safety-critical constants', () => {
    it('focal lock + boundary thresholds are the canonical values', () => {
      // The primary integrity gate. A flip here changes what locks focus vs.
      // blinks toward quarantine across the whole engine.
      expect(FOCAL_LOCK_THRESHOLD).toBe(0.85);
      expect(BOUNDARY_THRESHOLD).toBe(0.65);
    });

    it('Lane C kill-switch ratios are the canonical blast-radius guards', () => {
      expect(LANE_C_KILL_HOST_RATIO).toBe(0.25);
      expect(LANE_C_KILL_USER_RATIO).toBe(0.5);
      expect(LANE_C_KILL_RHCP_SPIN).toBe(0.75);
    });

    it('Lane B blend is exactly 50/50 and sums to 1.0', () => {
      expect(LANE_B_BLEND_RAW_WEIGHT).toBe(0.5);
      expect(LANE_B_BLEND_VMASK_WEIGHT).toBe(0.5);
      expect(sum(LANE_B_BLEND_RAW_WEIGHT, LANE_B_BLEND_VMASK_WEIGHT)).toBeCloseTo(1.0, 9);
    });

    it('spin expanding gate is a valid mid-range ratio', () => {
      expect(SPIN_EXPANDING_GATE).toBeGreaterThan(0);
      expect(SPIN_EXPANDING_GATE).toBeLessThan(1);
    });

    it('blink budget and TVL ceiling are the canonical magnitudes', () => {
      expect(MAX_BLINKS).toBe(3);
      expect(MAX_TVL_REFERENCE).toBe(500_000_000);
    });
  });

  // ── ttcl_pps ───────────────────────────────────────────────────────────────
  describe('ttcl_pps — Primary Parameter Schema sync bands', () => {
    it('bands are monotonically looser: static > heap > volatile', () => {
      // Tighter sync point > adjacent-convergent > pattern-following/quarantine.
      expect(PPS_STATIC_BAND).toBeGreaterThan(PPS_HEAP_BAND);
      expect(PPS_HEAP_BAND).toBeGreaterThan(PPS_VOLATILE_BAND);
    });

    it('static band is the full-sync ceiling (1.0)', () => {
      expect(PPS_STATIC_BAND).toBe(1.0);
    });
  });

  // ── structural sanity (cheap, catches a generator regression) ──────────────
  describe('structural', () => {
    it('TTCL_NUMERICS exposes every section the JSON declares', () => {
      const sections = Object.keys(TTCL_NUMERICS.sections).sort();
      expect(sections).toEqual(
        [
          'gnostic_engine',
          'gnosis_plurality',
          'logoc_manifold',
          'ttcl_constitution',
          'ttcl_logoc_tier',
          'ttcl_pps',
        ].sort()
      );
    });
  });
});