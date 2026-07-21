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

  // ── Hepar Audit Proxy (Vector 5.1) ──────────────────────────────────────
  // Proxies wallet audits to hepar-service; returns verdict + confidence.
  // No local state, no ledger writes — stateless pass-through.
  const HEPAR_API_URL =
    process.env.HEPAR_API_URL ?? 'http://hepar-service:3003';

  app.post(
    '/api/v1/hepar/audit',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { walletAddress, localPrincipalId, protocolId, contractAddresses } =
          req.body ?? {};

        if (!walletAddress || typeof walletAddress !== 'string') {
          res.status(400).json({
            error: 'INVALID_BODY',
            message: 'walletAddress (string) is required',
          });
          return;
        }

        console.log(`[Hepar Proxy] Forwarding audit for ${walletAddress}`);

        const upstream = await fetch(`${HEPAR_API_URL}/api/v1/hepar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            localPrincipalId: localPrincipalId ?? undefined,
            protocolId: protocolId ?? undefined,
            contractAddresses: contractAddresses ?? undefined,
          }),
        });

        const json = await upstream.json();
        res.status(upstream.status).json(json);
      } catch (err) {
        next(err);
      }
    },
  );

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
    } = {
      configured: Boolean(process.env.KEY_VAULT_NAME),
      keyVaultName: process.env.KEY_VAULT_NAME || null,
      authType: process.env.MSI_ENDPOINT || process.env.IDENTITY_ENDPOINT || process.env.AZURE_CLIENT_ID
        ? 'managed-identity'
        : process.env.AZURE_TENANT_ID && process.env.AZURE_CLIENT_SECRET
        ? 'service-principal'
        : process.env.KEY_VAULT_NAME
        ? 'default-azure-credential'
        : 'none',
    };

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
