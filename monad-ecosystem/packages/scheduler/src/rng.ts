/**
 * Layer 6 — a seeded PRNG for deterministic annealing.
 *
 * The spec's premature-convergence mitigation is to "run multiple scheduler
 * instances with different random seeds" (`TTCL_v1_0_BREAKDOWN.md:488`), which
 * requires the schedule to be a pure function of its seed. `mulberry32` is a
 * fast, well-distributed 32-bit PRNG seeded by a single integer; the same seed
 * always yields the same move sequence, so the checked-in
 * `canonical_schedule.json` is reproducible byte-for-byte.
 *
 * `Math.random()` is intentionally NOT used — it would make the canonical
 * artifact non-reproducible and break the determinism tests.
 */

/** A deterministic uniform random source. `next()` returns a float in [0, 1). */
export interface Rng {
  /** Next uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  intBelow(n: number): number;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
}

/** Wrap a raw `() => number` ([0,1)) as a full `Rng`. */
export function makeRng(raw: () => number): Rng {
  const next = raw;
  const intBelow = (n: number): number => Math.floor(next() * n);
  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error("pick from empty array");
    return items[intBelow(items.length)]!;
  };
  return { next, intBelow, pick };
}

/**
 * mulberry32: a 32-bit seeded PRNG. Returns a function producing uniform floats
 * in [0, 1). Deterministic for a given seed.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  const raw = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return makeRng(raw);
}