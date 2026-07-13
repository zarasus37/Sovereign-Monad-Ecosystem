/**
 * Layer 6 — the Scheduler integration suite.
 *
 * Covers the four honest concretizations (pattern/PairTable, windowN, Cost S,
 * the explicit `facets` state field) end-to-end through the public facade:
 *   - registry load + ajv validation + cross-ref integrity (rejects bad facets/pairs);
 *   - move semantics: LocalRotate wraps mod size, PatternSwitch stays in the pair
 *     table, WheelSwap preserves the all-facets-covered constraint;
 *   - the global constraint invariant holds for every state in a run trajectory;
 *   - objective terms in documented [0,1] ranges + ΔJ computed correctly on a
 *     hand-constructed transition;
 *   - determinism: same seed → byte-identical schedule; different seed → differs;
 *   - cooling monotonic + bounded below by T_min; the run stops at `steps` or T_min;
 *   - coverage > 1 after a full run (exploration actually happens);
 *   - the assembled artifact validates against canonical-schedule-schema.json;
 *   - the checked-in fixture regenerates byte-identically from the default seed
 *     (the reproducibility gate — the spec's "run multiple seeds" mitigation
 *     requires the schedule to be a pure function of its seed).
 *
 * Honesty note (mirrors the package): the spec names `pattern`, the PairTable,
 * `windowN`, and per-step Cost S but defines no concrete semantics for them;
 * each is concretized here under test against the documented behavior, not
 * presented as spec-mandated.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv } from 'ajv';
import {
  loadRegistry,
  buildRegistry,
  rotateOffset,
  initialState,
  DEFAULT_CONFIG,
  MOVE_PROBABILITIES,
  proposeMove,
  applyMove,
  constraintHolds,
  compositeKey,
  compositeDomains,
  moveMagnitude,
  locality,
  cost,
  roughness,
  materializationCost,
  evaluateMove,
  deltaJ,
  mulberry32,
  anneal,
  generateSchedule,
  assembleSchedule,
  serializeSchedule,
  RegistrySchemaError,
  RegistryIntegrityError,
  ScheduleSchemaError,
  type WheelRegistry,
  type ScheduleState,
  type ScheduleConfig,
  type Move,
  type CanonicalSchedule,
} from '@sovereign/scheduler';

const repoRoot = resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = resolve(repoRoot, 'shared', 'fixtures', 'layer6', 'wheel-registry.json');
const OUTPUT_SCHEMA_PATH = resolve(repoRoot, 'shared', 'ttcl-specs', 'canonical-schedule-schema.json');
const ARTIFACT_PATH = resolve(repoRoot, 'shared', 'fixtures', 'layer6', 'canonical-schedule.json');

/** A small-config run used by the determinism + invariant tests (fast, still explores). */
const SMALL_CONFIG: ScheduleConfig = {
  weights: { alpha: 0.35, beta: 0.25, gamma: 0.30, delta: 0.10 },
  T_init: 1.0,
  T_min: 0.001,
  cooling: 0.9995,
  steps: 600,
  seed: 42,
  windowN: 3,
};

function runOnce(config: ScheduleConfig): CanonicalSchedule {
  return generateSchedule(REGISTRY_PATH, config);
}

// ----------------------------------------------------------------------------------
// Registry
// ----------------------------------------------------------------------------------

describe('Layer 6 — registry', () => {
  it('loads + validates the llull-default fixture', () => {
    const reg = loadRegistry(REGISTRY_PATH);
    expect(reg.registry).toBe('llull-default');
    expect(reg.wheelNames).toEqual(['A', 'T', 'V', 'X', 'S']);
    expect(reg.wheels.get('A')!.size).toBe(16);
    expect(reg.wheels.get('T')!.domains).toEqual(['THEOLOGY', 'COSMOLOGY']);
    // The 5-wheel state space produces C(5,2) = 10 unordered pairs.
    expect(reg.pairs).toHaveLength(10);
    expect(reg.pairById.get('A·T')!.wheels).toEqual(['A', 'T']);
    // Live wheels are real @sovereign/ttcl Wheel<N> instances, initial position 0.
    expect(reg.liveWheels.get('A')!.position).toBe(0);
    expect(reg.liveWheels.get('A')!.size).toBe(16);
  });

  it('rejects a registry whose facet references an undeclared wheel', () => {
    const raw = {
      registry: 'bad-facet-ref',
      wheels: [
        { name: 'A', size: 16, domains: ['THEOLOGY'] },
        { name: 'B', size: 16, domains: ['TECHNOLOGY'] },
      ],
      // TECHNOLOGY → 'Z' is undeclared (schema passes; integrity catches it).
      facets: { THEOLOGY: 'A', TECHNOLOGY: 'Z', COSMOLOGY: 'A' },
      pairs: [{ id: 'A·B', wheels: ['A', 'B'] }],
    };
    expect(() => buildRegistry(raw)).toThrow(RegistryIntegrityError);
  });

  it('rejects a registry whose facet wheel does not cover that domain', () => {
    const raw = {
      registry: 'bad-coverage',
      wheels: [
        { name: 'A', size: 16, domains: ['THEOLOGY'] },
        { name: 'B', size: 16, domains: ['TECHNOLOGY'] },
        { name: 'C', size: 16, domains: ['COSMOLOGY'] },
      ],
      // TECHNOLOGY → 'A' is declared but does not cover TECHNOLOGY.
      facets: { THEOLOGY: 'A', TECHNOLOGY: 'A', COSMOLOGY: 'A' },
      pairs: [
        { id: 'A·B', wheels: ['A', 'B'] },
        { id: 'A·C', wheels: ['A', 'C'] },
        { id: 'B·C', wheels: ['B', 'C'] },
      ],
    };
    expect(() => buildRegistry(raw)).toThrow(RegistryIntegrityError);
  });

  it('rejects a registry with a pair referencing an undeclared wheel', () => {
    const raw = {
      registry: 'bad-pair',
      wheels: [
        { name: 'A', size: 16, domains: ['THEOLOGY'] },
        { name: 'S', size: 18, domains: ['TECHNOLOGY'] },
        { name: 'X', size: 16, domains: ['COSMOLOGY'] },
      ],
      facets: { THEOLOGY: 'A', TECHNOLOGY: 'S', COSMOLOGY: 'X' },
      pairs: [{ id: 'A·Z', wheels: ['A', 'Z'] }],
    };
    expect(() => buildRegistry(raw)).toThrow(RegistryIntegrityError);
  });

  it('rejects a registry failing its JSON Schema (bad wheel size)', () => {
    const raw = {
      registry: 'bad-schema',
      wheels: [{ name: 'A', size: 0, domains: ['THEOLOGY'] }], // size minimum 1
      facets: { THEOLOGY: 'A', TECHNOLOGY: 'A', COSMOLOGY: 'A' },
      pairs: [],
    };
    expect(() => buildRegistry(raw)).toThrow(RegistrySchemaError);
  });

  it('rotateOffset mirrors Wheel.rotate (mod N, negative backward, wraparound)', () => {
    expect(rotateOffset(16, 0, 1)).toBe(1);
    expect(rotateOffset(16, 15, 1)).toBe(0); // wrap
    expect(rotateOffset(16, 0, -1)).toBe(15); // backward wrap
    expect(rotateOffset(16, 5, 16)).toBe(5); // full revolution
    expect(rotateOffset(16, 5, 17)).toBe(6);
  });
});

// ----------------------------------------------------------------------------------
// Moves + constraint
// ----------------------------------------------------------------------------------

describe('Layer 6 — moves + constraint', () => {
  let reg: WheelRegistry;
  beforeAll(() => {
    reg = loadRegistry(REGISTRY_PATH);
  });

  it('LocalRotate wraps the chosen wheel offset mod size (immutable)', () => {
    const s0 = initialState(reg);
    const move: Move = { kind: 'LocalRotate', wheel: 'A', delta: 1 };
    const s1 = applyMove(s0, move, reg);
    expect(s1.offsets.A).toBe(1);
    expect(s0.offsets.A).toBe(0); // immutable: original untouched
    // Wrap.
    const sMax = { ...s0, offsets: { ...s0.offsets, A: 15 } };
    const s2 = applyMove(sMax, { kind: 'LocalRotate', wheel: 'A', delta: 1 }, reg);
    expect(s2.offsets.A).toBe(0);
    // Backward.
    const s3 = applyMove(s0, { kind: 'LocalRotate', wheel: 'A', delta: -1 }, reg);
    expect(s3.offsets.A).toBe(15);
  });

  it('PatternSwitch changes the active pair to a real pair id in the table', () => {
    const s0 = initialState(reg);
    const move: Move = { kind: 'PatternSwitch', toPair: 'V·X' };
    const s1 = applyMove(s0, move, reg);
    expect(s1.pattern).toBe('V·X');
    expect(reg.pairIds).toContain(s1.pattern);
    expect(s0.pattern).toBe(reg.pairIds[0]); // initial is first pair
  });

  it('WheelSwap reassigns a facet to another wheel covering that domain', () => {
    const s0 = initialState(reg);
    // COSMOLOGY is covered by both X and T — swap it to T.
    const move: Move = { kind: 'WheelSwap', facet: 'COSMOLOGY', toWheel: 'T' };
    const s1 = applyMove(s0, move, reg);
    expect(s1.facets.COSMOLOGY).toBe('T');
    // The new binding still covers COSMOLOGY (constraint preserved).
    expect(reg.wheels.get('T')!.domains).toContain('COSMOLOGY');
  });

  it('proposeMove only ever proposes valid moves (covering wheels, real pairs)', () => {
    const s0 = initialState(reg);
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const m = proposeMove(s0, rng, reg);
      if (m.kind === 'LocalRotate') {
        expect(reg.wheelNames).toContain(m.wheel);
      } else if (m.kind === 'PatternSwitch') {
        expect(reg.pairIds).toContain(m.toPair);
      } else {
        expect(ALL_DOMAINS_LIST).toContain(m.facet);
        expect(reg.wheelNames).toContain(m.toWheel);
        expect(reg.wheels.get(m.toWheel)!.domains).toContain(m.facet);
      }
    }
  });

  it('the all-facets-covered constraint holds at the initial state', () => {
    expect(constraintHolds(initialState(reg), reg)).toBe(true);
  });

  it('the constraint holds for every state in a full run trajectory', () => {
    const rng = mulberry32(123);
    const run = anneal(reg, SMALL_CONFIG, rng);
    for (const step of run.steps) {
      expect(constraintHolds(step.state, reg)).toBe(true);
    }
  });
});

const ALL_DOMAINS_LIST = ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'] as const;

// ----------------------------------------------------------------------------------
// Objective
// ----------------------------------------------------------------------------------

describe('Layer 6 — objective J = αC + βL + γT − δS', () => {
  let reg: WheelRegistry;
  beforeAll(() => {
    reg = loadRegistry(REGISTRY_PATH);
  });

  it('term normalizers: L and S are each in [0, 1] for every move kind', () => {
    const moves: Move[] = [
      { kind: 'LocalRotate', wheel: 'A', delta: 1 },
      { kind: 'PatternSwitch', toPair: 'V·X' },
      { kind: 'WheelSwap', facet: 'COSMOLOGY', toWheel: 'T' },
    ];
    for (const m of moves) {
      expect(locality(m)).toBeGreaterThanOrEqual(0);
      expect(locality(m)).toBeLessThanOrEqual(1);
      expect(cost(m)).toBeGreaterThanOrEqual(0);
      expect(cost(m)).toBeLessThanOrEqual(1);
    }
    // Locality ranks small moves smoother: LocalRotate(1) > WheelSwap(2) > PatternSwitch(3).
    expect(locality(moves[0]!)).toBeGreaterThan(locality(moves[1]!));
    expect(locality(moves[2]!)).toBeGreaterThan(locality(moves[1]!));
    expect(locality(moves[0]!)).toBeGreaterThan(locality(moves[2]!));
  });

  it('moveMagnitude matches the documented magnitudes (LR=1, PS=2, WS=2)', () => {
    expect(moveMagnitude({ kind: 'LocalRotate', wheel: 'A', delta: 1 })).toBe(1);
    expect(moveMagnitude({ kind: 'PatternSwitch', toPair: 'V·X' })).toBe(2);
    expect(moveMagnitude({ kind: 'WheelSwap', facet: 'COSMOLOGY', toWheel: 'T' })).toBe(2);
  });

  it('roughness ranks LocalRotate(1) < WheelSwap(2) < PatternSwitch(3)', () => {
    expect(roughness({ kind: 'LocalRotate', wheel: 'A', delta: 1 })).toBe(1);
    expect(roughness({ kind: 'WheelSwap', facet: 'COSMOLOGY', toWheel: 'T' })).toBe(2);
    expect(roughness({ kind: 'PatternSwitch', toPair: 'V·X' })).toBe(3);
  });

  it('materializationCost: LocalRotate 1, PatternSwitch 2, WheelSwap 2', () => {
    expect(materializationCost({ kind: 'LocalRotate', wheel: 'A', delta: 1 })).toBe(1);
    expect(materializationCost({ kind: 'PatternSwitch', toPair: 'V·X' })).toBe(2);
    expect(materializationCost({ kind: 'WheelSwap', facet: 'COSMOLOGY', toWheel: 'T' })).toBe(2);
  });

  it('ΔJ = J_new − J_old on a hand-constructed transition', () => {
    const s0 = initialState(reg);
    // C for a brand-new composite = 1.
    const move: Move = { kind: 'LocalRotate', wheel: 'A', delta: 1 };
    const s1 = applyMove(s0, move, reg);
    const visited = new Set<string>([compositeKey(s0, reg)]);
    const window = [compositeDomains(s0, reg)];
    const terms1 = evaluateMove(move, s1, window, visited, reg, DEFAULT_CONFIG);
    const terms0 = { C: 1, L: 1, T: 1, S: 0, J: DEFAULT_CONFIG.weights.gamma };
    expect(deltaJ(terms0, terms1)).toBeCloseTo(terms1.J - terms0.J, 10);

    // C=1 for the new composite (it is not in visited yet).
    expect(terms1.C).toBe(1);
    // L for a LocalRotate = 1 (smoothest move).
    expect(terms1.L).toBe(1);
    // S for a LocalRotate = 0 (cost 1 normalized → (1-1)/(2-1) = 0).
    expect(terms1.S).toBe(0);
    // J = α·1 + β·1 + γ·T − δ·0.
    const expectedJ =
      DEFAULT_CONFIG.weights.alpha * 1 +
      DEFAULT_CONFIG.weights.beta * 1 +
      DEFAULT_CONFIG.weights.gamma * terms1.T;
    expect(terms1.J).toBeCloseTo(expectedJ, 10);
  });

  it('C is 0 when the composite has already been visited', () => {
    const s0 = initialState(reg);
    const move: Move = { kind: 'LocalRotate', wheel: 'A', delta: 1 };
    const s1 = applyMove(s0, move, reg);
    // Pre-seed visited with the *new* composite key → C must be 0.
    const visited = new Set<string>([compositeKey(s0, reg), compositeKey(s1, reg)]);
    const window = [compositeDomains(s0, reg)];
    const terms = evaluateMove(move, s1, window, visited, reg, DEFAULT_CONFIG);
    expect(terms.C).toBe(0);
  });
});

// ----------------------------------------------------------------------------------
// Anneal loop: determinism, cooling, coverage
// ----------------------------------------------------------------------------------

describe('Layer 6 — anneal loop', () => {
  let reg: WheelRegistry;
  beforeAll(() => {
    reg = loadRegistry(REGISTRY_PATH);
  });

  it('determinism: same seed → identical steps/best/coverage', () => {
    const a = anneal(reg, SMALL_CONFIG, mulberry32(SMALL_CONFIG.seed));
    const b = anneal(reg, SMALL_CONFIG, mulberry32(SMALL_CONFIG.seed));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.coverage).toEqual(b.coverage);
    expect(a.best).toEqual(b.best);
  });

  it('determinism: different seed → different trajectory', () => {
    const a = anneal(reg, { ...SMALL_CONFIG, seed: 42 }, mulberry32(42));
    const b = anneal(reg, { ...SMALL_CONFIG, seed: 99 }, mulberry32(99));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('cooling: temperature decreases monotonically and stays ≥ T_min', () => {
    const run = anneal(reg, SMALL_CONFIG, mulberry32(SMALL_CONFIG.seed));
    let prev = Infinity;
    for (const step of run.steps) {
      expect(step.temperature).toBeGreaterThanOrEqual(SMALL_CONFIG.T_min - 1e-9);
      expect(step.temperature).toBeLessThanOrEqual(prev + 1e-12);
      prev = step.temperature;
    }
    // The run either reached T_min or used all steps.
    const last = run.steps[run.steps.length - 1]!;
    const usedAllSteps = run.steps.length === SMALL_CONFIG.steps + 1; // +1 for the initial step
    const reachedMin = last.temperature <= SMALL_CONFIG.T_min + 1e-9;
    expect(usedAllSteps || reachedMin).toBe(true);
  });

  it('coverage: distinct composites > 1 after a full run (exploration happens)', () => {
    const run = anneal(reg, SMALL_CONFIG, mulberry32(SMALL_CONFIG.seed));
    expect(run.coverage.distinctComposites).toBeGreaterThan(1);
    expect(run.coverage.totalSteps).toBeGreaterThan(1);
  });

  it('domain visits: the curriculum sees all three domains across the run', () => {
    const run = anneal(reg, SMALL_CONFIG, mulberry32(SMALL_CONFIG.seed));
    for (const d of ALL_DOMAINS_LIST) {
      expect(run.coverage.domainVisits[d]).toBeGreaterThan(0);
    }
  });

  it('the initial step is recorded as accepted with the baseline J', () => {
    const run = anneal(reg, SMALL_CONFIG, mulberry32(SMALL_CONFIG.seed));
    const step0 = run.steps[0]!;
    expect(step0.t).toBe(0);
    expect(step0.move).toBe('initial');
    expect(step0.accepted).toBe(true);
    expect(step0.deltaJ).toBe(0);
    // Baseline J = γ (tripartite-neutral seed, S=0).
    expect(step0.terms.J).toBeCloseTo(SMALL_CONFIG.weights.gamma, 10);
  });

  it('move probabilities sum to 1.0 (spec 0.65/0.25/0.10)', () => {
    const sum =
      MOVE_PROBABILITIES.LocalRotate + MOVE_PROBABILITIES.PatternSwitch + MOVE_PROBABILITIES.WheelSwap;
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

// ----------------------------------------------------------------------------------
// Facade + output schema + reproducibility
// ----------------------------------------------------------------------------------

describe('Layer 6 — facade + output schema + reproducibility', () => {
  it('generateSchedule round-trips the fixture → a valid CanonicalSchedule', () => {
    const schedule = runOnce(SMALL_CONFIG);
    expect(schedule.version).toBe('1.0.0');
    expect(schedule.generator).toBe('ttcl-scheduler-v1');
    expect(schedule.registry.registry).toBe('llull-default');
    expect(schedule.registry.wheels).toHaveLength(5);
    expect(schedule.registry.pairs).toHaveLength(10);
    expect(schedule.steps.length).toBeGreaterThan(0);
  });

  it('the assembled artifact validates against canonical-schedule-schema.json', () => {
    const schedule = runOnce(SMALL_CONFIG);
    const ajv = new Ajv({ allErrors: true, strict: true });
    const validate = ajv.compile(JSON.parse(readFileSync(OUTPUT_SCHEMA_PATH, 'utf8')));
    const ok = validate(schedule);
    if (!ok) {
      throw new Error(`schema validation failed: ${JSON.stringify(validate.errors)}`);
    }
    expect(ok).toBe(true);
  });

  it('serializeSchedule is canonical (same schedule → byte-identical JSON)', () => {
    const a = runOnce(SMALL_CONFIG);
    const b = runOnce(SMALL_CONFIG);
    expect(serializeSchedule(a)).toBe(serializeSchedule(b));
  });

  it('reproducibility: regenerating the checked-in fixture from the default seed is byte-identical', () => {
    // The checked-in artifact is generated with DEFAULT_CONFIG (seed 42). If the
    // fixture is present, regenerating must match it byte-for-byte; if it is
    // absent (first run, pre-build), regenerating must at least re-serialize
    // stably so the gate becomes meaningful once the artifact is committed.
    const generated = serializeSchedule(runOnce(DEFAULT_CONFIG));
    if (existsSync(ARTIFACT_PATH)) {
      const checkedIn = readFileSync(ARTIFACT_PATH, 'utf8');
      expect(generated).toBe(checkedIn);
    } else {
      const reparsed = JSON.parse(generated) as CanonicalSchedule;
      expect(serializeSchedule(reparsed)).toBe(generated);
    }
  }, 60000);
});

// ----------------------------------------------------------------------------------
// assembleSchedule + fingerprint helper sanity
// ----------------------------------------------------------------------------------

describe('Layer 6 — assembleSchedule', () => {
  it('assembles the artifact from a run + registry (mirrors facade output)', () => {
    const reg = loadRegistry(REGISTRY_PATH);
    const run = anneal(reg, SMALL_CONFIG, mulberry32(SMALL_CONFIG.seed));
    const assembled = assembleSchedule(run, reg);
    expect(assembled.initial).toEqual(run.initial);
    expect(assembled.steps).toEqual(run.steps);
    expect(assembled.best).toEqual(run.best);
    expect(assembled.coverage).toEqual(run.coverage);
  });
});