import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Wallet } from 'ethers';
import { PLLedger } from './plLedger.js';
import {
  buildBindMessage,
  buildWalletBindEvent,
  TIER_1_PL_MINIMUM,
  verifyWalletBind,
  WALLET_BIND_TASK_ID,
} from './walletBind.js';
import { bindWallet } from './walletBindService.js';

describe('walletBind', () => {
  it('verifies EIP-191 signature and requires PL ≥ 50', async () => {
    const wallet = Wallet.createRandom();
    const ledger = new PLLedger();
    const localId = 'principal:local-test';
    const now = Date.now();

    // Seed server PL via three onboarding-style task events with custom points
    ledger.append(
      {
        kind: 'domain_task',
        eventId: 'e1',
        principalId: localId,
        domain: 'agent_ops',
        taskId: 'broken-genesis-repair',
        outcome: 'passed',
        verifiedBy: 'task-verifier',
        at: now - 3000,
        points: 10,
      },
      now,
    );
    ledger.append(
      {
        kind: 'domain_task',
        eventId: 'e2',
        principalId: localId,
        domain: 'agent_ops',
        taskId: 'quarantine-refusal-literacy',
        outcome: 'passed',
        verifiedBy: 'task-verifier',
        at: now - 2000,
        points: 15,
      },
      now,
    );
    ledger.append(
      {
        kind: 'comprehension_gate',
        eventId: 'e3',
        principalId: localId,
        domain: 'agent_ops',
        passed: true,
        gateId: 'archon-comprehension-gate',
        verifiedBy: 'comprehension-gate',
        at: now - 1000,
        points: 25,
      },
      now,
    );

    const score = ledger.compute(localId, 'agent_ops', now).score;
    assert.ok(score >= TIER_1_PL_MINIMUM);

    const message = buildBindMessage({
      localPrincipalId: localId,
      walletAddress: wallet.address,
      pl: score,
      timestamp: now,
    });
    const signature = await wallet.signMessage(message);

    const v = verifyWalletBind(
      {
        localPrincipalId: localId,
        walletAddress: wallet.address,
        signature,
        message,
      },
      ledger,
      { now },
    );
    assert.equal(v.ok, true);
    if (!v.ok) return;
    assert.equal(v.recoveredAddress.toLowerCase(), wallet.address.toLowerCase());

    const event = buildWalletBindEvent(
      {
        localPrincipalId: localId,
        walletAddress: wallet.address,
        signature,
        message,
      },
      v,
      now,
    );
    assert.equal(event.principalId, wallet.address);
    assert.equal(event.taskId, WALLET_BIND_TASK_ID);
    assert.equal(event.tier, 'TIER_1_MESHALEACH');
    assert.ok(event.auditTrace.some((t) => t.includes('verify-signature')));
  });

  it('rejects insufficient PL', async () => {
    const wallet = Wallet.createRandom();
    const ledger = new PLLedger();
    const localId = 'principal:poor';
    const now = Date.now();
    const message = buildBindMessage({
      localPrincipalId: localId,
      walletAddress: wallet.address,
      pl: 0,
      timestamp: now,
    });
    const signature = await wallet.signMessage(message);
    const v = verifyWalletBind(
      {
        localPrincipalId: localId,
        walletAddress: wallet.address,
        signature,
        message,
      },
      ledger,
      { now },
    );
    assert.equal(v.ok, false);
    if (!v.ok) assert.equal(v.error, 'INSUFFICIENT_PL');
  });

  it('bindWallet local synthesis without Kafka', async () => {
    const wallet = Wallet.createRandom();
    const ledger = new PLLedger();
    const localId = 'principal:local-syn';
    const now = Date.now();
    ledger.append(
      {
        kind: 'comprehension_gate',
        eventId: 'big',
        principalId: localId,
        domain: 'agent_ops',
        passed: true,
        gateId: 'seed',
        verifiedBy: 'comprehension-gate',
        at: now,
        points: 50,
      },
      now,
    );
    const message = buildBindMessage({
      localPrincipalId: localId,
      walletAddress: wallet.address,
      pl: 50,
      timestamp: now,
    });
    const signature = await wallet.signMessage(message);
    const out = await bindWallet(
      {
        localPrincipalId: localId,
        walletAddress: wallet.address,
        signature,
        message,
      },
      { ledger, kafkaEnabled: false },
      now,
    );
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.status, 'WALLET_BOUND_LOCAL');
    assert.equal(out.walletAddress.toLowerCase(), wallet.address.toLowerCase());
  });
});
