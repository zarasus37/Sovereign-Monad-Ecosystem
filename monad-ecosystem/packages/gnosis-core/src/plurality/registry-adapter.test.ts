/**
 * Tests for the external REST registry adapter.
 */

import { describe, it, expect } from 'vitest';
import type { AgentProfile } from '@sovereign/types';

import {
  adaptRegistryResponse,
  getRegistryAdapter,
  listRegistryAdapters,
  type RegistryAdapterConfig,
} from './registry-adapter.js';

const defaults: RegistryAdapterConfig = {
  name: 'generic-array',
  path: undefined,
};

function minimalExternalRecord(overrides: Partial<AgentProfile> = {}) {
  return {
    agentId: overrides.agentId ?? 'ext-1',
    name: overrides.name ?? 'External Agent',
    role: overrides.role ?? 'ecosystem-native',
    archetype: overrides.archetype ?? 'explorer',
    bigFive: overrides.bigFive ?? {
      conscientiousness: 0.6,
      neuroticism: 0.4,
      openness: 0.7,
      agreeableness: 0.5,
      extraversion: 0.5,
    },
    hexaco: overrides.hexaco ?? { honestyHumility: 0.6 },
    hoganRisk: overrides.hoganRisk ?? {
      excitability: 0.3,
      skepticism: 0.5,
      cautious: 0.5,
      independent: 0.6,
      mischievous: 0.2,
    },
    validationTier: overrides.validationTier ?? 1,
    riskEnvelope: overrides.riskEnvelope ?? {
      maxPositionFraction: 0.1,
      maxDrawdownThreshold: 0.03,
      minEdgeBps: 12,
      kellyFraction: 0.25,
      capitalAuthorized: false,
    },
    registeredAt: overrides.registeredAt ?? '2026-06-26T00:00:00.000Z',
  };
}

describe('listRegistryAdapters', () => {
  it('exposes the built-in adapter names', () => {
    const names = listRegistryAdapters();
    expect(names).toContain('direct');
    expect(names).toContain('generic-array');
    expect(names).toContain('wrapped-agent');
    expect(names).toContain('agents-field');
  });
});

describe('getRegistryAdapter', () => {
  it('returns a function for a known adapter', () => {
    expect(typeof getRegistryAdapter('direct')).toBe('function');
    expect(typeof getRegistryAdapter('generic-array')).toBe('function');
  });

  it('throws for an unknown adapter', () => {
    expect(() => getRegistryAdapter('no-such-adapter')).toThrow(/Unknown registry adapter/);
  });
});

describe('direct adapter', () => {
  it('returns the body unchanged when it is an AgentProfile array', () => {
    const body = [minimalExternalRecord()];
    const result = adaptRegistryResponse(body, { name: 'direct' });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('ext-1');
  });

  it('throws when the body is not an array', () => {
    expect(() => adaptRegistryResponse({ agents: [] }, { name: 'direct' })).toThrow(
      /direct adapter expected AgentProfile\[\]/
    );
  });
});

describe('generic-array adapter', () => {
  it('maps a plain array of records into AgentProfile[]', () => {
    const body = [minimalExternalRecord({ agentId: 'a' }), minimalExternalRecord({ agentId: 'b' })];
    const result = adaptRegistryResponse(body, defaults);
    expect(result).toHaveLength(2);
    expect(result[0].agentId).toBe('a');
    expect(result[1].agentId).toBe('b');
  });

  it('fills sensible defaults for missing fields', () => {
    const body = [{ agentId: 'sparse' }];
    const result = adaptRegistryResponse(body, defaults);
    expect(result[0].agentId).toBe('sparse');
    expect(result[0].name).toBe('Unnamed Agent');
    expect(result[0].role).toBe('ecosystem-native');
    expect(result[0].archetype).toBeUndefined();
    expect(result[0].bigFive.conscientiousness).toBe(0.5);
    expect(result[0].validationTier).toBe(0);
    expect(result[0].riskEnvelope.capitalAuthorized).toBe(false);
  });

  it('normalizes string roles and archetypes', () => {
    const body = [
      {
        agentId: 'norm',
        role: 'Cortex',
        archetype: 'GOVERNOR',
      },
    ];
    const result = adaptRegistryResponse(body, defaults);
    expect(result[0].role).toBe('cortex');
    expect(result[0].archetype).toBe('governor');
  });

  it('clamps psychometric values to [0, 1]', () => {
    const body = [
      {
        agentId: 'clamped',
        bigFive: { openness: 1.5, conscientiousness: -0.2 },
      },
    ];
    const result = adaptRegistryResponse(body, defaults);
    expect(result[0].bigFive.openness).toBe(1);
    expect(result[0].bigFive.conscientiousness).toBe(0);
  });

  it('throws when the body is not an array and no path is provided', () => {
    expect(() => adaptRegistryResponse({ data: [] }, defaults)).toThrow(
      /expected the response body to be an array/
    );
  });

  it('extracts records from a configured JSON path', () => {
    const body = { data: { agents: [minimalExternalRecord({ agentId: 'nested' })] } };
    const result = adaptRegistryResponse(body, {
      ...defaults,
      path: 'data.agents',
    });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('nested');
  });

  it('supports bracket index notation in paths', () => {
    const body = { results: [[{ agentId: 'bracket' }]] };
    const result = adaptRegistryResponse(body, {
      ...defaults,
      path: 'results[0]',
    });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('bracket');
  });
});

describe('agents-field adapter', () => {
  it('reads from the `agents` field by default', () => {
    const body = {
      agents: [minimalExternalRecord({ agentId: 'field' })],
      meta: { total: 1 },
    };
    const result = adaptRegistryResponse(body, { name: 'agents-field' });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('field');
  });

  it('honors a custom path', () => {
    const body = {
      data: [minimalExternalRecord({ agentId: 'custom' })],
    };
    const result = adaptRegistryResponse(body, { name: 'agents-field', path: 'data' });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('custom');
  });
});

describe('wrapped-agent adapter', () => {
  it('unwraps `{ agent: { ... } }` records', () => {
    const body = {
      agents: [
        { agent: { agentId: 'wrapped', role: 'hepar' } },
      ],
    };
    const result = adaptRegistryResponse(body, { name: 'wrapped-agent' });
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe('wrapped');
    expect(result[0].role).toBe('hepar');
  });

  it('falls back to the top-level item when no `agent` wrapper exists', () => {
    const body = {
      agents: [{ agentId: 'plain' }],
    };
    const result = adaptRegistryResponse(body, { name: 'wrapped-agent' });
    expect(result[0].agentId).toBe('plain');
  });
});

describe('defaults merging', () => {
  it('merges static defaults into every mapped profile', () => {
    const body = [{ agentId: 'd' }];
    const result = adaptRegistryResponse(body, {
      ...defaults,
      defaults: { validationTier: 2 },
    });
    expect(result[0].validationTier).toBe(2);
  });
});
