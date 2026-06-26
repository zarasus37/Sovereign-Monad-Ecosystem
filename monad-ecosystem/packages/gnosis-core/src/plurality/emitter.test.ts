/**
 * Tests for the Plurality Dove Emitter.
 *
 * Strategy: mock the EventBus and verify that Axiom 9 thresholds produce the
 * expected `gnosis.plurality.snapshot` and `dove.signal.tier*` emissions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  AgentProfile,
  DoveSignal,
  DriftCategory,
  PopulationDiversitySnapshot,
} from '@sovereign/types';
import type { EventBus } from '@sovereign/bus';

import {
  PluralityDoveEmitter,
  evaluatePluralitySignals,
  type ActiveSignalState,
} from './emitter.js';

function makeProfile(archetype: AgentProfile['archetype']): AgentProfile {
  return {
    agentId: `agent-${Math.random().toString(36).slice(2)}`,
    name: 'Test Agent',
    role: 'ecosystem-native',
    archetype,
    bigFive: {
      conscientiousness: 0.5,
      neuroticism: 0.5,
      openness: 0.5,
      agreeableness: 0.5,
      extraversion: 0.5,
    },
    hexaco: { honestyHumility: 0.5 },
    hoganRisk: {
      excitability: 0.5,
      skepticism: 0.5,
      cautious: 0.5,
      independent: 0.5,
      mischievous: 0.5,
    },
    validationTier: 1,
    riskEnvelope: {
      maxPositionFraction: 0.1,
      maxDrawdownThreshold: 0.03,
      minEdgeBps: 12,
      kellyFraction: 0.25,
      capitalAuthorized: false,
    },
    registeredAt: new Date().toISOString(),
  };
}

function mockBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    onLayer: vi.fn(),
    shutdown: vi.fn(),
    listenerCount: 0,
  } as unknown as EventBus;
}

type EmitCall = [
  type: string,
  layer: string,
  payload: unknown,
  options?: { source?: string; severity?: string; correlationId?: string },
];

function emittedCalls(bus: EventBus): EmitCall[] {
  return (bus.emit as ReturnType<typeof vi.fn>).mock.calls as EmitCall[];
}

function extractDoveSignals(bus: EventBus): DoveSignal[] {
  return emittedCalls(bus)
    .filter(
      (call) =>
        call[0] === 'dove.signal.tier1' ||
        call[0] === 'dove.signal.tier2' ||
        call[0] === 'dove.signal.tier3'
    )
    .map((call) => call[2] as DoveSignal);
}

function extractSnapshotEvents(bus: EventBus): PopulationDiversitySnapshot[] {
  return emittedCalls(bus)
    .filter((call) => call[0] === 'gnosis.plurality.snapshot')
    .map((call) => call[2] as PopulationDiversitySnapshot);
}

describe('PluralityDoveEmitter', () => {
  let bus: EventBus;
  let emitter: PluralityDoveEmitter;

  beforeEach(() => {
    bus = mockBus();
    emitter = new PluralityDoveEmitter({ bus, source: 'test-emitter' });
  });

  it('emits gnosis.plurality.snapshot on every observation', () => {
    emitter.observe([makeProfile('explorer')]);
    emitter.observe([makeProfile('executor')]);

    expect(extractSnapshotEvents(bus).length).toBe(2);
  });

  it('emits personality.diversity.healthy (tier 1) after two plural + balanced snapshots', () => {
    const plural = [
      makeProfile('explorer'),
      makeProfile('executor'),
      makeProfile('governor'),
      makeProfile('mediator'),
      makeProfile('chronicler'),
      makeProfile('synthesizer'),
    ];

    emitter.observe(plural);
    emitter.observe(plural);

    const doveSignals = extractDoveSignals(bus);
    expect(doveSignals.length).toBe(1);
    expect(doveSignals[0].tier).toBe(1);
    expect(doveSignals[0].driftCategory).toBe('personality.diversity.healthy');
  });

  it('emits monoculture.formation (tier 2) when minRepresentationRatio drops below 0.1', () => {
    // 11 executors + 1 explorer => min=0, max=11 => ratio=0 < 0.1
    const monoculture: AgentProfile[] = [
      ...Array.from({ length: 11 }, () => makeProfile('executor')),
      makeProfile('explorer'),
    ];

    emitter.observe(monoculture);

    const doveSignals = extractDoveSignals(bus);
    expect(doveSignals.length).toBe(1);
    expect(doveSignals[0].tier).toBe(2);
    expect(doveSignals[0].driftCategory).toBe('monoculture.formation');
  });

  it('emits monoculture.formation (tier 3) after two consecutive zero-representation snapshots', () => {
    const fullMonoculture = Array.from({ length: 10 }, () =>
      makeProfile('executor')
    );

    emitter.observe(fullMonoculture);
    emitter.observe(fullMonoculture);

    const doveSignals = extractDoveSignals(bus);
    expect(doveSignals.length).toBe(3);
    expect(doveSignals[0].tier).toBe(2);
    expect(doveSignals[0].driftCategory).toBe('monoculture.formation');
    expect(doveSignals[1].tier).toBe(2);
    expect(doveSignals[1].driftCategory).toBe('participation.diversity.low');
    expect(doveSignals[2].tier).toBe(3);
    expect(doveSignals[2].driftCategory).toBe('monoculture.formation');
  });

  it('emits monoculture.formation (tier 2) when a single archetype exceeds 60% of the population', () => {
    const dominant = [
      makeProfile('executor'),
      makeProfile('executor'),
      makeProfile('explorer'),
    ];

    emitter.observe(dominant);

    const doveSignals = extractDoveSignals(bus);
    expect(doveSignals.length).toBe(1);
    expect(doveSignals[0].tier).toBe(2);
    expect(doveSignals[0].driftCategory).toBe('monoculture.formation');
    expect(doveSignals[0].description).toContain('60%');
  });

  it('emits participation.diversity.low (tier 2) when low diversity persists across two snapshots', () => {
    // Extremely skewed but all six archetypes present: diversityIndex < 0.6 and
    // minRepresentationRatio < 0.1, so monoculture also fires. Verify both
    // signals are emitted according to the spec.
    const lowDiversity: AgentProfile[] = [
      ...Array.from({ length: 20 }, () => makeProfile('executor')),
      makeProfile('explorer'),
      makeProfile('governor'),
      makeProfile('mediator'),
      makeProfile('chronicler'),
      makeProfile('synthesizer'),
    ];

    emitter.observe(lowDiversity);
    emitter.observe(lowDiversity);

    const doveSignals = extractDoveSignals(bus);
    const categories = doveSignals.map((s) => s.driftCategory);

    expect(doveSignals.length).toBe(2);
    expect(categories).toContain('monoculture.formation');
    expect(categories).toContain('participation.diversity.low');
    expect(
      doveSignals.some(
        (s) =>
          s.driftCategory === 'participation.diversity.low' && s.tier === 2
      )
    ).toBe(true);
  });

  it('does not emit Dove signals for an empty population', () => {
    emitter.observe([]);
    emitter.observe([]);

    const doveSignals = extractDoveSignals(bus);
    expect(doveSignals.length).toBe(0);
  });

  it('suppresses duplicate emissions while a condition persists', () => {
    const fullMonoculture = Array.from({ length: 10 }, () => makeProfile('executor'));

    emitter.observe(fullMonoculture);
    emitter.observe(fullMonoculture);
    emitter.observe(fullMonoculture);

    const doveSignals = extractDoveSignals(bus);
    expect(doveSignals.length).toBe(3);
  });

  it('uses the configured source on emitted events', () => {
    emitter.observe([makeProfile('explorer')]);

    const [firstCall] = emittedCalls(bus);
    expect(firstCall[3]?.source).toBe('test-emitter');
  });
});

describe('evaluatePluralitySignals (pure)', () => {
  it('returns no signals on the first plural snapshot', () => {
    const snapshot = buildSnapshot(
      {
        diversityIndex: 0.95,
        minRepresentationRatio: 1,
        isPlural: true,
        dominantArchetype: null,
        archetypeDistribution: {
          explorer: 1,
          executor: 1,
          governor: 1,
          mediator: 1,
          chronicler: 1,
          synthesizer: 1,
        },
      },
      { populationSize: 6 }
    );

    const result = evaluatePluralitySignals(snapshot, null, new Map());
    expect(result.signals.length).toBe(0);
  });

  it('emits monoculture.formation (tier 2) on the first zero-representation snapshot', () => {
    const snapshot = buildSnapshot(
      {
        diversityIndex: 0,
        minRepresentationRatio: 0,
        isPlural: false,
        dominantArchetype: 'executor',
        archetypeDistribution: {
          explorer: 0,
          executor: 10,
          governor: 0,
          mediator: 0,
          chronicler: 0,
          synthesizer: 0,
        },
      },
      { populationSize: 10 }
    );

    const result = evaluatePluralitySignals(snapshot, null, new Map());
    expect(result.signals.length).toBe(1);
    expect(result.signals[0].tier).toBe(2);
    expect(result.signals[0].driftCategory).toBe('monoculture.formation');
  });

  it('emits participation.diversity.low (tier 2) after two low-diversity snapshots', () => {
    const low = buildSnapshot(
      {
        diversityIndex: 0.4,
        minRepresentationRatio: 0.3,
        isPlural: false,
        dominantArchetype: 'explorer',
        archetypeDistribution: {
          explorer: 3,
          executor: 3,
          governor: 3,
          mediator: 0,
          chronicler: 0,
          synthesizer: 0,
        },
      },
      { populationSize: 9 }
    );

    const result = evaluatePluralitySignals(low, low, new Map());
    const signal = result.signals.find(
      (s) => s.driftCategory === 'participation.diversity.low'
    );
    expect(signal).toBeDefined();
    expect(signal!.tier).toBe(2);
  });

  it('emits personality.diversity.healthy (tier 1) after two plural snapshots', () => {
    const healthy = buildSnapshot(
      {
        diversityIndex: 0.95,
        minRepresentationRatio: 0.5,
        isPlural: true,
        dominantArchetype: 'explorer',
        archetypeDistribution: {
          explorer: 4,
          executor: 2,
          governor: 2,
          mediator: 2,
          chronicler: 2,
          synthesizer: 2,
        },
      },
      { populationSize: 14 }
    );

    const result = evaluatePluralitySignals(healthy, healthy, new Map());
    const signal = result.signals.find(
      (s) => s.driftCategory === 'personality.diversity.healthy'
    );
    expect(signal).toBeDefined();
    expect(signal!.tier).toBe(1);
  });

  it('clears an active signal when the condition resolves', () => {
    const healthy = buildSnapshot(
      {
        diversityIndex: 0.95,
        minRepresentationRatio: 0.5,
        isPlural: true,
        dominantArchetype: null,
        archetypeDistribution: {
          explorer: 3,
          executor: 3,
          governor: 3,
          mediator: 3,
          chronicler: 2,
          synthesizer: 2,
        },
      },
      { populationSize: 16 }
    );

    const active = new Map<DriftCategory, ActiveSignalState>([
      [
        'participation.diversity.low',
        { tier: 2, driftCategory: 'participation.diversity.low', snapshotId: 'old' },
      ],
    ]);

    const result = evaluatePluralitySignals(healthy, null, active);
    expect(result.signals.length).toBe(0);
    expect(result.nextActiveSignals.has('participation.diversity.low')).toBe(false);
  });

  it('emits a rising-edge signal when an active signal changes tier', () => {
    // Five archetypes present equally => diversityIndex is high (not low),
    // but one archetype is absent => minRepresentationRatio = 0.
    const zeroRatio = buildSnapshot(
      {
        diversityIndex: 0.9,
        minRepresentationRatio: 0,
        isPlural: true,
        dominantArchetype: null,
        archetypeDistribution: {
          explorer: 1,
          executor: 1,
          governor: 1,
          mediator: 1,
          chronicler: 1,
          synthesizer: 0,
        },
      },
      { populationSize: 5 }
    );

    const active = new Map<DriftCategory, ActiveSignalState>([
      [
        'monoculture.formation',
        { tier: 2, driftCategory: 'monoculture.formation', snapshotId: 'old' },
      ],
    ]);

    const result = evaluatePluralitySignals(zeroRatio, zeroRatio, active);
    expect(result.signals.length).toBe(1);
    expect(result.signals[0].tier).toBe(3);
    expect(result.signals[0].driftCategory).toBe('monoculture.formation');
  });
});

function buildSnapshot(
  metricsOverrides: Partial<PopulationDiversitySnapshot['metrics']>,
  snapshotOverrides: { populationSize: number; threshold?: number }
): PopulationDiversitySnapshot {
  const defaults: PopulationDiversitySnapshot['metrics'] = {
    archetypeDistribution: {
      explorer: 0,
      executor: 0,
      governor: 0,
      mediator: 0,
      chronicler: 0,
      synthesizer: 0,
    },
    diversityIndex: 0,
    minRepresentationRatio: 0,
    dominantArchetype: null,
    isPlural: false,
  };

  return {
    snapshotId: 'snap-test',
    generatedAt: '2026-06-26T00:00:00.000Z',
    populationSize: snapshotOverrides.populationSize,
    metrics: { ...defaults, ...metricsOverrides },
    threshold: snapshotOverrides.threshold ?? 0.6,
  };
}
