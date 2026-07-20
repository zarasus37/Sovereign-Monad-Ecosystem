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
      auditFunding: async () => ({
        verdict: 'FAIL_SANCTIONED',
        riskScore: 0.99,
        flags: ['sanctioned'],
        auditId: 'a1',
        reason: 'sanctioned',
      }),
      broadcast: (e) => {
        events.push(e);
      },
    });
    assert.equal(out.status, 'AUDIT_FAILED');
    assert.ok(out.auditTrace.some((t) => t.includes('hepar:audit:fail')));
    assert.ok(out.auditTrace.some((t) => t.includes('FAIL_SANCTIONED')));
    assert.equal(events.at(-1)?.status, 'AUDIT_FAILED');
  });

  it('fail-closed when Hepar service unavailable', async () => {
    const mandate = mandateFromWalletBind({
      principalWallet: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    });
    const out = await executeFunding(mandate, {
      live: false,
      auditFunding: async () => ({
        verdict: 'ERROR_SERVICE_UNAVAILABLE',
        riskScore: 1,
        flags: ['hepar_timeout', 'fail_closed'],
        auditId: 'error-no-audit',
        reason: 'timeout',
      }),
      broadcast: () => {},
    });
    assert.equal(out.status, 'AUDIT_FAILED');
    assert.ok(
      out.auditTrace.some((t) => t.includes('fail_closed:service_unavailable')),
    );
  });

  it('synthesizes dry-run funding when not live', async () => {
    const events: CardiaFundingKafkaEvent[] = [];
    const mandate = mandateFromWalletBind({
      principalWallet: '0x2222222222222222222222222222222222222222',
      amountUsd: 15000,
    });
    const out = await executeFunding(mandate, {
      live: false,
      auditFunding: async () => ({
        verdict: 'PASS',
        riskScore: 0.05,
        flags: [],
        auditId: 'a2',
        reason: 'ok',
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
    let usedNonce: number | undefined;
    const mandate = mandateFromWalletBind({
      principalWallet: '0x3333333333333333333333333333333333333333',
    });
    const out = await executeFunding(mandate, {
      live: true,
      getNonce: async () => 7,
      transferFn: async (_to, _amt, nonce) => {
        usedNonce = nonce;
        return {
          hash: '0xabc123',
          wait: async () => ({ status: 1, blockNumber: 42 }),
        };
      },
      auditFunding: async () => ({
        verdict: 'PASS',
        riskScore: 0.05,
        flags: [],
        auditId: 'a3',
        reason: 'ok',
      }),
      broadcast: (e) => {
        events.push(e);
      },
    });
    assert.equal(out.status, 'TX_CONFIRMED');
    assert.equal(usedNonce, 7);
    assert.equal(out.txHash, '0xabc123');
    assert.equal(out.blockNumber, 42);
    assert.ok(out.auditTrace.some((t) => t.includes('nonce:7')));
    assert.ok(events.some((e) => e.status === 'TX_BROADCAST'));
    assert.ok(events.some((e) => e.status === 'TX_CONFIRMED'));
  });

  it('marks TX_FAILED on revert and resyncs nonce path', async () => {
    resetFundingNonceForTests();
    const mandate = mandateFromWalletBind({
      principalWallet: '0x4444444444444444444444444444444444444444',
    });
    const out = await executeFunding(mandate, {
      live: true,
      getNonce: async () => 3,
      transferFn: async () => ({
        hash: '0xdead',
        wait: async () => ({ status: 0, blockNumber: 9 }),
      }),
      auditFunding: async () => ({
        verdict: 'PASS',
        riskScore: 0.05,
        flags: [],
        auditId: 'a4',
        reason: 'ok',
      }),
      broadcast: () => {},
    });
    assert.equal(out.status, 'TX_FAILED');
    assert.ok(out.auditTrace.some((t) => t.includes('tx:reverted')));
  });
});
