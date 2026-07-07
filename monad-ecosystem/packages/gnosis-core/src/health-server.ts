/**
 * Minimal HTTP health and metrics server for the plurality scheduler.
 *
 * Exposes:
 * - GET /health      — liveness check; returns 200 { status: 'ok', uptimeMs }
 * - GET /metrics     — runtime counters for the current scheduler run
 *
 * The server is intentionally lightweight and does not depend on the event bus.
 */

import { createServer, type Server } from 'node:http';

export interface SchedulerMetrics {
  /** Number of observations completed (including empty populations). */
  observationsTotal: number;
  /** Number of observations that failed due to provider errors. */
  providerErrorsTotal: number;
  /** Number of Dove signals emitted. */
  signalsEmittedTotal: number;
  /** ISO timestamp of the most recent successful observation, or null. */
  lastObservationAt: string | null;
  /** ISO timestamp of the most recent provider failure, or null. */
  lastProviderErrorAt: string | null;
}

export interface HealthServerConfig {
  /** Port to listen on. Default 3000. */
  readonly port?: number;
  /** Current scheduler metrics snapshot. */
  readonly getMetrics: () => SchedulerMetrics;
}

export class HealthServer {
  private readonly port: number;
  private readonly getMetrics: () => SchedulerMetrics;
  private server: Server | null = null;
  private startTime: number = Date.now();

  constructor(config: HealthServerConfig) {
    this.port = config.port ?? 3000;
    this.getMetrics = config.getMetrics;
  }

  /** Start the health server. Idempotent. */
  start(): void {
    if (this.server !== null) {
      return;
    }

    this.startTime = Date.now();
    this.server = createServer((req, res) => {
      const url = req.url ?? '/';
      if (req.method !== 'GET') {
        res.writeHead(405, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      if (url === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            status: 'ok',
            uptimeMs: Date.now() - this.startTime,
          })
        );
        return;
      }

      if (url === '/metrics') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(this.getMetrics()));
        return;
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    });

    this.server.listen(this.port, () => {
      console.log(`[HealthServer] Listening on http://0.0.0.0:${this.port}`);
    });
  }

  /** Stop the health server. */
  async stop(): Promise<void> {
    if (this.server === null) {
      return;
    }

    const server = this.server;
    this.server = null;

    return new Promise((resolve, reject) => {
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
