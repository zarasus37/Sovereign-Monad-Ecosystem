import { describe, it, expect, vi } from 'vitest';
import { Wallet } from 'ethers';
import { executeGuardedLiveTrade } from './executionEngine.js';
import { signCapitalMandate } from './loop/mandateSigner.js';
import {
  verifyCapitalMandate,
  verifyCapitalMandateDetailed,
} from './loop/mandateVerifier.js';
import { routeYield } from './loop/yieldRouter.js';
import { CapacityCeilingMonitor } from './capacityCeiling.js';
import { computeYieldSplitsBaseUnits, loopUsdToBaseUnits } from '@sovereign/types';
import type { TradePayload } from '@sovereign/types';

const ENGINE = '0x1111111111111111111111111111111111111111';
const POOL = '0x2222222222222222222222222222222222222222';

function basePayload(over: Partial<TradePayload> = {}): TradePayload {
  return {
    poolAddress: POOL,
    amountUsd: 1_000,
    isBuy: true,
    assetPair: 'ETH/USDC',
    tokenAddress: '0x3333333333333333333333333333333333333333',
    status: 'PENDING',
    auditTrace: ['test:start'],
    ...over,
  };
}

const passShadow = async () => ({
  verdict: 'PASS' as const,
  expectedSlippage: 0.005,
  shadowProfitUsd: 25,
  auditId: 'shadow-test-1',
});

describe('CapitalMandate EIP-712', () => {
  it('signs and verifies a valid mandate', async () => {
    const wallet = Wallet.createRandom();
    const mandate = await signCapitalMandate(wallet, {
      engineOperator: ENGINE,
      amountAllocatedUsd: 15_000,
      ttlSeconds: 3600,
      chainId: 101010,
    });

    expect(mandate.principalWallet).toBe(wallet.address);
    expect(mandate.amountAllocated).toBe(loopUsdToBaseUnits(15_000));
    expect(mandate.signature.startsWith('0x')).toBe(true);

    const ok = await verifyCapitalMandate(mandate, 1_000, {
      engineOperator: ENGINE,
      chainId: 101010,
    });
    expect(ok).toBe(true);
  });

  it('rejects expired mandate', async () => {
    const wallet = Wallet.createRandom();
    const mandate = await signCapitalMandate(wallet, {
      engineOperator: ENGINE,
      amountAllocatedUsd: 15_000,
      ttlSeconds: 10,
      nowSec: 1_000_000,
      chainId: 101010,
    });
    const structural = verifyCapitalMandateDetailed(mandate, {
      proposedTradeUsd: 100,
      nowSec: 1_000_000 + 11,
    });
    expect(structural.valid).toBe(false);
    expect(structural.reason).toBe('MANDATE_EXPIRED');
  });

  it('rejects trade above allocation', async () => {
    const wallet = Wallet.createRandom();
    const mandate = await signCapitalMandate(wallet, {
      engineOperator: ENGINE,
      amountAllocatedUsd: 15_000,
      chainId: 101010,
    });
    const structural = verifyCapitalMandateDetailed(mandate, {
      proposedTradeUsd: 20_000,
    });
    expect(structural.valid).toBe(false);
    expect(structural.reason).toBe('EXCEEDS_MANDATE_ALLOCATION');
  });
});

describe('Yield Router 50/40/10', () => {
  it('computes splits without dust remainder', () => {
    const gross = 1_000_000n; // $1 in 6 decimals
    const s = computeYieldSplitsBaseUnits(gross);
    expect(s.principal + s.shaliahTreasury + s.ecosystemVault).toBe(gross);
    expect(s.principal).toBe(500_000n);
    expect(s.shaliahTreasury).toBe(400_000n);
    expect(s.ecosystemVault).toBe(100_000n);
  });

  it('dry-run routes without chain', async () => {
    const dist = await routeYield(100, { live: false, tradeId: 'y1' });
    expect(dist.synthesized).toBe(true);
    expect(dist.splits.principal).toBeCloseTo(50, 5);
    expect(dist.splits.shaliahTreasury).toBeCloseTo(40, 5);
    expect(dist.splits.ecosystemVault).toBeCloseTo(10, 5);
    expect(dist.txHashes).toHaveLength(3);
  });

  it('live path calls three transfers', async () => {
    const calls: Array<{ to: string; amt: bigint }> = [];
    const dist = await routeYield(10, {
      live: true,
      principalTreasury: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      shaliahTreasury: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      ecosystemVault: '0xcccccccccccccccccccccccccccccccccccccccc',
      transferFn: async (to, amountBaseUnits) => {
        calls.push({ to, amt: amountBaseUnits });
        return { hash: `0x${calls.length}` };
      },
    });
    expect(dist.synthesized).toBe(false);
    expect(calls).toHaveLength(3);
    expect(calls[0].amt + calls[1].amt + calls[2].amt).toBe(
      BigInt(loopUsdToBaseUnits(10)),
    );
  });
});

describe('executeGuardedLiveTrade loop', () => {
  it('rejects invalid mandate before shadow', async () => {
    const wallet = Wallet.createRandom();
    const mandate = await signCapitalMandate(wallet, {
      engineOperator: ENGINE,
      amountAllocatedUsd: 15_000,
      nowSec: 1_000,
      ttlSeconds: 1,
      chainId: 101010,
    });
    const result = await executeGuardedLiveTrade(
      basePayload(),
      mandate,
      {},
      {
        nowSec: 1_000 + 100,
        skipMandateSignature: true,
        evaluateShadow: passShadow,
        broadcast: () => {},
      },
    );
    expect(result.success).toBe(false);
    expect(result.status).toBe('MANDATE_REJECTED');
  });

  it('runs mandate → ceiling → shadow → yield dry-run', async () => {
    const wallet = Wallet.createRandom();
    const mandate = await signCapitalMandate(wallet, {
      engineOperator: ENGINE,
      amountAllocatedUsd: 15_000,
      chainId: 101010,
    });
    const ceiling = new CapacityCeilingMonitor({
      initialAllocationUsd: 15_000,
      emitEvent: () => {},
    });
    const events: string[] = [];
    const result = await executeGuardedLiveTrade(
      basePayload({ amountUsd: 500 }),
      mandate,
      {},
      {
        ceiling,
        evaluateShadow: passShadow,
        calculateProfit: () => 20,
        executeTradeFn: async () => ({ hash: '0xabc', status: 1 }),
        broadcast: (e) => {
          events.push(e.kind);
        },
      },
    );

    expect(result.success).toBe(true);
    expect(result.status).toBe('YIELD_ROUTED');
    expect(result.distribution?.splits.principal).toBeCloseTo(10, 5);
    expect(result.auditTrace.some((t) => t.includes('mandate:verified'))).toBe(
      true,
    );
    expect(result.auditTrace.some((t) => t.includes('yield:routed:principal'))).toBe(
      true,
    );
    expect(events).toContain('MANDATE_VERIFIED');
    expect(events).toContain('TRADE_EXECUTED');
    expect(events).toContain('YIELD_ROUTED');
  });

  it('aborts on shadow FAIL without yield', async () => {
    const wallet = Wallet.createRandom();
    const mandate = await signCapitalMandate(wallet, {
      engineOperator: ENGINE,
      amountAllocatedUsd: 15_000,
      chainId: 101010,
    });
    const result = await executeGuardedLiveTrade(
      basePayload(),
      mandate,
      {},
      {
        evaluateShadow: async () => ({
          verdict: 'FAIL_ADVERSE_SELECTION',
          expectedSlippage: 0.5,
          shadowProfitUsd: -100,
          auditId: 'bad',
        }),
        broadcast: () => {},
      },
    );
    expect(result.success).toBe(false);
    expect(result.status).toBe('SHADOW_FAIL_ABORTED');
    expect(result.distribution).toBeUndefined();
  });

  it('ceiling halt blocks trade', async () => {
    const wallet = Wallet.createRandom();
    const mandate = await signCapitalMandate(wallet, {
      engineOperator: ENGINE,
      amountAllocatedUsd: 15_000,
      chainId: 101010,
    });
    const ceiling = new CapacityCeilingMonitor({
      initialAllocationUsd: 15_000,
      densityFloor: 0.02,
      emitEvent: () => {},
    });
    for (let i = 0; i < 5; i++) {
      ceiling.recordTradeOutcome({
        tradeId: `x${i}`,
        notionalUsd: 1,
        realizedSlippage: 0.05,
        pnlUsd: 0,
        capitalConsumedUsd: 1,
      });
    }
    const result = await executeGuardedLiveTrade(
      basePayload(),
      mandate,
      {},
      {
        ceiling,
        evaluateShadow: passShadow,
        broadcast: () => {},
      },
    );
    expect(result.success).toBe(false);
    expect(result.status).toBe('CEILING_REJECTED');
  });
});
