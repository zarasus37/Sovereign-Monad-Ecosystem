/**
 * Shared request handler for the agent registry.
 *
 * Extracted from `registry-server.ts` so the same logic can be reused by
 * serverless functions (Vercel, AWS Lambda, Cloudflare Workers) and the
 * standalone Node.js server.
 */

import { existsSync, readFileSync } from 'node:fs';

const DEFAULT_DATA_PATH = '/data/agents.json';

export interface RegistryHandlerConfig {
  /** Path to JSON file containing AgentProfile[]. */
  readonly dataPath?: string;
  /** Optional bearer token required on /agents. */
  readonly authToken?: string;
}

export interface RegistryHandlerRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: {
    readonly get: (name: string) => string | null;
  };
}

export interface RegistryHandlerResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

function notFound(): RegistryHandlerResponse {
  return {
    status: 404,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: 'Not found' }),
  };
}

function unauthorized(): RegistryHandlerResponse {
  return {
    status: 401,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ error: 'Unauthorized' }),
  };
}

function isAuthorized(
  req: RegistryHandlerRequest,
  expectedToken: string | undefined
): boolean {
  if (!expectedToken) return true;
  const header = req.headers.get('authorization') ?? '';
  const parts = header.split(' ');
  return (
    parts.length === 2 &&
    parts[0].toLowerCase() === 'bearer' &&
    parts[1] === expectedToken
  );
}

function readAgents(dataPath: string): unknown {
  if (!existsSync(dataPath)) {
    return [];
  }
  const raw = readFileSync(dataPath, 'utf8');
  return JSON.parse(raw) as unknown;
}

/**
 * Handle a single registry request.
 *
 * Supports:
 * - GET /health   → { status: 'ok' }
 * - GET /agents   → AgentProfile[] (requires bearer token if authToken set)
 */
export function handleRegistryRequest(
  req: RegistryHandlerRequest,
  config: RegistryHandlerConfig
): RegistryHandlerResponse {
  const url = req.url ?? '/';
  const method = req.method ?? 'GET';

  if (method !== 'GET') {
    return {
      status: 405,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  if (url === '/health') {
    return {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'ok' }),
    };
  }

  if (url === '/agents') {
    if (!isAuthorized(req, config.authToken)) {
      return unauthorized();
    }

    const dataPath = config.dataPath ?? DEFAULT_DATA_PATH;
    const agents = readAgents(dataPath);
    if (!Array.isArray(agents)) {
      return {
        status: 500,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Registry data is not an array' }),
      };
    }

    return {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
      body: JSON.stringify(agents),
    };
  }

  return notFound();
}
