import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AddressInfo } from 'node:net';
import { mockHeparApp } from './mock-hepar-server.js';

describe('mock Hepar server', () => {
  it('PASSes clean address and FAILs dead marker', async () => {
    const server = mockHeparApp.listen(0);
    await new Promise<void>((r) => server.once('listening', () => r()));
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}`;

    try {
      const passRes = await fetch(`${base}/api/v1/hepar/audit-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAddress: '0x2222222222222222222222222222222222222222',
          context: 'TIER_1_FUNDING',
        }),
      });
      assert.equal(passRes.status, 200);
      const passBody = (await passRes.json()) as { verdict: string };
      assert.equal(passBody.verdict, 'PASS');

      const failRes = await fetch(`${base}/api/v1/hepar/audit-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAddress: '0xdead000000000000000000000000000000000001',
          context: 'TIER_1_FUNDING',
        }),
      });
      const failBody = (await failRes.json()) as { verdict: string };
      assert.equal(failBody.verdict, 'FAIL_MALICIOUS_CONTRACT');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
