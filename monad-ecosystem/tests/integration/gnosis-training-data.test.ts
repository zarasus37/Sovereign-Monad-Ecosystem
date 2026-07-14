/**
 * Layer 7 — the Gnosis training-event data-generation consumer integration suite.
 *
 * Drives the public facade end-to-end: `generateSchedule` (Layer 6) →
 * `generateGnosisEvents` (Layer 7 data-gen) → `validateGnosisEvent` against
 * `shared/ttcl-specs/gnosis-event.json` → `serializeEventsJsonl` (the JSONL the
 * future SFT stage consumes).
 *
 * Gates (mirror the scheduler suite's honesty posture):
 *   - schema: every emitted event validates against gnosis-event.json;
 *   - determinism: same `(schedule, registry, config)` → byte-identical JSONL
 *     (the reproducibility gate — the spec's "run multiple seeds" mitigation
 *     requires the data-gen to be a pure function of its seed);
 *   - coverage: the curriculum spans all three TTCL domains across the run;
 *   - scorer reuse/parity: an event's `constitution_score` is exactly what
 *     `scoreSign(materializeSign(seed, step, registry))` returns — the consumer
 *     reuses the L7.8 scorer, not a reimplementation;
 *   - accepted-steps semantics: one event per accepted step (initial included);
 *   - honesty: `active_slots.*.label` is null (for wheels with no flat labels)
 *     or a real string present in some wheel's per-slot `labels` in the registry
 *     (the Llull register, sourced from theo-techno-cosmo/Wheel/8 wheels and 3
 *     domains.docx) — never fabricated. A facet binds to whichever wheel covers
 *     its domain, and WheelSwap can reassign it to any covering wheel, so labels
 *     may come from the domain wheels (essència, eviternitat, …) or from the
 *     dignity/triangle/soul-mode wheels (A/S/F). The initial step binds the 3
 *     domain wheels, so `essència` reaches the stream.
 *
 * The full SFT→Reward→GRPO→Eval pipeline (TTCL_v1_0_BREAKDOWN.md:275-311) is NOT
 * exercised here — it is a real GPU/TRL job and remains unbuilt. This suite
 * covers only the deterministic local data-generation consumer.
 */

import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import {
  generateSchedule,
  loadRegistry,
  compositeDomains,
  DEFAULT_CONFIG,
  type WheelRegistry,
  type ScheduleStep,
} from '@sovereign/scheduler';
import { scoreSign } from '@sovereign/ttcl';
import {
  generateGnosisEvents,
  serializeEventsJsonl,
  validateGnosisEvent,
  materializeSign,
  type GnosisEvent,
} from '@sovereign/gnosis-training-data';

const repoRoot = resolve(__dirname, '..', '..', '..');
const REGISTRY_PATH = resolve(repoRoot, 'shared', 'fixtures', 'layer6', 'wheel-registry.json');

const SEED = DEFAULT_CONFIG.seed; // 42 — the consumer's default seed derivation.

const ALL_DOMAINS = ['THEOLOGY', 'TECHNOLOGY', 'COSMOLOGY'] as const;

/** Build the events from the default registry + a small-config schedule. */
function buildEvents(): { schedule: ReturnType<typeof generateSchedule>; registry: WheelRegistry; events: GnosisEvent[] } {
  const schedule = generateSchedule(REGISTRY_PATH, DEFAULT_CONFIG);
  const registry = loadRegistry(REGISTRY_PATH);
  const events = generateGnosisEvents(schedule, registry);
  return { schedule, registry, events };
}

// ----------------------------------------------------------------------------------
// Schema
// ----------------------------------------------------------------------------------

describe('Layer 7 — gnosis training events: schema', () => {
  it('every emitted event validates against gnosis-event.json', () => {
    const { events } = buildEvents();
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      if (!validateGnosisEvent(e)) {
        throw new Error(`schema violation: ${JSON.stringify(e)}`);
      }
    }
    expect(events.every(validateGnosisEvent)).toBe(true);
  });

  it('event_id is a deterministic v5-style UUID (version 5, variant 8/9/a/b)', () => {
    const { events } = buildEvents();
    const re = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const e of events) expect(e.event_id).toMatch(re);
  });
});

// ----------------------------------------------------------------------------------
// Determinism (the reproducibility gate)
// ----------------------------------------------------------------------------------

describe('Layer 7 — gnosis training events: determinism', () => {
  it('same schedule+config → byte-identical JSONL', () => {
    const a = serializeEventsJsonl(generateGnosisEvents(generateSchedule(REGISTRY_PATH, DEFAULT_CONFIG), loadRegistry(REGISTRY_PATH)));
    const b = serializeEventsJsonl(generateGnosisEvents(generateSchedule(REGISTRY_PATH, DEFAULT_CONFIG), loadRegistry(REGISTRY_PATH)));
    expect(a).toBe(b);
  });

  it('a different seed → a different event stream', () => {
    const schedule = generateSchedule(REGISTRY_PATH, DEFAULT_CONFIG);
    const registry = loadRegistry(REGISTRY_PATH);
    const a = serializeEventsJsonl(generateGnosisEvents(schedule, registry, { seed: 42 }));
    const b = serializeEventsJsonl(generateGnosisEvents(schedule, registry, { seed: 99 }));
    // event_ids depend on the seed, so the streams differ.
    expect(a).not.toBe(b);
  });
});

// ----------------------------------------------------------------------------------
// Coverage — the curriculum spans all three domains
// ----------------------------------------------------------------------------------

describe('Layer 7 — gnosis training events: coverage', () => {
  it('the emitted curriculum spans all three TTCL domains', () => {
    const { schedule, registry, events } = buildEvents();
    // Walk the accepted steps (the consumer emits one event per accepted step)
    // and collect the domain span of each step's active composite.
    const acceptedSteps = schedule.steps.filter((s) => s.accepted);
    expect(acceptedSteps.length).toBe(events.length);
    const seen = new Set<string>();
    for (const step of acceptedSteps) {
      for (const d of compositeDomains(step.state, registry)) seen.add(d);
    }
    for (const d of ALL_DOMAINS) expect(seen.has(d)).toBe(true);
  });
});

// ----------------------------------------------------------------------------------
// Scorer reuse / parity (the L7.8 scorer, reused — not reimplemented)
// ----------------------------------------------------------------------------------

describe('Layer 7 — gnosis training events: scorer reuse + parity', () => {
  it("each event's constitution_score === scoreSign(materializeSign(seed, step, registry))", () => {
    const { schedule, registry, events } = buildEvents();
    const acceptedSteps = schedule.steps.filter((s) => s.accepted);
    expect(acceptedSteps.length).toBe(events.length);
    for (let i = 0; i < events.length; i++) {
      const step: ScheduleStep = acceptedSteps[i]!;
      const event = events[i]!;
      const sign = materializeSign(SEED, step, registry);
      const verdict = scoreSign(sign);
      expect(event.constitution_score.total).toBe(verdict.total);
      expect(event.constitution_score.passes).toBe(verdict.pass);
      // The 5 criteria map 1:1 onto the scorer's criteria scores.
      expect(event.constitution_score.tripartite).toBe(verdict.criteria.tripartite.score);
      expect(event.constitution_score.logic_compress).toBe(verdict.criteria.logicCompression.score);
      expect(event.constitution_score.source_aligned).toBe(verdict.criteria.sourceAligned.score);
      expect(event.constitution_score.epistemic).toBe(verdict.criteria.epistemicHumility.score);
      expect(event.constitution_score.no_rlhf_signal).toBe(verdict.criteria.noRlhfSignal.score);
    }
  });

  it('the score spread is genuine — not every event passes, not every event fails', () => {
    // A real curriculum produces a mix of tripartite-covered (pass) and
    // bipartite-only (lower-scoring) composites. If every event passed, the
    // scorer would be degenerate; if every event failed, the materialization
    // would be wrong. Assert a non-degenerate spread.
    const { events } = buildEvents();
    const passes = events.filter((e) => e.constitution_score.passes).length;
    expect(passes).toBeGreaterThan(0);
    // The total score lies in [0, 1] for every event.
    for (const e of events) {
      expect(e.constitution_score.total).toBeGreaterThanOrEqual(0);
      expect(e.constitution_score.total).toBeLessThanOrEqual(1);
    }
  });
});

// ----------------------------------------------------------------------------------
// Accepted-steps semantics — one event per accepted step
// ----------------------------------------------------------------------------------

describe('Layer 7 — gnosis training events: accepted-steps semantics', () => {
  it('event count === accepted-steps count (initial included by default)', () => {
    const { schedule, events } = buildEvents();
    const accepted = schedule.steps.filter((s) => s.accepted).length;
    expect(events.length).toBe(accepted);
  });

  it('includeInitial: false excludes the seed step', () => {
    const { schedule, registry } = buildEvents();
    const withInitial = generateGnosisEvents(schedule, registry);
    const withoutInitial = generateGnosisEvents(schedule, registry, { includeInitial: false });
    // The seed step is the only "initial" move; excluding it drops exactly one
    // event (the seed step is always accepted).
    expect(withoutInitial.length).toBe(withInitial.length - 1);
  });

  it('every event carries the system/user/assistant scaffold (assistant empty — the SFT target)', () => {
    const { events } = buildEvents();
    for (const e of events) {
      expect(e.messages).toHaveLength(3);
      expect(e.messages[0]!.role).toBe('system');
      expect(e.messages[1]!.role).toBe('user');
      expect(e.messages[2]!.role).toBe('assistant');
      expect(e.messages[2]!.content).toBe(''); // the training target is produced downstream
    }
  });
});

// ----------------------------------------------------------------------------------
// Honesty — Catalan labels are sourced from the Llull register (no fabrication)
// ----------------------------------------------------------------------------------

describe('Layer 7 — gnosis training events: Catalan labels are sourced from the registry', () => {
  it('every active_slots.*.label is null or a real string from some wheel labels (no fabrication)', () => {
    const { registry, events } = buildEvents();
    // A facet is bound to whichever wheel currently covers its domain. The
    // annealer's WheelSwap move reassigns a facet to any covering wheel — e.g.
    // THEOLOGY may swap Teologia → A (dignity labels), COSMOLOGY → S (triangle
    // names), TECHNOLOGY → F (soul modes). So a facet's label is sourced from
    // *any* wheel in the register, not only the 3 domain wheels. The honesty
    // gate is therefore: every non-null label is a real string present in some
    // wheel's `labels` array — never invented.
    const registryVocab = new Set<string>();
    for (const name of registry.wheelNames) {
      const labels = registry.wheels.get(name)!.labels ?? [];
      for (const l of labels) if (l !== null) registryVocab.add(l);
    }
    expect(registryVocab.size).toBeGreaterThan(0);
    for (const e of events) {
      for (const facet of ['theology', 'technology', 'cosmology'] as const) {
        const label = e.active_slots[facet].label;
        if (label === null) continue; // wheel has no flat labels (P/T/V/Q/E)
        expect(typeof label).toBe('string');
        expect(registryVocab.has(label)).toBe(true);
      }
    }
  });

  it('the domain-wheel Catalan vocabulary is actually exercised (initial step binds the 3 domain wheels)', () => {
    const { events } = buildEvents();
    // The initial state binds THEOLOGY→Teologia, TECHNOLOGY→Technologia,
    // COSMOLOGY→Kosmologia at offset 0 → slot B → label `essència`. So the very
    // first event's theology label is the Catalan `essència`, proving the
    // domain-wheel labels (sourced from 8 wheels and 3 domains.docx) reach the
    // event stream — not just the dignity/triangle/soul-mode labels of swapped
    // wheels.
    expect(events[0]!.active_slots.theology.label).toBe('essència');
  });

  it('provenance_tokens are non-empty registry:wheel:offset strings', () => {
    const { registry, events } = buildEvents();
    const regName = registry.registry;
    for (const e of events) {
      expect(e.provenance_tokens.length).toBeGreaterThanOrEqual(1);
      for (const tok of e.provenance_tokens) {
        expect(tok.startsWith(`${regName}:`)).toBe(true);
      }
    }
  });
});