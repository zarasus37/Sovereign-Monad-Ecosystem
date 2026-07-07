/**
 * Cloudflare Worker: Sovereign Agent Registry
 *
 * Serves:
 * - GET /health   → { status: 'ok' }
 * - GET /agents   → AgentProfile[]
 *
 * Environment variables / secrets:
 * - `REGISTRY_AUTH_TOKEN` — optional bearer token (set via `wrangler secret put`)
 *
 * Data source:
 * - By default this reads `agents.json` from the Worker's static module import.
 * - For dynamic data, wire a KV or R2 binding and replace `readAgents()` below.
 */

import { handleRegistryRequest } from '@sovereign/gnosis-core/dist/registry-server.core.js';
// Static agents.json bundled at deploy time. Replace with KV/R2 fetch for dynamic data.
import agents from './agents.json' with { type: 'json' };

function readAgents(): unknown {
  return agents;
}

export interface Env {
  REGISTRY_AUTH_TOKEN?: string;
  // REGISTRY_KV?: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const response = handleRegistryRequest(
      {
        method: request.method,
        url: new URL(request.url).pathname,
        headers: {
          get: (name) => request.headers.get(name),
        },
      },
      {
        authToken: env.REGISTRY_AUTH_TOKEN,
      }
    );

    // Override body with the imported JSON array only on /agents.
    const url = new URL(request.url).pathname;
    if (request.method === 'GET' && url === '/agents') {
      const data = readAgents();
      if (!Array.isArray(data)) {
        return new Response(
          JSON.stringify({ error: 'Registry data is not an array' }),
          { status: 500, headers: { 'content-type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  },
};
