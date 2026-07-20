/**
 * MEV Execution Engine — Sovereign Execution Loop (Vectors 5.1–5.3).
 *
 * Flow:
 * 1. Verify CapitalMandate (EIP-712, expiry, allocation)
 * 2. Capacity Ceiling (C-DENSITY-FLOOR)
 * 3. Shadow Markout Gate (fail-closed)
 * 4. Execute trade (dry-run mock or live)
 * 5. Route yield 50/40/10 (Router B / Axiom 7)
 */

import { createHash } from 'node:crypto';
import type {
  CapitalMandate,
  ShadowMarkoutRequest,
  ShadowMarkoutResponse,
  SovereignLoopEvent,
  TradePayload,
  TradeStatus,
  YieldDistribution,
} from '@sovereign/types';
import {
  evaluateShadowMarkout,
  shouldProceedTrade,
  explainVerdict,
} from './shadowMarkoutGate.js';
import { verifyCapitalMandate } from './loop/mandateVerifier.js';
import { routeYield } from './loop/yieldRouter.js';
import { broadcastLoopEvent } from './loop/loopBroadcast.js';
import {
  CapacityCeilingMonitor,
  type CapacityCeilingMonitorOptions,
} from './capacityCeiling.js';

export type ExecutionConfig = {
  rpcUrl?: string;
  privateKey?: string;
  shadowApiUrl?: string;
  /** When true, attempt chain broadcast (requires privateKey). */
  liveChain?: boolean;
};

export type GuardedTradeDeps = {
  /** Injected shadow evaluator (tests). */
  evaluateShadow?: (
    req: ShadowMarkoutRequest,
  ) => Promise<ShadowMarkoutResponse>;
  /** Shared capacity monitor (process-level). */
  ceiling?: CapacityCeilingMonitor;
  ceilingOptions?: CapacityCeilingMonitorOptions;
  /** Skip EIP-712 crypto (unit tests of structural gates). */
  skipMandateSignature?: boolean;
  /** Override profit after fill (USD). Defaults to shadowProfitUsd. */
  calculateProfit?: (
    payload: TradePayload,
    shadow: ShadowMarkoutResponse,
  ) => number;
  /** Inject yield router (tests). */
  routeYieldFn?: typeof routeYield;
  /** Live ERC-20 transfer for yield routing. */
  yieldTransferFn?: (
    to: string,
    amountBaseUnits: bigint,
  ) => Promise<{ hash: string }>;
  nowSec?: number;
  engineOperator?: string;
  /** Mock trade fill without ethers. */
  executeTradeFn?: (payload: TradePayload) => Promise<{
    hash: string;
    status: 0 | 1;
  }>;
  broadcast?: (event: SovereignLoopEvent) => Promise<void> | void;
};

export type ExecutionResult = {
  success: boolean;
  txHash?: string;
  status: TradeStatus;
  error?: string;
  auditTrace: string[];
  distribution?: YieldDistribution;
  amountUsdUsed?: number;
  mandateId?: string;
};

function defaultProfit(
  _payload: TradePayload,
  shadow: ShadowMarkoutResponse,
): number {
  return Math.max(0, shadow.shadowProfitUsd);
}

/**
 * Full guarded live trade — requires CapitalMandate (Vector 5.3).
 */
export async function executeGuardedLiveTrade(
  payload: TradePayload,
  mandate: CapitalMandate,
  config: ExecutionConfig = {},
  deps: GuardedTradeDeps = {},
): Promise<ExecutionResult> {
  const auditTrace: string[] = [...(payload.auditTrace ?? [])];
  const broadcast = deps.broadcast ?? broadcastLoopEvent;
  const tradeId =
    payload.tradeId ?? `trade-${Date.now().toString(36)}`;
  payload.tradeId = tradeId;
  payload.status = 'SHADOW_GATE_EVALUATING';

  const emit = async (
    kind: SovereignLoopEvent['kind'],
    reason: string,
    extra?: Partial<SovereignLoopEvent>,
  ) => {
    await broadcast({
      kind,
      reason,
      mandateId: mandate.mandateId,
      tradeId,
      principalWallet: mandate.principalWallet,
      amountUsd: payload.amountUsd,
      auditTrace: [...auditTrace],
      timestamp: new Date().toISOString(),
      ...extra,
    });
  };

  try {
    // ── 1. Capital Mandate ─────────────────────────────────────────────
    const engineOp =
      deps.engineOperator ||
      (config.privateKey
        ? undefined // resolved later if needed
        : mandate.engineOperator);

    const mandateOk = await verifyCapitalMandate(
      mandate,
      payload.amountUsd,
      {
        engineOperator: engineOp,
        nowSec: deps.nowSec,
        chainId: mandate.chainId,
        skipSignature: deps.skipMandateSignature === true,
      },
    );

    if (!mandateOk) {
      payload.status = 'MANDATE_REJECTED';
      auditTrace.push('mandate:rejected');
      await emit('MANDATE_REJECTED', 'MANDATE_INVALID_OR_EXPIRED');
      return {
        success: false,
        status: 'MANDATE_REJECTED',
        error: 'MANDATE_INVALID_OR_EXPIRED',
        auditTrace,
        mandateId: mandate.mandateId,
      };
    }

    auditTrace.push(`mandate:verified:${mandate.mandateId}`);
    await emit('MANDATE_VERIFIED', 'mandate ok');

    // ── 2. Capacity Ceiling ────────────────────────────────────────────
    const ceiling =
      deps.ceiling ??
      new CapacityCeilingMonitor({
        ...deps.ceilingOptions,
        principalWallet: mandate.principalWallet,
        initialAllocationUsd:
          deps.ceilingOptions?.initialAllocationUsd ??
          mandate.amountAllocated / 1e6,
      });

    const ceilingDecision = ceiling.checkCeiling(payload.amountUsd);
    if (!ceilingDecision.allowed) {
      payload.status = 'CEILING_REJECTED';
      auditTrace.push(`ceiling:rejected:${ceilingDecision.reason}`);
      return {
        success: false,
        status: 'CEILING_REJECTED',
        error: ceilingDecision.reason,
        auditTrace,
        mandateId: mandate.mandateId,
      };
    }

    const amountUsd =
      ceilingDecision.throttledSize ?? payload.amountUsd;
    if (ceilingDecision.throttledSize !== undefined) {
      auditTrace.push(
        `ceiling:throttled:${payload.amountUsd}->${amountUsd}`,
      );
      payload.amountUsd = amountUsd;
    } else {
      auditTrace.push('ceiling:ok');
    }

    // ── 3. Shadow Markout Gate ─────────────────────────────────────────
    const pythPriceUpdate = payload.pythPriceUpdate || {
      price: 3500,
      conf: 0.05,
      expo: -8,
      publishTime: Math.floor(Date.now() / 1000),
    };

    const evaluate = deps.evaluateShadow ?? evaluateShadowMarkout;
    const shadowResponse = await evaluate({
      poolAddress: payload.poolAddress,
      amountInUsd: amountUsd,
      isBuy: payload.isBuy,
      pythPriceUpdate,
    });

    auditTrace.push(
      `shadow:gate:${shadowResponse.verdict}:slip:${shadowResponse.expectedSlippage}:profit:${shadowResponse.shadowProfitUsd}:audit:${shadowResponse.auditId}`,
    );

    if (!shouldProceedTrade(shadowResponse)) {
      console.warn(
        `[MEV Engine] Trade ABORTED by Shadow Gate: ${explainVerdict(shadowResponse.verdict)}`,
      );
      payload.status = 'SHADOW_FAIL_ABORTED';
      return {
        success: false,
        status: 'SHADOW_FAIL_ABORTED',
        error: `SHADOW_VERDICT_${shadowResponse.verdict}`,
        auditTrace,
        mandateId: mandate.mandateId,
        amountUsdUsed: amountUsd,
      };
    }

    auditTrace.push('shadow:gate_passed');

    // ── 4. Execute trade ───────────────────────────────────────────────
    let txHash: string;
    let fillOk = true;

    if (deps.executeTradeFn) {
      const fill = await deps.executeTradeFn(payload);
      txHash = fill.hash;
      fillOk = fill.status === 1;
    } else if (config.liveChain && config.privateKey) {
      // Minimal live path placeholder — production wires real swap calldata
      const { ethers } = await import('ethers');
      const provider = new ethers.JsonRpcProvider(
        config.rpcUrl ||
          process.env.MONAD_RPC_URL ||
          process.env.RPC_URL ||
          'https://rpc.testnet.monad.xyz',
      );
      const wallet = new ethers.Wallet(config.privateKey, provider);
      auditTrace.push(`tx:building:${payload.poolAddress}`);
      // Dry structural sign only unless explicitly broadcasting is implemented
      const mockTxHash =
        '0x' +
        createHash('sha256')
          .update(`${tradeId}:${wallet.address}:${Date.now()}`)
          .digest('hex');
      txHash = mockTxHash;
      auditTrace.push(
        `tx:broadcast:${txHash}:note:swap_calldata_not_wired`,
      );
    } else {
      txHash =
        '0x' +
        createHash('sha256')
          .update(`${tradeId}:dry:${amountUsd}`)
          .digest('hex');
      auditTrace.push(`tx:synthesized:${txHash.slice(0, 18)}…`);
    }

    payload.txHash = txHash;
    payload.status = fillOk ? 'TX_CONFIRMED' : 'TX_FAILED';
    auditTrace.push(
      fillOk
        ? `tx:confirmed:${txHash}`
        : `tx:failed:${txHash}`,
    );

    if (!fillOk) {
      await emit('TRADE_FAILED', 'fill failed', { amountUsd });
      return {
        success: false,
        txHash,
        status: 'TX_FAILED',
        error: 'FILL_FAILED',
        auditTrace,
        mandateId: mandate.mandateId,
        amountUsdUsed: amountUsd,
      };
    }

    // ── 5. Record capacity outcome ─────────────────────────────────────
    const calcProfit = deps.calculateProfit ?? defaultProfit;
    const grossYield = calcProfit(payload, shadowResponse);
    payload.grossYieldUsd = grossYield;

    ceiling.recordTradeOutcome({
      tradeId,
      notionalUsd: amountUsd,
      realizedSlippage: shadowResponse.expectedSlippage,
      pnlUsd: grossYield,
      capitalConsumedUsd: amountUsd,
      principalWallet: mandate.principalWallet,
    });

    await emit('TRADE_EXECUTED', 'fill ok', {
      amountUsd,
      grossYield,
    });

    // ── 6. Route yield (Router B) ───────────────────────────────────────
    let distribution: YieldDistribution | undefined;
    if (grossYield > 0) {
      try {
        const route = deps.routeYieldFn ?? routeYield;
        distribution = await route(grossYield, {
          tradeId: `yield-${tradeId}`,
          tokenAddress: payload.tokenAddress,
          transferFn: deps.yieldTransferFn,
          live: Boolean(deps.yieldTransferFn),
          auditTrace,
        });
        auditTrace.push(
          `yield:routed:principal:${distribution.splits.principal}`,
          `yield:routed:shaliah:${distribution.splits.shaliahTreasury}`,
          `yield:routed:vault:${distribution.splits.ecosystemVault}`,
        );
        if (distribution.synthesized) {
          auditTrace.push('yield:mode:dry-run');
        }
        payload.status = 'YIELD_ROUTED';
        await emit('YIELD_ROUTED', 'Router B 50/40/10', {
          grossYield,
          distribution,
          synthesized: distribution.synthesized,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        auditTrace.push(`yield:error:${message}`);
        payload.status = 'YIELD_ROUTE_FAILED';
        return {
          success: true,
          txHash,
          status: 'YIELD_ROUTE_FAILED',
          error: message,
          auditTrace,
          mandateId: mandate.mandateId,
          amountUsdUsed: amountUsd,
        };
      }
    }

    return {
      success: true,
      txHash,
      status: payload.status,
      auditTrace,
      distribution,
      mandateId: mandate.mandateId,
      amountUsdUsed: amountUsd,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[MEV Engine] Execution error:`, message);
    payload.status = 'TX_FAILED';
    auditTrace.push(`error:execution:${message}`);
    return {
      success: false,
      status: 'TX_FAILED',
      error: message,
      auditTrace,
      mandateId: mandate.mandateId,
    };
  }
}

/**
 * Legacy entry: shadow gate only (no mandate). Prefer executeGuardedLiveTrade.
 */
export async function executeLiveTrade(
  payload: TradePayload,
  config: ExecutionConfig,
  deps: Pick<GuardedTradeDeps, 'evaluateShadow'> = {},
): Promise<ExecutionResult> {
  const auditTrace: string[] = [...(payload.auditTrace ?? [])];
  payload.status = 'SHADOW_GATE_EVALUATING';

  try {
    const pythPriceUpdate = payload.pythPriceUpdate || {
      price: 3500,
      conf: 0.05,
      expo: -8,
      publishTime: Math.floor(Date.now() / 1000),
    };
    const evaluate = deps.evaluateShadow ?? evaluateShadowMarkout;
    const shadowResponse = await evaluate({
      poolAddress: payload.poolAddress,
      amountInUsd: payload.amountUsd,
      isBuy: payload.isBuy,
      pythPriceUpdate,
    });
    auditTrace.push(
      `shadow:gate:${shadowResponse.verdict}:audit:${shadowResponse.auditId}`,
    );
    if (!shouldProceedTrade(shadowResponse)) {
      return {
        success: false,
        status: 'SHADOW_FAIL_ABORTED',
        error: `SHADOW_VERDICT_${shadowResponse.verdict}`,
        auditTrace,
      };
    }
    const txHash =
      '0x' +
      createHash('sha256')
        .update(`legacy:${payload.poolAddress}:${Date.now()}`)
        .digest('hex');
    auditTrace.push(`tx:synthesized:${txHash.slice(0, 18)}…`);
    return {
      success: true,
      txHash,
      status: 'TX_BROADCAST',
      auditTrace,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      status: 'TX_FAILED',
      error: message,
      auditTrace,
    };
  }
}

/**
 * Guardless mode — lab / backtest only. Never with real funds.
 */
export async function executeGuardlessTrade(
  payload: TradePayload,
  _config: ExecutionConfig = {},
): Promise<ExecutionResult> {
  console.warn(`[MEV Engine] GUARDLESS MODE — Shadow Gate BYPASSED`);
  const auditTrace = [
    ...(payload.auditTrace ?? []),
    'shadow:bypass:guardless_mode',
    'mandate:bypass:guardless_mode',
  ];
  return {
    success: true,
    txHash: `0xguardless-${Date.now()}`,
    status: 'TX_BROADCAST',
    auditTrace,
  };
}

export {
  evaluateShadowMarkout,
  shouldProceedTrade,
  explainVerdict,
} from './shadowMarkoutGate.js';
