/**
 * External REST API adapter for the Plurality scheduler.
 *
 * The scheduler's native registry provider expects the registry to return
 * `AgentProfile[]` directly. Real external agent registries rarely match that
 * exact shape. This module provides lightweight, declarative adapters that
 * map arbitrary REST response shapes into the canonical `AgentProfile[]`
 * contract from `@sovereign/types`.
 *
 * Adapters are selected via the `AGENT_REGISTRY_ADAPTER` environment variable.
 * Each adapter is a pure function that transforms the parsed response body.
 *
 * Example env wiring:
 *   PLURALITY_PROVIDER=registry
 *   AGENT_REGISTRY_URL=https://registry.example.com/api/v1/agents
 *   AGENT_REGISTRY_ADAPTER=generic-array
 *   AGENT_REGISTRY_ADAPTER_PATH=data.agents
 */

import type { AgentProfile, AgentArchetype, AgentRole, ValidationTier } from '@sovereign/types';

import { createAgentRegistryProvider } from './registry-provider.js';

/** Extracted intermediate row from an external API before mapping to AgentProfile. */
export interface ExternalAgentRecord {
  readonly agentId?: string;
  readonly name?: string;
  readonly role?: string;
  readonly archetype?: string;
  readonly bigFive?: Partial<AgentProfile['bigFive']>;
  readonly hexaco?: Partial<AgentProfile['hexaco']>;
  readonly hoganRisk?: Partial<AgentProfile['hoganRisk']>;
  readonly validationTier?: number;
  readonly riskEnvelope?: Partial<AgentProfile['riskEnvelope']>;
  readonly registeredAt?: string;
  readonly [key: string]: unknown;
}

/** Adapter configuration received from environment variables and CLI setup. */
export interface RegistryAdapterConfig {
  /** Adapter name. */
  readonly name: string;
  /** Optional JSON path to the array of records (dot/bracket notation, e.g. `data.agents`). */
  readonly path?: string;
  /** Optional static values to merge into every mapped profile. */
  readonly defaults?: Partial<AgentProfile>;
}

/** Function that transforms an external response body into `AgentProfile[]`. */
export type RegistryAdapter = (body: unknown, config: RegistryAdapterConfig) => readonly AgentProfile[];

const AGENT_ARCHETYPES: readonly AgentArchetype[] = [
  'explorer',
  'executor',
  'governor',
  'mediator',
  'chronicler',
  'synthesizer',
];

const AGENT_ROLES: readonly AgentRole[] = [
  'hepar',
  'cortex',
  'synapse',
  'cardia',
  'pneuma',
  'vox',
  'governance',
  'oracle',
  'agent-0',
  'delegate',
  'ecosystem-native',
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidationTier(value: unknown): value is ValidationTier {
  return typeof value === 'number' && (value === 0 || value === 1 || value === 2);
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function pickArchetype(value: unknown): AgentArchetype | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.toLowerCase().trim();
  return AGENT_ARCHETYPES.find((a) => a === normalized);
}

function pickRole(value: unknown): AgentRole {
  if (typeof value !== 'string') return 'ecosystem-native';
  const normalized = value.toLowerCase().trim();
  return AGENT_ROLES.find((r) => r === normalized) ?? 'ecosystem-native';
}

function pickNumber(value: unknown, fallback: number, min?: number, max?: number): number {
  let result = fallback;
  if (typeof value === 'number' && !Number.isNaN(value)) {
    result = value;
  } else if (typeof value === 'string') {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) result = parsed;
  }
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

function getValueAtPath(body: unknown, path: string | undefined): unknown {
  if (!path) return body;

  const tokens = path.split(/\.|\[(\d+)\]/).filter((t) => t !== undefined && t.length > 0);
  let current: unknown = body;

  for (const token of tokens) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(token);
      if (Number.isNaN(index)) return undefined;
      current = current[index];
    } else if (isPlainObject(current)) {
      current = current[token];
    } else {
      return undefined;
    }
  }

  return current;
}

function normalizeRecord(record: unknown): ExternalAgentRecord {
  if (!isPlainObject(record)) {
    throw new Error(
      `Registry adapter expected an object record, received ${Array.isArray(record) ? 'array' : typeof record}`
    );
  }
  return record as ExternalAgentRecord;
}

function defaultBigFive(): AgentProfile['bigFive'] {
  return {
    conscientiousness: 0.5,
    neuroticism: 0.5,
    openness: 0.5,
    agreeableness: 0.5,
    extraversion: 0.5,
  };
}

function defaultHoganRisk(): AgentProfile['hoganRisk'] {
  return {
    excitability: 0.5,
    skepticism: 0.5,
    cautious: 0.5,
    independent: 0.5,
    mischievous: 0.5,
  };
}

function defaultRiskEnvelope(): AgentProfile['riskEnvelope'] {
  return {
    maxPositionFraction: 0.0,
    maxDrawdownThreshold: 0.0,
    minEdgeBps: 0,
    kellyFraction: 0.0,
    capitalAuthorized: false,
  };
}

function mapRecordToProfile(record: ExternalAgentRecord): AgentProfile {
  const bigFive = record.bigFive && isPlainObject(record.bigFive) ? record.bigFive : {};
  const hexaco = record.hexaco && isPlainObject(record.hexaco) ? record.hexaco : {};
  const hoganRisk = record.hoganRisk && isPlainObject(record.hoganRisk) ? record.hoganRisk : {};
  const riskEnvelope = record.riskEnvelope && isPlainObject(record.riskEnvelope) ? record.riskEnvelope : {};

  return {
    agentId: pickString(record.agentId, 'unknown'),
    name: pickString(record.name, 'Unnamed Agent'),
    role: pickRole(record.role),
    archetype: pickArchetype(record.archetype),
    bigFive: {
      conscientiousness: pickNumber(bigFive.conscientiousness, defaultBigFive().conscientiousness, 0, 1),
      neuroticism: pickNumber(bigFive.neuroticism, defaultBigFive().neuroticism, 0, 1),
      openness: pickNumber(bigFive.openness, defaultBigFive().openness, 0, 1),
      agreeableness: pickNumber(bigFive.agreeableness, defaultBigFive().agreeableness, 0, 1),
      extraversion: pickNumber(bigFive.extraversion, defaultBigFive().extraversion, 0, 1),
    },
    hexaco: {
      honestyHumility: pickNumber(hexaco.honestyHumility, 0.5, 0, 1),
    },
    hoganRisk: {
      excitability: pickNumber(hoganRisk.excitability, defaultHoganRisk().excitability, 0, 1),
      skepticism: pickNumber(hoganRisk.skepticism, defaultHoganRisk().skepticism, 0, 1),
      cautious: pickNumber(hoganRisk.cautious, defaultHoganRisk().cautious, 0, 1),
      independent: pickNumber(hoganRisk.independent, defaultHoganRisk().independent, 0, 1),
      mischievous: pickNumber(hoganRisk.mischievous, defaultHoganRisk().mischievous, 0, 1),
    },
    validationTier: isValidationTier(record.validationTier) ? record.validationTier : 0,
    riskEnvelope: {
      maxPositionFraction: pickNumber(
        riskEnvelope.maxPositionFraction,
        defaultRiskEnvelope().maxPositionFraction,
        0,
        1
      ),
      maxDrawdownThreshold: pickNumber(
        riskEnvelope.maxDrawdownThreshold,
        defaultRiskEnvelope().maxDrawdownThreshold,
        0,
        1
      ),
      minEdgeBps: pickNumber(riskEnvelope.minEdgeBps, defaultRiskEnvelope().minEdgeBps, 0),
      kellyFraction: pickNumber(riskEnvelope.kellyFraction, defaultRiskEnvelope().kellyFraction, 0, 1),
      capitalAuthorized:
        typeof riskEnvelope.capitalAuthorized === 'boolean'
          ? riskEnvelope.capitalAuthorized
          : defaultRiskEnvelope().capitalAuthorized,
    },
    registeredAt: pickString(record.registeredAt, new Date().toISOString()),
  };
}

function extractArray(body: unknown, path: string | undefined): unknown[] {
  const value = getValueAtPath(body, path);
  if (!Array.isArray(value)) {
    throw new Error(
      path
        ? `Registry adapter path "${path}" did not resolve to an array (got ${typeof value})`
        : `Registry adapter expected the response body to be an array, got ${typeof value}`
    );
  }
  return value;
}

/** Identity adapter: the registry already returns `AgentProfile[]`. */
function directAdapter(body: unknown, _config: RegistryAdapterConfig): readonly AgentProfile[] {
  if (!Array.isArray(body)) {
    throw new Error(
      `direct adapter expected AgentProfile[], received ${typeof body}`
    );
  }
  return body as AgentProfile[];
}

/** Generic object-array adapter: each object is coerced into an AgentProfile. */
function genericArrayAdapter(body: unknown, config: RegistryAdapterConfig): readonly AgentProfile[] {
  return extractArray(body, config.path).map((record) => {
    const normalized = normalizeRecord(record);
    return { ...mapRecordToProfile(normalized), ...(config.defaults ?? {}) };
  });
}

/** Adapter for arrays where each element is a nested `{ agent: { ... } }` wrapper. */
function wrappedAgentAdapter(body: unknown, config: RegistryAdapterConfig): readonly AgentProfile[] {
  const rawArray = extractArray(body, config.path);
  return rawArray.map((item) => {
    const record =
      isPlainObject(item) && isPlainObject(item.agent)
        ? item.agent
        : item;
    const normalized = normalizeRecord(record);
    return { ...mapRecordToProfile(normalized), ...(config.defaults ?? {}) };
  });
}

/** Adapter for top-level `{ agents: [...] }` or paginated `{ data: { agents: [...] } }` shapes. */
function agentsFieldAdapter(body: unknown, config: RegistryAdapterConfig): readonly AgentProfile[] {
  const path = config.path ?? 'agents';
  return genericArrayAdapter(body, { ...config, path });
}

const BUILT_IN_ADAPTERS: Readonly<Record<string, RegistryAdapter>> = {
  direct: directAdapter,
  'generic-array': genericArrayAdapter,
  'wrapped-agent': wrappedAgentAdapter,
  'agents-field': agentsFieldAdapter,
};

const BUILT_IN_DEFAULT_PATHS: Readonly<Record<string, string | undefined>> = {
  direct: undefined,
  'generic-array': undefined,
  'wrapped-agent': 'agents',
  'agents-field': 'agents',
};

/** Resolve the named adapter or throw a helpful error. */
export function getRegistryAdapter(name: string): RegistryAdapter {
  const adapter = BUILT_IN_ADAPTERS[name];
  if (!adapter) {
    const known = Object.keys(BUILT_IN_ADAPTERS).join(', ');
    throw new Error(
      `Unknown registry adapter "${name}". Known adapters: ${known}. You can also write a custom adapter in registry-adapter.ts.`
    );
  }
  return adapter;
}

/** List the built-in adapter names. */
export function listRegistryAdapters(): readonly string[] {
  return Object.keys(BUILT_IN_ADAPTERS);
}

/**
 * Apply a registry adapter to a raw response body.
 *
 * This is the main entry point used by the registry provider after fetching
 * the external API payload.
 */
export function adaptRegistryResponse(
  body: unknown,
  config: RegistryAdapterConfig
): readonly AgentProfile[] {
  const adapter = getRegistryAdapter(config.name);
  const defaults = config.defaults;

  const effectiveConfig: RegistryAdapterConfig = {
    name: config.name,
    path: config.path ?? BUILT_IN_DEFAULT_PATHS[config.name],
    defaults,
  };

  return adapter(body, effectiveConfig);
}

/**
 * Build a `PopulationProvider` for an external REST registry using the selected
 * adapter. This wraps `createAgentRegistryProvider` and applies the adapter to
 * every response.
 */
export function createAdapterRegistryProvider(
  baseConfig: {
    url: string;
    token?: string;
    timeoutMs?: number;
    fetch?: typeof globalThis.fetch;
  },
  adapterConfig: RegistryAdapterConfig
): () => Promise<readonly AgentProfile[]> {
  const provider = createAgentRegistryProvider({
    url: baseConfig.url,
    token: baseConfig.token,
    timeoutMs: baseConfig.timeoutMs,
    fetch: baseConfig.fetch,
  });

  return async () => {
    const body = await provider();
    return adaptRegistryResponse(body, adapterConfig);
  };
}
