/**
 * Tests for the HealthServer.
 *
 * Verifies that /health and /metrics endpoints return the expected JSON and
 * that the server can be started and stopped idempotently.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createServer } from 'node:http';
import http from 'node:http';
import { HealthServer, type SchedulerMetrics } from './health-server.js';

function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Could not determine available port')));
      }
    });
  });
}

function httpGet(port: number, path: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          resolve({ status: res.statusCode ?? 0, body });
        });
      })
      .on('error', reject);
  });
}

describe('HealthServer', () => {
  let port: number;

  beforeEach(async () => {
    port = await getAvailablePort();
  });

  it('returns status ok from /health', async () => {
    const metrics: SchedulerMetrics = {
      observationsTotal: 0,
      providerErrorsTotal: 0,
      signalsEmittedTotal: 0,
      lastObservationAt: null,
      lastProviderErrorAt: null,
    };

    const server = new HealthServer({ port, getMetrics: () => metrics });
    server.start();

    const response = await httpGet(port, '/health');
    expect(response.status).toBe(200);
    const parsed = JSON.parse(response.body);
    expect(parsed.status).toBe('ok');
    expect(parsed.uptimeMs).toBeGreaterThanOrEqual(0);

    await server.stop();
  });

  it('returns current metrics from /metrics', async () => {
    const metrics: SchedulerMetrics = {
      observationsTotal: 7,
      providerErrorsTotal: 1,
      signalsEmittedTotal: 3,
      lastObservationAt: '2026-06-26T00:00:00.000Z',
      lastProviderErrorAt: '2026-06-26T00:01:00.000Z',
    };

    const server = new HealthServer({ port, getMetrics: () => metrics });
    server.start();

    const response = await httpGet(port, '/metrics');
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual(metrics);

    await server.stop();
  });

  it('returns 404 for unknown paths', async () => {
    const server = new HealthServer({
      port,
      getMetrics: () => ({
        observationsTotal: 0,
        providerErrorsTotal: 0,
        signalsEmittedTotal: 0,
        lastObservationAt: null,
        lastProviderErrorAt: null,
      }),
    });
    server.start();

    const response = await httpGet(port, '/unknown');
    expect(response.status).toBe(404);

    await server.stop();
  });

  it('returns 405 for non-GET methods', async () => {
    const server = new HealthServer({
      port,
      getMetrics: () => ({
        observationsTotal: 0,
        providerErrorsTotal: 0,
        signalsEmittedTotal: 0,
        lastObservationAt: null,
        lastProviderErrorAt: null,
      }),
    });
    server.start();

    const response = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = http.request(
        { hostname: '127.0.0.1', port, path: '/health', method: 'POST' },
        (res) => {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            resolve({ status: res.statusCode ?? 0, body });
          });
        }
      );
      req.on('error', reject);
      req.end();
    });

    expect(response.status).toBe(405);

    await server.stop();
  });

  it('is idempotent on multiple start() and stop() calls', async () => {
    const server = new HealthServer({
      port,
      getMetrics: () => ({
        observationsTotal: 0,
        providerErrorsTotal: 0,
        signalsEmittedTotal: 0,
        lastObservationAt: null,
        lastProviderErrorAt: null,
      }),
    });

    server.start();
    server.start();
    await server.stop();
    await server.stop();

    // After stopping, the server should not respond.
    await expect(httpGet(port, '/health')).rejects.toThrow();
  });
});
