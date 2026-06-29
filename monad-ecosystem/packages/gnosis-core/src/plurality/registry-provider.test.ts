/**
 * Unit tests for the HTTP-backed agent registry provider.
 */

import { describe, it, expect, vi } from 'vitest';
import type { AgentProfile } from '@sovereign/types';

import { createAgentRegistryProvider } from './registry-provider.js';

function makeFetch(
  response: { ok: boolean; status: number; statusText: string; json: unknown },
  delayMs = 0
): typeof fetch {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    // Respect abort signals in tests so timeout behavior is realistic.
    if (init?.signal?.aborted) {
      const abortErr = new Error('AbortError');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    // Check again after the delay in case the signal was aborted while waiting.
    if (init?.signal?.aborted) {
      const abortErr = new Error('AbortError');
      abortErr.name = 'AbortError';
      throw abortErr;
    }
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      json: async () => response.json,
    } as Response;
  });
}

const profile: AgentProfile = {
  agentId: 'agent-explorer-1',
  name: 'Explorer One',
  role: 'ecosystem-native',
  archetype: 'explorer',
  bigFive: {
    conscientiousness: 0.5,
    neuroticism: 0.5,
    openness: 0.8,
    agreeableness: 0.5,
    extraversion: 0.5,
  },
  hexaco: { honestyHumility: 0.6 },
  hoganRisk: {
    excitability: 0.3,
    skepticism: 0.5,
    cautious: 0.5,
    independent: 0.6,
    mischievous: 0.2,
  },
  validationTier: 1,
  riskEnvelope: {
    maxPositionFraction: 0.1,
    maxDrawdownThreshold: 0.03,
    minEdgeBps: 12,
    kellyFraction: 0.25,
    capitalAuthorized: false,
  },
  registeredAt: '2026-06-26T00:00:00.000Z',
};

describe('createAgentRegistryProvider', () => {
  it('fetches profiles from the configured URL', async () => {
    const fetch = makeFetch({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: [profile],
    });

    const provider = createAgentRegistryProvider({
      url: 'https://registry.test/agents',
      fetch,
    });

    const profiles = await provider();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://registry.test/agents', {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal: expect.any(AbortSignal),
    });
    expect(profiles).toHaveLength(1);
    expect(profiles[0].agentId).toBe('agent-explorer-1');
  });

  it('sends the bearer token when configured', async () => {
    const fetch = makeFetch({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: [profile],
    });

    const provider = createAgentRegistryProvider({
      url: 'https://registry.test/agents',
      token: 'secret-token',
      fetch,
    });

    await provider();
    expect(fetch).toHaveBeenCalledWith('https://registry.test/agents', {
      method: 'GET',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer secret-token',
      },
      signal: expect.any(AbortSignal),
    });
  });

  it('throws on non-OK responses', async () => {
    const fetch = makeFetch({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: { error: 'down' },
    });

    const provider = createAgentRegistryProvider({
      url: 'https://registry.test/agents',
      fetch,
    });

    await expect(provider()).rejects.toThrow(
      'Agent registry returned 503 Service Unavailable'
    );
  });

  it('throws when the response body is not an array', async () => {
    const fetch = makeFetch({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: { agents: [] },
    });

    const provider = createAgentRegistryProvider({
      url: 'https://registry.test/agents',
      fetch,
    });

    await expect(provider()).rejects.toThrow(
      'Expected AgentProfile[] from registry, received object'
    );
  });

  it('throws a timeout error when the request exceeds timeoutMs', async () => {
    const fetch = makeFetch(
      { ok: true, status: 200, statusText: 'OK', json: [profile] },
      100
    );

    const provider = createAgentRegistryProvider({
      url: 'https://registry.test/agents',
      timeoutMs: 10,
      fetch,
    });

    await expect(provider()).rejects.toThrow(
      'Agent registry request timed out after 10ms'
    );
  });
});
