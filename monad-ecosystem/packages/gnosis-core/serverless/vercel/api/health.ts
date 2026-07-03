/**
 * Vercel serverless function: GET /health
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleRegistryRequest } from '@sovereign/gnosis-core/dist/registry-server.core.js';

export default function handler(req: VercelRequest, res: VercelResponse): void {
  const response = handleRegistryRequest(
    {
      method: req.method ?? 'GET',
      url: '/health',
      headers: {
        get: () => null,
      },
    },
    {}
  );

  res.status(response.status).setHeaders(response.headers).send(response.body);
}
