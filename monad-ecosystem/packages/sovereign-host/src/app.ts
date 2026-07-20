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

export type SovereignAppOptions = {
  /** Override frontend origin for CORS (default FRONTEND_URL or Vite 5173). */
  frontendOrigin?: string;
  /** Shared ledger (tests inject). */
  ledger?: PLLedger;
  /** Wallet registry (tests inject). */
  registry?: PrincipalWalletRegistry;
  /** Force Kafka flag (default KAFKA_ENABLED===true). */
  kafkaEnabled?: boolean;
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

  // ── Health (The Pulse) ───────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ALIVE',
      service: '@sovereign/host',
      kafka: kafkaEnabled,
      redis: Boolean(process.env.REDIS_URL),
      live_funding: process.env.CARDIA_FUNDING_LIVE === 'true',
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
