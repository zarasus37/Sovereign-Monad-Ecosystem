/**
 * Express application factory (Vector 4.3).
 *
 * Export `createSovereignApp()` so Azure Functions / tests can wrap the same
 * routes without calling `listen`.
 *
 * Stateful singletons (PLLedger, PrincipalWalletRegistry) are process-local.
 * Honest for local/staging; production serverless needs durable backing.
 */

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import cors from 'cors';
import {
  promotePlHttp,
  bindWalletHttp,
  PLLedger,
  PrincipalWalletRegistry,
} from '@sovereign/gate-acl';
import { createCardiaFundingStreamRouter } from '@sovereign/cardia-funding-stream';
import { renderPrometheusText } from './metrics.js';
import { ingestKafkaPayload, OBSERVABILITY_TOPICS } from './metricsKafka.js';

export type SovereignAppOptions = {
  /** Override frontend origin for CORS (default FRONTEND_URL or Vite 5173). */
  frontendOrigin?: string;
  /** Shared ledger (tests inject). */
  ledger?: PLLedger;
  /** Wallet registry (tests inject). */
  registry?: PrincipalWalletRegistry;
  /** Force Kafka flag (default KAFKA_ENABLED===true). */
  kafkaEnabled?: boolean;
  /** Mount Prometheus /metrics (default true). */
  metricsEnabled?: boolean;
};

export type SovereignAppContext = {
  app: Express;
  ledger: PLLedger;
  registry: PrincipalWalletRegistry;
  kafkaEnabled: boolean;
};

export function createSovereignApp(
  opts: SovereignAppOptions = {},
): SovereignAppContext {
  const ledger = opts.ledger ?? new PLLedger();
  const registry = opts.registry ?? new PrincipalWalletRegistry();
  const kafkaEnabled =
    opts.kafkaEnabled ?? process.env.KAFKA_ENABLED === 'true';
  const frontendOrigin =
    opts.frontendOrigin ??
    process.env.FRONTEND_URL ??
    'http://localhost:5173';

  const app = express();

  app.use(
    cors({
      origin: frontendOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // ── PL Bridge (Vector 3.1) ───────────────────────────────────────────────
  app.post(
    '/api/v1/gate-acl/promote-pl',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status, json } = await promotePlHttp(req.body, {
          ledger,
          kafkaEnabled,
        });
        res.status(status).json(json);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Wallet Binding (Vector 3.2) ──────────────────────────────────────────
  app.post(
    '/api/v1/gate-acl/bind-wallet',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { status, json } = await bindWalletHttp(req.body, {
          ledger,
          registry,
          kafkaEnabled,
        });
        res.status(status).json(json);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Cardia Funding SSE (Vector 4.1) ──────────────────────────────────────
  // Mount at /api/v1/cardia → GET .../funding/stream/:walletAddress
  app.use('/api/v1/cardia', createCardiaFundingStreamRouter());

  // ── Observability (Vector 6.3) ───────────────────────────────────────────
  if (opts.metricsEnabled !== false) {
    app.get('/metrics', (_req: Request, res: Response) => {
      res
        .status(200)
        .type('text/plain; version=0.0.4; charset=utf-8')
        .send(renderPrometheusText());
    });

    // Dev/staging inject when Kafka is offline (honest local scrape path)
    app.post(
      '/api/v1/metrics/ingest',
      (req: Request, res: Response) => {
        const topic =
          typeof req.body?.topic === 'string'
            ? req.body.topic
            : CARDIA_DEFAULT_TOPIC;
        const payload =
          req.body?.payload && typeof req.body.payload === 'object'
            ? (req.body.payload as Record<string, unknown>)
            : (req.body as Record<string, unknown>);
        ingestKafkaPayload(topic, payload ?? {});
        res.status(202).json({ ok: true, topic });
      },
    );
  }

  // ── Health (The Pulse) ───────────────────────────────────────────────────
  app.get('/health', async (_req: Request, res: Response) => {
    let key_custody: {
      configured: boolean;
      keyVaultName: string | null;
      authType: string;
    } = { configured: false, keyVaultName: null, authType: 'none' };
    try {
      const { checkKeyVaultHealth } = await import('./lib/keyCustody');
      key_custody = await checkKeyVaultHealth();
    } catch {
      /* optional module path */
    }

    res.status(200).json({
      status: 'ALIVE',
      service: '@sovereign/host',
      kafka: kafkaEnabled,
      redis: Boolean(process.env.REDIS_URL),
      live_funding: process.env.CARDIA_FUNDING_LIVE === 'true',
      yield_router_live: process.env.YIELD_ROUTER_LIVE === 'true',
      metrics: opts.metricsEnabled !== false,
      key_custody,
      bootstrap_env_fallback: Boolean(process.env.BOOTSTRAP_PRIVATE_KEY),
      observability_topics: OBSERVABILITY_TOPICS,
      frontend_origin: frontendOrigin,
      timestamp: new Date().toISOString(),
    });
  });

  // JSON error envelope (no stack to client)
  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Sovereign Host] Unhandled:', err);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message,
      });
    },
  );

  return { app, ledger, registry, kafkaEnabled };
}

const CARDIA_DEFAULT_TOPIC = 'sovereign.cardia.funding.events';
