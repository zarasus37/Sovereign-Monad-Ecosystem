import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  InMemoryNonceStore,
  RedisNonceManager,
} from './redisNonceManager.js';

describe('RedisNonceManager', () => {
  it('allocates sequential nonces after syncWithChain', async () => {
    const store = new InMemoryNonceStore();
    const mgr = new RedisNonceManager({
      redis: store,
      getChainPendingNonce: async () => 10,
    });
    await mgr.syncWithChain();
    const a = await mgr.getNextNonce();
    const b = await mgr.getNextNonce();
    const c = await mgr.getNextNonce();
    assert.equal(a, 10);
    assert.equal(b, 11);
    assert.equal(c, 12);
  });

  it('concurrent getNextNonce never collides (memory store)', async () => {
    const store = new InMemoryNonceStore();
    const mgr = new RedisNonceManager({
      redis: store,
      getChainPendingNonce: async () => 0,
    });
    await mgr.syncWithChain(0);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => mgr.getNextNonce()),
    );
    const sorted = [...results].sort((x, y) => x - y);
    assert.deepEqual(
      sorted,
      Array.from({ length: 20 }, (_, i) => i),
    );
    assert.equal(new Set(results).size, 20);
  });

  it('handleTransactionFailure resyncs from chain', async () => {
    let chain = 5;
    const store = new InMemoryNonceStore();
    const mgr = new RedisNonceManager({
      redis: store,
      getChainPendingNonce: async () => chain,
    });
    await mgr.syncWithChain();
    assert.equal(await mgr.getNextNonce(), 5);
    assert.equal(await mgr.getNextNonce(), 6);
    // Simulate chain only consumed 5 (6 failed)
    chain = 5;
    await mgr.handleTransactionFailure();
    assert.equal(await mgr.getNextNonce(), 5);
  });
});
