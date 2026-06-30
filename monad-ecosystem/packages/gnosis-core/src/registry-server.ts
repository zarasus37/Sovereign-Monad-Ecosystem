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
import { readFileSync, existsSync } from 'node:fs';

const DEFAULT_PORT = 8080;
const DEFAULT_DATA_PATH = '/data/agents.json';

function getEnvNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

function unauthorized(res: ServerResponse): void {
  res.writeHead(401, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'Unauthorized' }));
}

function readAgents(dataPath: string): unknown {
  if (!existsSync(dataPath)) {
    return [];
  }
  const raw = readFileSync(dataPath, 'utf8');
  return JSON.parse(raw) as unknown;
}

function isAuthorized(req: IncomingMessage, expectedToken: string | undefined): boolean {
  if (!expectedToken) return true;
  const header = req.headers['authorization'] ?? '';
  const parts = String(header).split(' ');
  return parts.length === 2 && parts[0].toLowerCase() === 'bearer' && parts[1] === expectedToken;
}

function main(): void {
  const port = getEnvNumber('REGISTRY_PORT', DEFAULT_PORT);
  const dataPath = process.env['REGISTRY_DATA_PATH'] ?? DEFAULT_DATA_PATH;
  const authToken = process.env['REGISTRY_AUTH_TOKEN'];

  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    const method = req.method ?? 'GET';

    if (method === 'GET' && url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    if (method === 'GET' && url === '/agents') {
      if (!isAuthorized(req, authToken)) {
        unauthorized(res);
        return;
      }

      const agents = readAgents(dataPath);
      if (!Array.isArray(agents)) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Registry data is not an array' }));
        return;
      }

      res.writeHead(200, {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      });
      res.end(JSON.stringify(agents));
      return;
    }

    notFound(res);
  });

  server.listen(port, () => {
    console.log(`[AgentRegistry] Listening on http://0.0.0.0:${port}`);
    console.log(`[AgentRegistry] Data path: ${dataPath}`);
    console.log(`[AgentRegistry] Authentication: ${authToken ? 'enabled' : 'disabled'}`);
  });
}

main();
