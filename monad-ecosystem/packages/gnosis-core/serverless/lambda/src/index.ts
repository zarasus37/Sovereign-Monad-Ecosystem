/**
 * AWS Lambda handler for the Sovereign agent registry.
 *
 * Serves:
 * - GET /health   → { status: 'ok' }
 * - GET /agents   → AgentProfile[]
 *
 * Environment variables:
 * - `REGISTRY_DATA_PATH` — path to JSON file (default `/tmp/agents.json`)
 * - `REGISTRY_AUTH_TOKEN` — optional bearer token
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
  Context,
} from 'aws-lambda';
import { handleRegistryRequest } from '@sovereign/gnosis-core/dist/registry-server.core.js';

export async function handler(
  event: APIGatewayProxyEventV2,
  _context: Context
): Promise<APIGatewayProxyResultV2> {
  const response = handleRegistryRequest(
    {
      method: event.requestContext.http.method ?? 'GET',
      url: event.rawPath ?? '/',
      headers: {
        get: (name) => {
          const value = event.headers[name.toLowerCase()];
          return value ?? null;
        },
      },
    },
    {
      dataPath: process.env['REGISTRY_DATA_PATH'] ?? '/tmp/agents.json',
      authToken: process.env['REGISTRY_AUTH_TOKEN'],
    }
  );

  return {
    statusCode: response.status,
    headers: response.headers,
    body: response.body,
  };
}
