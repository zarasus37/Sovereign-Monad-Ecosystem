/**
 * Vercel serverless function: GET /agents
 *
 * Serves a static list of classified agent profiles as `AgentProfile[]`
 * from `REGISTRY_DATA_PATH`.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleRegistryRequest } from '@sovereign/gnosis-core/dist/registry-server.core.js';

export default function handler(req: VercelRequest, res: VercelResponse): void {
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
    {
      dataPath: process.env['REGISTRY_DATA_PATH'] ?? '/tmp/agents.json',
      authToken: process.env['REGISTRY_AUTH_TOKEN'],
    }
  );

  res.status(response.status).setHeaders(response.headers).send(response.body);
}
