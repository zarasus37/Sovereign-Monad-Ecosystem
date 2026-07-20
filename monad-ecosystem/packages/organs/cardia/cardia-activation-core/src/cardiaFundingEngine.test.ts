import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  executeFunding,
  mandateFromWalletBind,
  resetFundingNonceForTests,
} from './cardiaFundingEngine.js';
import type { CardiaFundingKafkaEvent } from './cardiaFunding.types.js';

describe('cardiaFundingEngine', () => {
  it('holds funds when Hepar audit fails', async () => {
    const events: CardiaFundingKafkaEvent[] = [];
    const mandate = mandateFromWalletBind({
      principalWallet: '0x1111111111111111111111111111111111111111',
    });
    const out = await executeFunding(mandate, {
      live: false,
      auditAddress: async () => ({
        passed: false,
        reason: 'sanctioned',
        auditId: 'a1',
      }),
      broadcast: (e) => {
        events.push(e);
      },
    });
    assert.equal(out.status, 'AUDIT_FAILED');
    assert.ok(out.auditTrace.some((t) => t.includes('hepar:audit:fail')));
    assert.equal(events.at(-1)?.status, 'AUDIT_FAILED');
  });

  it('synthesizes dry-run funding when not live', async () => {
    const events: CardiaFundingKafkaEvent[] = [];
    const mandate = mandateFromWalletBind({
      principalWallet: '0x2222222222222222222222222222222222222222',
      amountUsd: 15000,
    });
    const out = await executeFunding(mandate, {
      live: false,
      auditAddress: async () => ({
        passed: true,
        reason: 'ok',
        auditId: 'a2',
      }),
      broadcast: (e) => {
        events.push(e);
      },
    });
    assert.equal(out.status, 'TX_SYNTHESIZED');
    assert.equal(out.synthesized, true);
    assert.ok(out.txHash?.startsWith('0x'));
    assert.equal(out.amount, 15000);
    assert.ok(out.auditTrace.some((t) => t.includes('mode:dry-run')));
    assert.equal(events.at(-1)?.status, 'TX_SYNTHESIZED');
  });

  it('broadcasts TX_CONFIRMED on live path with injected transfer', async () => {
    resetFundingNonceForTests();
    const events: CardiaFundingKafkaEvent[] = [];
    const mandate = mandateFromWalletBind({
      principalWallet: '0x3333333333333333333333333333333333333333',
    });
    const out = await executeFunding(mandate, {
      live: true,
      getNonce: async () => 7,
      transferFn: async () => ({
        hash: '0xabc123',
        wait: async () => ({ status: 1, blockNumber: 42 }),
      }),
      auditAddress: async () => ({
        passed: true,
        reason: 'ok',
        auditId: 'a3',
      }),
      broadcast: (e) => {
        events.push(e);
      },
    });
    assert.equal(out.status, 'TX_CONFIRMED');
    assert.equal(out.txHash, '0xabc123');
    assert.equal(out.blockNumber, 42);
    assert.ok(events.some((e) => e.status === 'TX_BROADCAST'));
    assert.ok(events.some((e) => e.status === 'TX_CONFIRMED'));
  });

  it('marks TX_FAILED on revert and does not leave silent success', async () => {
    resetFundingNonceForTests();
    const mandate = mandateFromWalletBind({
      principalWallet: '0x4444444444444444444444444444444444444444',
    });
    const out = await executeFunding(mandate, {
      live: true,
      transferFn: async () => ({
        hash: '0xdead',
        wait: async () => ({ status: 0, blockNumber: 9 }),
      }),
      auditAddress: async () => ({
        passed: true,
        reason: 'ok',
        auditId: 'a4',
      }),
      broadcast: () => {},
    });
    assert.equal(out.status, 'TX_FAILED');
  });
});
