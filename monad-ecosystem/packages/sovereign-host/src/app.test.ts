import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createSovereignApp } from './app.js';
import { PLLedger, PrincipalWalletRegistry } from '@sovereign/gate-acl';

const TEST_TOKEN = 'test-bearer-token';
const TEST_PRINCIPAL = 'principal:alice';

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${TEST_TOKEN}`,
    ...extra,
  };
}

async function withServer(
  run: (base: string) => Promise<void>,
  opts: { apiToken?: string; principalId?: string; disableAuth?: boolean } = {},
): Promise<void> {
  const { app } = createSovereignApp({
    ledger: new PLLedger(),
    registry: new PrincipalWalletRegistry(),
    kafkaEnabled: false,
    frontendOrigin: 'http://localhost:5173',
    apiToken: opts.apiToken ?? TEST_TOKEN,
    principalId: opts.principalId ?? TEST_PRINCIPAL,
    disableAuth: opts.disableAuth,
  });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe('@sovereign/host', () => {
  // ── /health split ─────────────────────────────────────────────────────────

  it('GET /health is public and returns liveness only', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/health`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.status, 'ALIVE');
      assert.equal(body.service, '@sovereign/host');
      assert.ok(typeof body.timestamp === 'string');
      // The liveness probe must NOT disclose env / Key Vault / kafka / metrics
      // — those moved to /health/details (auth-gated).
      assert.equal('key_custody' in body, false);
      assert.equal('kafka' in body, false);
      assert.equal('redis' in body, false);
      assert.equal('metrics' in body, false);
      assert.equal('observability_topics' in body, false);
      assert.equal('bootstrap_env_fallback' in body, false);
    });
  });

  it('GET /health/details requires auth and returns full diagnostics', async () => {
    await withServer(async (base) => {
      // No auth → 401
      const noAuth = await fetch(`${base}/health/details`);
      assert.equal(noAuth.status, 401);

      // With auth → 200 + diagnostics
      const res = await fetch(`${base}/health/details`, {
        headers: { Authorization: `Bearer ${TEST_TOKEN}` },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.status, 'ALIVE');
      assert.equal(body.kafka, false);
      assert.equal(body.metrics, true);
      assert.ok('key_custody' in body);
      assert.equal(body.principal_id, TEST_PRINCIPAL);
    });
  });

  // ── /metrics (intentionally public — Prometheus scrape) ───────────────────

  it('GET /metrics returns Prometheus exposition (public)', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/metrics`);
      assert.equal(res.status, 200);
      const text = await res.text();
      assert.match(text, /sovereign_funding_events_total/);
      assert.match(text, /TYPE.*counter/);
    });
  });

  // ── 401 contract for gate-acl routes ──────────────────────────────────────

  it('POST /api/v1/gate-acl/promote-pl returns 401 without bearer token', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/gate-acl/promote-pl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 401);
      const body = (await res.json()) as { error?: string };
      assert.equal(body.error, 'UNAUTHENTICATED');
    });
  });

  it('POST /api/v1/gate-acl/bind-wallet returns 401 without bearer token', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/gate-acl/bind-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 401);
      const body = (await res.json()) as { error?: string };
      assert.equal(body.error, 'UNAUTHENTICATED');
    });
  });

  it('POST /api/v1/gate-acl/promote-pl returns 401 with bad bearer token', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/gate-acl/promote-pl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-the-token' },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 401);
    });
  });

  // ── Authenticated happy path: 400 for empty body, 200 for valid claim ────

  it('POST /api/v1/gate-acl/promote-pl with auth + empty body returns 400', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/gate-acl/promote-pl`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error?: string };
      assert.ok(body.error);
    });
  });

  it('POST /api/v1/gate-acl/bind-wallet with auth + empty body returns 400', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/gate-acl/bind-wallet`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as { error?: string };
      assert.ok(body.error);
    });
  });

  // ── THE P0 invariant: body.principalId is overridden by auth context ──────

  it('promote-pl ignores body.principalId and uses the auth principal (ledger isolation)', async () => {
    const ledger = new PLLedger();
    const { app } = createSovereignApp({
      ledger,
      registry: new PrincipalWalletRegistry(),
      kafkaEnabled: false,
      frontendOrigin: 'http://localhost:5173',
      apiToken: TEST_TOKEN,
      principalId: TEST_PRINCIPAL,
    });
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', () => resolve()));
    const { port } = server.address() as AddressInfo;

    try {
      const base = `http://127.0.0.1:${port}`;
      // Sanity: both principals start at score 0.
      const beforeAlice = ledger.compute(TEST_PRINCIPAL, 'agent_ops', Date.now());
      const beforeVictim = ledger.compute('principal:victim', 'agent_ops', Date.now());
      assert.equal(beforeAlice.score, 0);
      assert.equal(beforeVictim.score, 0);

      // The claim names 'principal:victim' in the body, but the auth context
      // says TEST_PRINCIPAL. The server must use the auth principal.
      const res = await fetch(`${base}/api/v1/gate-acl/promote-pl`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          principalId: 'principal:victim',
          taskId: 'archon-comprehension-gate',
          taskPayload: { kind: 'archon', gatesPassed: 2 },
        }),
      });
      assert.equal(res.status, 200, 'valid claim should succeed');
      const body = (await res.json()) as {
        event?: { principalId?: string; totalPl?: number };
        status?: string;
      };
      assert.equal(body.event?.principalId, TEST_PRINCIPAL);
      assert.equal(body.event?.totalPl, 25);

      // Alice's ledger grew; victim's did NOT.
      const afterAlice = ledger.compute(TEST_PRINCIPAL, 'agent_ops', Date.now());
      const afterVictim = ledger.compute('principal:victim', 'agent_ops', Date.now());
      assert.equal(afterAlice.score, 25, 'alice (auth principal) gained 25 PL');
      assert.equal(afterVictim.score, 0, 'victim (named in body) gained ZERO PL');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  // ── Cardia SSE auth ───────────────────────────────────────────────────────

  it('GET cardia SSE stream requires auth (401 without token)', async () => {
    await withServer(async (base) => {
      const wallet = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const res = await fetch(`${base}/api/v1/cardia/funding/stream/${wallet}`);
      assert.equal(res.status, 401);
    });
  });

  it('GET cardia SSE stream opens for valid wallet with auth', async () => {
    await withServer(async (base) => {
      const wallet = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const controller = new AbortController();
      const res = await fetch(
        `${base}/api/v1/cardia/funding/stream/${wallet}`,
        {
          headers: { Authorization: `Bearer ${TEST_TOKEN}` },
          signal: controller.signal,
        },
      );
      assert.equal(res.status, 200);
      assert.ok(
        res.headers.get('content-type')?.includes('text/event-stream'),
      );
      // Read first chunk then abort
      const reader = res.body?.getReader();
      assert.ok(reader);
      const { value } = await reader!.read();
      const text = new TextDecoder().decode(value);
      assert.ok(text.includes('CONNECTED') || text.includes('data:'));
      controller.abort();
    });
  });

  // ── Construction guard ────────────────────────────────────────────────────

  it('createSovereignApp throws when apiToken is unset outside test mode', () => {
    const saved = process.env.SOVEREIGN_API_TOKEN;
    const savedNodeEnv = process.env.NODE_ENV;
    try {
      delete process.env.SOVEREIGN_API_TOKEN;
      process.env.NODE_ENV = 'production';
      assert.throws(
        () =>
          createSovereignApp({
            ledger: new PLLedger(),
            registry: new PrincipalWalletRegistry(),
            frontendOrigin: 'http://localhost:5173',
            // apiToken omitted on purpose
          }),
        /SOVEREIGN_API_TOKEN is required/,
      );
    } finally {
      if (saved === undefined) delete process.env.SOVEREIGN_API_TOKEN;
      else process.env.SOVEREIGN_API_TOKEN = saved;
      if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = savedNodeEnv;
    }
  });

  // ── brute-force protection ────────────────────────────────────────────────

  it('rate-limits repeated bad-token attempts (limiter runs BEFORE auth)', async () => {
    // Regression guard. Originally the routes were mounted as
    // `bearerAuth, mutatingRateLimit`, so a failed auth returned 401 and
    // short-circuited before the limiter could ever count the request.
    // Measured at that ordering: 150 wrong-token POSTs returned 150x 401 and
    // ZERO 429 -- the shared token was brute-forceable at unlimited rate.
    // Mounting the limiter first makes failed attempts consume the budget.
    await withServer(async (base) => {
      const codes: Record<number, number> = {};
      for (let i = 0; i < 120; i++) {
        const res = await fetch(`${base}/api/v1/gate-acl/promote-pl`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer wrong-guess-${i}`,
          },
          body: JSON.stringify({ principalId: 'x' }),
        });
        codes[res.status] = (codes[res.status] ?? 0) + 1;
      }
      assert.ok(
        (codes[429] ?? 0) > 0,
        `no 429 in 120 bad-token attempts (${JSON.stringify(codes)}) -- ` +
          'the limiter must be mounted before bearerAuth or the token is ' +
          'brute-forceable at unlimited rate',
      );
      assert.ok((codes[401] ?? 0) > 0, 'bad tokens must still 401 before the cap');
    });
  });
});
