import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { createSovereignApp } from './app.js';
import { PLLedger, PrincipalWalletRegistry } from '@sovereign/gate-acl';

async function withServer(
  run: (base: string) => Promise<void>,
): Promise<void> {
  const { app } = createSovereignApp({
    ledger: new PLLedger(),
    registry: new PrincipalWalletRegistry(),
    kafkaEnabled: false,
    frontendOrigin: 'http://localhost:5173',
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
  it('GET /health returns ALIVE pulse', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/health`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        status: string;
        kafka: boolean;
        service: string;
      };
      assert.equal(body.status, 'ALIVE');
      assert.equal(body.service, '@sovereign/host');
      assert.equal(body.kafka, false);
    });
  });

  it('POST /api/v1/gate-acl/promote-pl rejects empty body', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/gate-acl/promote-pl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.ok(res.status >= 400);
      const body = (await res.json()) as { error?: string };
      assert.ok(body.error);
    });
  });

  it('POST /api/v1/gate-acl/bind-wallet rejects empty body', async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/v1/gate-acl/bind-wallet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.ok(res.status >= 400);
      const body = (await res.json()) as { error?: string };
      assert.ok(body.error);
    });
  });

  it('GET cardia SSE stream opens for valid wallet', async () => {
    await withServer(async (base) => {
      const wallet = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const controller = new AbortController();
      const res = await fetch(
        `${base}/api/v1/cardia/funding/stream/${wallet}`,
        { signal: controller.signal },
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
});
