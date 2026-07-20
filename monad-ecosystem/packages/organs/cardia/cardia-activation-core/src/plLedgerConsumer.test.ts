import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { FundingMandate } from './cardiaFunding.types.js';
import { handlePlLedgerMessage } from './plLedgerConsumer.js';

describe('plLedgerConsumer → funding', () => {
  it('does not fund without wallet-bind task', () => {
    let funded = false;
    handlePlLedgerMessage(
      {
        principalId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        totalPl: 50,
        taskId: 'archon-comprehension-gate',
        pointsAwarded: 25,
        verifiedBy: 'comprehension-gate',
        timestamp: new Date().toISOString(),
      },
      undefined,
      async () => {
        funded = true;
      },
    );
    assert.equal(funded, false);
  });

  it('fires funding engine on wallet-bind-tier1-activation', async () => {
    let mandate: FundingMandate | null = null;
    handlePlLedgerMessage(
      {
        principalId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        totalPl: 50,
        taskId: 'wallet-bind-tier1-activation',
        pointsAwarded: 0,
        verifiedBy: 'comprehension-gate',
        timestamp: new Date().toISOString(),
      },
      undefined,
      async (m) => {
        mandate = m;
      },
    );
    // microtask for void promise
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(mandate);
    assert.equal(
      (mandate as FundingMandate).principalWallet,
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    );
    assert.equal((mandate as FundingMandate).status, 'PENDING_HEPAR_AUDIT');
  });
});
