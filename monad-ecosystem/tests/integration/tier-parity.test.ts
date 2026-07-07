/**
 * Layer 7.8 — Tier parity.
 *
 * Same class_id → the TS `produceLogocTier` (@sovereign/logoc, the parity
 * mirror added in L7.8) and the canonical Python `produce_logoc_tier`
 * (gnostic_engine.logoc_tier, the producer the live pipeline actually uses)
 * MUST emit the same tier string, the same Lane B weight, and the same
 * neighbor density. Both read the same canonical numerics (`ttcl_logoc_tier`
 * section) and walk the same 66-class manifold, so agreement is expected —
 * but the co-architect's directive is to ASSERT it explicitly across every
 * class rather than assume it. An unknown class id throws on both sides.
 *
 * No fixture file: the manifold IS the corpus. Every one of the 66 classes is
 * checked, so a drift in any class's neighbor geometry or the density
 * thresholds is caught here.
 */

import { describe, expect, it } from 'vitest';
import { getManifold } from '@sovereign/types';
import { produceLogocTier, neighborDensity } from '@sovereign/logoc';
import { runParityShim } from './_parity.js';

const manifold = getManifold();
const allClasses = manifold.allClasses();
const allClassIds = allClasses.map((c) => c.id).sort((a, b) => a - b);

describe('Layer 7.8 — tier parity (TS produceLogocTier ↔ Python produce_logoc_tier)', () => {
  // One Python spawn for all 66 class ids (batch mode).
  const py = runParityShim('tier_all', { class_ids: allClassIds }) as {
    results: {
      tier: string | null;
      weight: number | null;
      density: number | null;
      error?: string;
    }[];
  };

  it('the manifold exposes 66 classes and the shim returned 66 results', () => {
    expect(allClasses).toHaveLength(66);
    expect(py.results).toHaveLength(66);
  });

  it('every Python result is a clean tier (no unknown-class errors for real ids)', () => {
    for (const r of py.results) {
      expect(r.error).toBeUndefined();
      expect(r.tier).toMatch(/^(COHERENT|EMERGENT|DIVERGENT)$/);
    }
  });

  // Per-class parity. Build a label map for readable failure messages.
  const labelById = new Map(allClasses.map((c) => [c.id, c.label] as const));
  for (let i = 0; i < allClassIds.length; i++) {
    const id = allClassIds[i];
    it(`class ${id} (${labelById.get(id)}) — tier/weight/density match across runtimes`, () => {
      const ts = produceLogocTier(id);
      const pyResult = py.results[i];
      expect(ts.tier).toBe(pyResult.tier);
      expect(ts.weight).toBe(pyResult.weight);
      // Density is neighbors/65; same integer count and same division in both
      // runtimes → bitwise-equal float. toBeCloseTo guards against any JSON
      // round-trip printing quirk while still being effectively exact.
      expect(ts.density).toBeCloseTo(pyResult.density as number, 12);
      // TS neighborDensity must agree with the produced density.
      expect(neighborDensity(id)).toBeCloseTo(ts.density, 12);
    });
  }

  it('the tier spread matches the canonical calibration (~6 DIVERGENT / ~19 EMERGENT / ~41 COHERENT)', () => {
    const tsTiers = allClassIds.map((id) => produceLogocTier(id).tier);
    const counts = {
      COHERENT: tsTiers.filter((t) => t === 'COHERENT').length,
      EMERGENT: tsTiers.filter((t) => t === 'EMERGENT').length,
      DIVERGENT: tsTiers.filter((t) => t === 'DIVERGENT').length,
    };
    // The numerics rationale documents this spread at tier_neighbor_radius=1.0.
    // Pin the exact counts so a manifold-geometry change can't silently shift
    // the tier distribution without this test catching it.
    expect(counts.COHERENT).toBe(41);
    expect(counts.EMERGENT).toBe(19);
    expect(counts.DIVERGENT).toBe(6);
  });

  it('each tier maps to its canonical Lane B weight (1.0 / 0.7 / 0.4)', () => {
    const seen = new Set<string>();
    for (const id of allClassIds) {
      const ts = produceLogocTier(id);
      seen.add(ts.tier);
      switch (ts.tier) {
        case 'COHERENT':
          expect(ts.weight).toBe(1.0);
          break;
        case 'EMERGENT':
          expect(ts.weight).toBe(0.7);
          break;
        case 'DIVERGENT':
          expect(ts.weight).toBe(0.4);
          break;
      }
    }
    // The corpus must exercise all three tiers — otherwise the per-tier weight
    // assertion above would be vacuous for any missing tier.
    expect(seen.has('COHERENT')).toBe(true);
    expect(seen.has('EMERGENT')).toBe(true);
    expect(seen.has('DIVERGENT')).toBe(true);
  });

  it('an unknown class id throws on the TS producer and surfaces null+error on the Python producer', () => {
    // TS: producer, not predicate — unknown class throws (the live pipeline's
    // orchestrator wraps this in try/except; here we assert the loud failure).
    expect(() => produceLogocTier(999999)).toThrow();
    expect(() => neighborDensity(999999)).toThrow();
    // Python: the shim catches the manifold KeyError and reports it.
    const py = runParityShim('tier', { class_id: 999999 }) as {
      tier: null;
      weight: null;
      density: null;
      error: string;
    };
    expect(py.tier).toBeNull();
    expect(py.error).toBe('UNKNOWN_CLASS');
  });
});