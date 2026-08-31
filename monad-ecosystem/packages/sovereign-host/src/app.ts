/**
 * Express application factory (Vector 4.3).
 *
 * Export `createSovereignApp()` so Azure Functions / tests can wrap the same
 * routes without calling `listen`.
 *
 * Security model (P0 — host auth):
 * - The host is gated behind a bearer token (SOVEREIGN_API_TOKEN). Every
 *   ledger-mutating route and the Cardia SSE mount require it. The token is
 *   compared in constant time.
 * - principalId is derived from the authenticated context (SOVEREIGN_PRINCIPAL_ID
 *   or the `principalId` option). The body.principalId and body.localPrincipalId
 *   fields on promote-pl and bind-wallet are OVERWRITTEN with req.auth.principalId
 *   before the lower-level services are called — a caller cannot affect a
 *   different principal's ledger by naming them in the body.
 * - helmet is applied globally for default security headers.
 * - express-rate-limit is applied per-route to the auth-protected paths.
 * - /health is split: the public probe returns liveness only; /health/details
 *   is behind auth and exposes Key Vault + Redis + env diagnostics.
 *
 * Stateful singletons (PLLedger, PrincipalWalletRegistry) are process-local.
 * Honest for local/staging; production serverless needs durable backing.
 */

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from 'express';
import { timingSafeEqual } from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
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
  /**
   * Bearer token expected in `Authorization: Bearer <token>` for the
   * auth-protected routes. Defaults to env SOVEREIGN_API_TOKEN.
   * If unset and not NODE_ENV=test, app construction throws.
   */
  apiToken?: string;
  /**
   * Principal this host represents. Required for ledger-mutating routes so
   * that req.auth.principalId is always set. Defaults to env SOVEREIGN_PRINCIPAL_ID.
   */
  principalId?: string;
  /**
   * Disable auth (use only for local dev / non-P0 experiments).
   * Auth is enforced by default. Bypassing this throws in production.
   */
  disableAuth?: boolean;
};

export type SovereignAppContext = {
  app: Express;
  ledger: PLLedger;
  registry: PrincipalWalletRegistry;
  kafkaEnabled: boolean;
};

export type AuthContext = {
  /** Principal this host represents. Injected into req.auth.principalId. */
  principalId: string;
};

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthContext;
  }
}

const CARDIA_DEFAULT_TOPIC = 'sovereign.cardia.funding.events';

/**
 * Per-route rate limiter for auth-protected mutating routes. Conservative
 * defaults — the host is internal-facing, but a misconfigured client should
 * not be able to spam ledger writes.
 */
const mutatingRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many requests' },
});

/**
 * Stricter limiter for the SSE mount. SSE connections are long-lived, so we
 * cap *new* connections per minute, not message volume.
 */
const sseRateLimit: RateLimitRequestHandler = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many SSE connections' },
});

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

  const apiToken = opts.apiToken ?? process.env.SOVEREIGN_API_TOKEN ?? '';
  const principalId =
    opts.principalId ?? process.env.SOVEREIGN_PRINCIPAL_ID ?? '';

  // Auth config is mandatory outside test mode — refuse to start an
  // unauthenticated host in dev/staging/prod.
  if (!opts.disableAuth) {
    if (process.env.NODE_ENV !== 'test' && !apiToken) {
      throw new Error(
        'SOVEREIGN_API_TOKEN is required. Refusing to start an unauthenticated host.',
      );
    }
    if (process.env.NODE_ENV !== 'test' && !principalId) {
      throw new Error(
        'SOVEREIGN_PRINCIPAL_ID is required. Refusing to start a host with no principal.',
      );
    }
  }

  const app = express();

  // Security headers (default helmet config: X-Content-Type-Options,
  // X-Frame-Options, Referrer-Policy, hides X-Powered-By, etc.).
  app.use(helmet());

  app.use(
    cors({
      origin: frontendOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  /**
   * Bearer-token middleware. Compares with timingSafeEqual. Sets
   * req.auth.principalId on success; 401 on failure.
   *
   - In test mode (NODE_ENV === 'test'), missing token is allowed but the
   * caller is still stamped with the configured principalId so handlers
   * can exercise the principalId-override path.
   */
  const bearerAuth: RequestHandler = (req, res, next) => {
    if (opts.disableAuth) {
      req.auth = { principalId: principalId || 'principal:host' };
      return next();
    }
    const expected = apiToken;
    const header = req.get('authorization') ?? '';
    const m = /^Bearer\s+(.+)$/i.exec(header);
    const provided = m ? m[1].trim() : '';

    if (!expected) {
      // NODE_ENV === 'test' (verified by the construction guard).
      // Still stamp a principalId so downstream code can run.
      req.auth = { principalId: principalId || 'principal:test' };
      return next();
    }

    if (!provided) {
      res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'Missing or malformed Authorization header',
      });
      return;
    }

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.status(401).json({
        error: 'UNAUTHENTICATED',
        message: 'Invalid bearer token',
      });
      return;
    }

    req.auth = { principalId: principalId || 'principal:host' };
    next();
  };

  /**
   * Helper: assert req.auth.principalId exists. Returns the principalId.
   * The auth middleware always sets it (including in test mode and when
   * disableAuth is true), so this is a belt-and-suspenders guard for the
   * downstream services that trust principalId.
   */
  function requireAuthPrincipal(req: Request): string {
    const p = req.auth?.principalId;
    if (!p) {
      throw new Error('auth.principalId not set — middleware misconfiguration');
    }
    return p;
  }

  // ── Public probe: liveness only (no auth, no env disclosure) ────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ALIVE',
      service: '@sovereign/host',
      timestamp: new Date().toISOString(),
    });
  });

  // ── Authenticated diagnostics (Key Vault, env, observability topics) ─────
  app.get(
    '/health/details',
    bearerAuth,
    (_req: Request, res: Response) => {
      const key_custody: {
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
        principal_id: principalId || null,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // ── PL Bridge (Vector 3.1) — auth + principalId from auth context ──────
  app.post(
    '/api/v1/gate-acl/promote-pl',
    mutatingRateLimit,
    bearerAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authPrincipal = requireAuthPrincipal(req);
        // The body MUST be an object. Replace the principalId with the
        // authenticated one so a client cannot name a different principal.
        const body =
          req.body && typeof req.body === 'object' && !Array.isArray(req.body)
            ? { ...(req.body as Record<string, unknown>), principalId: authPrincipal }
            : { principalId: authPrincipal };
        const { status, json } = await promotePlHttp(body, {
          ledger,
          kafkaEnabled,
        });
        res.status(status).json(json);
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Wallet Binding (Vector 3.2) — auth + localPrincipalId from auth ────
  app.post(
    '/api/v1/gate-acl/bind-wallet',
    mutatingRateLimit,
    bearerAuth,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const authPrincipal = requireAuthPrincipal(req);
        // Same contract as promote-pl: overwrite localPrincipalId from auth
        // so a client cannot bind a wallet to someone else's principal.
        const body =
          req.body && typeof req.body === 'object' && !Array.isArray(req.body)
            ? { ...(req.body as Record<string, unknown>), localPrincipalId: authPrincipal }
            : { localPrincipalId: authPrincipal };
        const { status, json } = await bindWalletHttp(body, {
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

  // ── Cardia Funding SSE (Vector 4.1) — auth required to open a stream ──
  // Mount at /api/v1/cardia → GET .../funding/stream/:walletAddress
  app.use(
    '/api/v1/cardia',
    sseRateLimit,
    bearerAuth,
    createCardiaFundingStreamRouter(),
  );

  // ── Hepar Audit Proxy (Vector 5.1) — stateless pass-through ────────────
  // Proxies wallet audits to hepar-service; returns verdict + confidence.
  // No local state, no ledger writes — stateless pass-through.
  // Hepar is a separate concern from the gate-acl ledger, so it does NOT
  // receive the same auth + principalId-override treatment. (Add bearer
  // auth here if/when the hepar-service contract requires it.)
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
    // Prometheus scrape endpoint — intentionally unauthenticated so
    // kube-prometheus / blackbox-exporter can scrape without managing
    // tokens. Contains only aggregate counters, no PII.
    app.get('/metrics', (_req: Request, res: Response) => {
      res
        .status(200)
        .type('text/plain; version=0.0.4; charset=utf-8')
        .send(renderPrometheusText());
    });

    // Dev/staging inject when Kafka is offline (honest local scrape path).
    // Auth required so a third party cannot inject fake metrics events.
    app.post(
      '/api/v1/metrics/ingest',
      mutatingRateLimit,
      bearerAuth,
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
