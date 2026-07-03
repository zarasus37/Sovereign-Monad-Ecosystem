/**
 * Minimal HTTP agent registry for local / development deployments.
 *
 * Serves a static list of classified agent profiles as `AgentProfile[]` from
 * a JSON file. The plurality scheduler can consume this endpoint via
 * `PLURALITY_PROVIDER=registry` and `AGENT_REGISTRY_URL`.
 *
 * Environment variables:
 * - `REGISTRY_PORT` — HTTP port (default 8080)
 * - `REGISTRY_DATA_PATH` — path to JSON file containing AgentProfile[]
 * - `REGISTRY_AUTH_TOKEN` — optional bearer token required on /agents
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { handleRegistryRequest } from './registry-server.core.js';

const DEFAULT_PORT = 8080;
const DEFAULT_DATA_PATH = '/data/agents.json';

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

function main(): void {
  const port = getEnvNumber('REGISTRY_PORT', DEFAULT_PORT);
  const dataPath = process.env['REGISTRY_DATA_PATH'] ?? DEFAULT_DATA_PATH;
  const authToken = process.env['REGISTRY_AUTH_TOKEN'];

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const response = handleRegistryRequest(
      {
        method: req.method ?? 'GET',
        url: req.url ?? '/',
        headers: {
          get: (name) => {
            const value = req.headers[name.toLowerCase()];
            return Array.isArray(value) ? value[0] ?? null : (value ?? null);
          },
        },
      },
      { dataPath, authToken }
    );

    res.writeHead(response.status, response.headers);
    res.end(response.body);
  });

  server.listen(port, () => {
    console.log(`[AgentRegistry] Listening on http://0.0.0.0:${port}`);
    console.log(`[AgentRegistry] Data path: ${dataPath}`);
    console.log(`[AgentRegistry] Authentication: ${authToken ? 'enabled' : 'disabled'}`);
  });
}

main();
