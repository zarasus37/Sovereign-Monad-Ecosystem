/**
 * HTTP-backed live agent registry provider for `PluralityScheduler`.
 *
 * Fetches the current classified agent population from a registry endpoint
 * on every observation tick. The registry must return `AgentProfile[]` as
 * JSON.
 *
 * Environment variables used by the default factory:
 * - `AGENT_REGISTRY_URL` — base URL of the agent registry service
 * - `AGENT_REGISTRY_TOKEN` — optional bearer token for authenticated endpoints
 * - `AGENT_REGISTRY_TIMEOUT_MS` — request timeout in ms (default 10_000)
 */

import type { AgentProfile } from '@sovereign/types';

/** Configuration for the HTTP registry provider. */
export interface AgentRegistryProviderConfig {
  /** Full URL to fetch classified agent profiles (GET). */
  readonly url: string;

  /** Optional Bearer token sent as `Authorization: Bearer <token>`. */
  readonly token?: string;

  /** Request timeout in milliseconds. Default 10_000. */
  readonly timeoutMs?: number;

  /** Optional fetch implementation (for testing / edge runtimes). */
  readonly fetch?: typeof globalThis.fetch;
}

/** Build headers for the registry request. */
function buildHeaders(config: AgentRegistryProviderConfig): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/json',
  };
  if (config.token) {
    headers.authorization = `Bearer ${config.token}`;
  }
  return headers;
}

/**
 * Create a `PopulationProvider` that fetches active classified profiles
 * from an HTTP agent registry.
 *
 * The provider validates the response shape minimally: it must be an array.
 * Additional runtime validation should live in the registry service itself.
 */
export function createAgentRegistryProvider(
  config: AgentRegistryProviderConfig
): () => Promise<readonly AgentProfile[]> {
  const timeoutMs = config.timeoutMs ?? 10_000;
  const fetchImpl = config.fetch ?? globalThis.fetch;

  return async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(config.url, {
        method: 'GET',
        headers: buildHeaders(config),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        throw new Error(
          `Agent registry returned ${response.status} ${response.statusText}`
        );
      }

      const body = (await response.json()) as unknown;
      if (!Array.isArray(body)) {
        throw new Error(
          `Expected AgentProfile[] from registry, received ${typeof body}`
        );
      }
      return body as readonly AgentProfile[];
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(
          `Agent registry request timed out after ${timeoutMs}ms (${config.url})`
        );
      }
      throw err;
    }
  };
}
