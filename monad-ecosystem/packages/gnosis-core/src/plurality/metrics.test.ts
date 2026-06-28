import { describe, it, expect } from 'vitest';
import type { AgentProfile } from '@sovereign/types';

import {
  calculateArchetypeDistribution,
  shannonEntropy,
  normalizedShannonEntropy,
  calculateDiversityMetrics,
  calculatePopulationDiversitySnapshot,
} from './distribution.js';

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

describe('calculateArchetypeDistribution', () => {
  it('counts agents per archetype', () => {
    const profiles: AgentProfile[] = [
      makeProfile('explorer'),
      makeProfile('explorer'),
      makeProfile('executor'),
    ];

    const distribution = calculateArchetypeDistribution(profiles);

    expect(distribution.explorer).toBe(2);
    expect(distribution.executor).toBe(1);
    expect(distribution.governor).toBe(0);
  });

  it('ignores profiles without an archetype', () => {
    const profiles: AgentProfile[] = [
      makeProfile('explorer'),
      makeProfile(undefined),
    ];

    const distribution = calculateArchetypeDistribution(profiles);

    expect(distribution.explorer).toBe(1);
    const total = Object.values(distribution).reduce((sum, c) => sum + c, 0);
    expect(total).toBe(1);
  });
});

describe('shannonEntropy', () => {
  it('is zero for a monoculture', () => {
    const distribution = {
      explorer: 10,
      executor: 0,
      governor: 0,
      mediator: 0,
      chronicler: 0,
      synthesizer: 0,
    };
    expect(shannonEntropy(distribution)).toBe(0);
  });

  it('is maximal for a uniform distribution', () => {
    const distribution = {
      explorer: 1,
      executor: 1,
      governor: 1,
      mediator: 1,
      chronicler: 1,
      synthesizer: 1,
    };
    expect(shannonEntropy(distribution)).toBeCloseTo(Math.log(6), 10);
  });
});

describe('normalizedShannonEntropy', () => {
  it('normalizes zero entropy to zero', () => {
    expect(normalizedShannonEntropy(0, 6)).toBe(0);
  });

  it('normalizes maximal entropy to one', () => {
    expect(normalizedShannonEntropy(Math.log(6), 6)).toBeCloseTo(1, 10);
  });
});

describe('calculateDiversityMetrics', () => {
  it('reports monoculture as non-plural', () => {
    const profiles: AgentProfile[] = Array.from({ length: 10 }, () =>
      makeProfile('executor')
    );

    const metrics = calculateDiversityMetrics(profiles);

    expect(metrics.diversityIndex).toBe(0);
    expect(metrics.isPlural).toBe(false);
    expect(metrics.dominantArchetype).toBe('executor');
    expect(metrics.minRepresentationRatio).toBe(0);
  });

  it('reports uniform distribution as plural', () => {
    const profiles: AgentProfile[] = [
      makeProfile('explorer'),
      makeProfile('executor'),
      makeProfile('governor'),
      makeProfile('mediator'),
      makeProfile('chronicler'),
      makeProfile('synthesizer'),
    ];

    const metrics = calculateDiversityMetrics(profiles);

    expect(metrics.diversityIndex).toBeCloseTo(1, 10);
    expect(metrics.isPlural).toBe(true);
    expect(metrics.minRepresentationRatio).toBe(1);
  });

  it('returns zero metrics for an empty population', () => {
    const metrics = calculateDiversityMetrics([]);

    expect(metrics.diversityIndex).toBe(0);
    expect(metrics.isPlural).toBe(false);
    expect(metrics.dominantArchetype).toBeNull();
    expect(metrics.minRepresentationRatio).toBe(0);
  });

  it('respects a custom threshold', () => {
    const profiles: AgentProfile[] = [
      makeProfile('explorer'),
      makeProfile('executor'),
      makeProfile('governor'),
    ];

    const highThreshold = calculateDiversityMetrics(profiles, 0.95);
    const lowThreshold = calculateDiversityMetrics(profiles, 0.5);

    expect(highThreshold.isPlural).toBe(false);
    expect(lowThreshold.isPlural).toBe(true);
  });
});

describe('calculatePopulationDiversitySnapshot', () => {
  it('produces a snapshot with explicit ids and timestamps', () => {
    const profiles: AgentProfile[] = [
      makeProfile('explorer'),
      makeProfile('executor'),
    ];

    const snapshot = calculatePopulationDiversitySnapshot(
      profiles,
      0.6,
      'snap-001',
      '2026-06-26T00:00:00.000Z'
    );

    expect(snapshot.snapshotId).toBe('snap-001');
    expect(snapshot.generatedAt).toBe('2026-06-26T00:00:00.000Z');
    expect(snapshot.populationSize).toBe(2);
    expect(snapshot.threshold).toBe(0.6);
    expect(snapshot.metrics.dominantArchetype).toBeNull();
  });

  it('generates ids and timestamps when omitted', () => {
    const profiles: AgentProfile[] = [makeProfile('explorer')];

    const snapshot = calculatePopulationDiversitySnapshot(profiles);

    expect(snapshot.snapshotId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(snapshot.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
