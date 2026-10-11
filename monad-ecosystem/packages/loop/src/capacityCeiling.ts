/**
 * CapacityCeilingMonitor — dynamic allocation guard for Meshaleach capital (Vector 5.2).
 *
 * Tracks remaining Tier-1 allocation in stablecoin base units, enforces C-DENSITY-FLOOR
 * on rolling realized slippage, and throttles size in the warning band.
 */

import type {
  CapacityCeilingConfig,
  CapacityCeilingEvent,
  CeilingDecision,
  TradeOutcome,
} from '@sovereign/types';
import {
  CAPACITY_CEILING_DEFAULT_ALLOCATION_USD,
  CAPACITY_CEILING_STABLE_DECIMALS,
  CAPACITY_MIN_FLOOR_USD_DEFAULT,
  CAPACITY_ROLLING_WINDOW_DEFAULT,
  C_DENSITY_FLOOR_DEFAULT,
  C_DENSITY_WARNING_DEFAULT,
  stableBaseUnitsToUsd,
  usdToStableBaseUnits,
} from '@sovereign/types';
import {
  defaultCapacityCeilingEmit,
  type CapacityEmitFn,
} from './capacityCeilingEmit.js';

export type CapacityCeilingMonitorOptions = CapacityCeilingConfig & {
  /** Override default emit (tests inject a spy). */
  emitEvent?: CapacityEmitFn;
};

export class CapacityCeilingMonitor {
  private remainingBase: bigint;
  private readonly decimals: number;
  private readonly densityFloor: number;
  private readonly warningThreshold: number;
  private readonly windowSize: number;
  private readonly minFloorUsd: number;
  private readonly principalWallet?: string;
  private readonly emitEvent: CapacityEmitFn;

  /** Rolling window of realized slip fractions (oldest → newest). */
  private readonly window: number[] = [];

  private densityHalted = false;
  private exhausted = false;

  constructor(opts: CapacityCeilingMonitorOptions = {}) {
    this.decimals = opts.stablecoinDecimals ?? CAPACITY_CEILING_STABLE_DECIMALS;
    const initialUsd =
      opts.initialAllocationUsd ?? CAPACITY_CEILING_DEFAULT_ALLOCATION_USD;
    this.remainingBase = usdToStableBaseUnits(initialUsd, this.decimals);
    this.densityFloor = opts.densityFloor ?? C_DENSITY_FLOOR_DEFAULT;
    this.warningThreshold = opts.warningThreshold ?? C_DENSITY_WARNING_DEFAULT;
    this.windowSize = opts.rollingWindowSize ?? CAPACITY_ROLLING_WINDOW_DEFAULT;
    this.minFloorUsd = opts.minAllocationFloorUsd ?? CAPACITY_MIN_FLOOR_USD_DEFAULT;
    this.principalWallet = opts.principalWallet;
    this.emitEvent = opts.emitEvent ?? defaultCapacityCeilingEmit;

    if (this.warningThreshold >= this.densityFloor) {
      throw new Error(
        'CapacityCeiling: warningThreshold must be < densityFloor (C-DENSITY-FLOOR)',
      );
    }
  }

  /** Remaining allocation in USD. */
  get remainingAllocationUsd(): number {
    return stableBaseUnitsToUsd(this.remainingBase, this.decimals);
  }

  /** Remaining allocation in stablecoin base units. */
  get remainingAllocationBaseUnits(): bigint {
    return this.remainingBase;
  }

  get isDensityHalted(): boolean {
    return this.densityHalted;
  }

  get isExhausted(): boolean {
    return this.exhausted;
  }

  get isHalted(): boolean {
    return this.densityHalted || this.exhausted;
  }

  /** Current rolling average slippage (0 if window empty). */
  avgSlippage(): number {
    if (this.window.length === 0) return 0;
    const sum = this.window.reduce((a, b) => a + b, 0);
    return sum / this.window.length;
  }

  /** Snapshot of the rolling window (copy). */
  getRollingWindow(): readonly number[] {
    return [...this.window];
  }

  /**
   * Pre-trade gate: may allow, throttle, or deny based on slippage density
   * and remaining allocation.
   */
  checkCeiling(proposedTradeUsd: number): CeilingDecision {
    if (!Number.isFinite(proposedTradeUsd) || proposedTradeUsd <= 0) {
      return {
        allowed: false,
        reason: 'INVALID_PROPOSED_SIZE',
        remainingAllocationUsd: this.remainingAllocationUsd,
      };
    }

    const remainingUsd = this.remainingAllocationUsd;
    const avg = this.avgSlippage();

    if (this.exhausted) {
      return {
        allowed: false,
        reason: 'CAPACITY_EXHAUSTED',
        avgSlippage: avg,
        remainingAllocationUsd: remainingUsd,
      };
    }

    if (this.densityHalted || avg >= this.densityFloor) {
      if (!this.densityHalted && avg >= this.densityFloor) {
        this.densityHalted = true;
        void this.publish({
          kind: 'DENSITY_FLOOR_HALT',
          reason: `C-DENSITY-FLOOR breached: avgSlippage=${avg.toFixed(4)} ≥ ${this.densityFloor}`,
          avgSlippage: avg,
        });
      }
      return {
        allowed: false,
        reason: 'C_DENSITY_FLOOR',
        avgSlippage: avg,
        remainingAllocationUsd: remainingUsd,
      };
    }

    if (remainingUsd < this.minFloorUsd) {
      return {
        allowed: false,
        reason: 'BELOW_MIN_FLOOR',
        avgSlippage: avg,
        remainingAllocationUsd: remainingUsd,
      };
    }

    // Cap by remaining envelope
    let size = Math.min(proposedTradeUsd, remainingUsd);

    // Warning band: proportional throttle
    if (avg >= this.warningThreshold && avg < this.densityFloor) {
      const span = this.densityFloor - this.warningThreshold;
      const excess = avg - this.warningThreshold;
      const factor = Math.max(0, 1 - excess / span);
      const throttled = size * factor;
      if (throttled <= 0) {
        return {
          allowed: false,
          reason: 'THROTTLE_TO_ZERO',
          avgSlippage: avg,
          remainingAllocationUsd: remainingUsd,
        };
      }
      void this.publish({
        kind: 'THROTTLE_ACTIVE',
        reason: `slippage warning band: avg=${avg.toFixed(4)} factor=${factor.toFixed(3)}`,
        avgSlippage: avg,
      });
      return {
        allowed: true,
        reason: 'THROTTLED',
        throttledSize: throttled,
        avgSlippage: avg,
        remainingAllocationUsd: remainingUsd,
      };
    }

    if (size < proposedTradeUsd) {
      return {
        allowed: true,
        reason: 'CAPPED_TO_REMAINING',
        throttledSize: size,
        avgSlippage: avg,
        remainingAllocationUsd: remainingUsd,
      };
    }

    return {
      allowed: true,
      reason: 'OK',
      avgSlippage: avg,
      remainingAllocationUsd: remainingUsd,
    };
  }

  /**
   * Record a completed trade: update rolling slippage, debit allocation,
   * and emit CAPACITY_EXHAUSTED when envelope is spent down.
   */
  recordTradeOutcome(outcome: TradeOutcome): void {
    const slip = Math.max(0, outcome.realizedSlippage);
    this.window.push(slip);
    while (this.window.length > this.windowSize) {
      this.window.shift();
    }

    const consumed =
      outcome.capitalConsumedUsd ?? outcome.notionalUsd;
    const consumeBase = usdToStableBaseUnits(
      Math.max(0, consumed),
      this.decimals,
    );
    this.remainingBase =
      this.remainingBase > consumeBase
        ? this.remainingBase - consumeBase
        : 0n;

    // PnL can restore a fraction of capacity when positive (honest recycling)
    if (outcome.pnlUsd > 0) {
      this.remainingBase += usdToStableBaseUnits(
        outcome.pnlUsd,
        this.decimals,
      );
    }

    const avg = this.avgSlippage();

    // Density halt sticky while avg ≥ floor; clear when window recovers
    if (avg >= this.densityFloor) {
      if (!this.densityHalted) {
        this.densityHalted = true;
        void this.publish({
          kind: 'DENSITY_FLOOR_HALT',
          reason: `C-DENSITY-FLOOR after trade ${outcome.tradeId}: avg=${avg.toFixed(4)}`,
          avgSlippage: avg,
          tradeId: outcome.tradeId,
        });
      }
    } else {
      this.densityHalted = false;
    }

    void this.publish({
      kind: 'TRADE_RECORDED',
      reason: `recorded ${outcome.tradeId} slip=${slip} pnl=${outcome.pnlUsd}`,
      avgSlippage: avg,
      tradeId: outcome.tradeId,
    });

    const remainingUsd = this.remainingAllocationUsd;
    if (remainingUsd < this.minFloorUsd && !this.exhausted) {
      this.exhausted = true;
      void this.publish({
        kind: 'CAPACITY_EXHAUSTED',
        reason: `remaining $${remainingUsd.toFixed(2)} < min floor $${this.minFloorUsd}`,
        avgSlippage: avg,
        tradeId: outcome.tradeId,
      });
    }
  }

  /** Restore envelope (e.g. Cardia top-up). Clears exhaustion if above min floor. */
  topUp(usd: number): void {
    if (!Number.isFinite(usd) || usd <= 0) return;
    this.remainingBase += usdToStableBaseUnits(usd, this.decimals);
    if (this.remainingAllocationUsd >= this.minFloorUsd) {
      this.exhausted = false;
    }
    void this.publish({
      kind: 'TOP_UP',
      reason: `top-up $${usd}`,
      avgSlippage: this.avgSlippage(),
    });
  }

  /** Clear rolling window and density halt (does not restore allocation). */
  resetWindow(): void {
    this.window.length = 0;
    this.densityHalted = false;
    void this.publish({
      kind: 'CEILING_RESET',
      reason: 'rolling window cleared',
      avgSlippage: 0,
    });
  }

  private publish(
    partial: Pick<CapacityCeilingEvent, 'kind' | 'reason'> &
      Partial<CapacityCeilingEvent>,
  ): void {
    const event: CapacityCeilingEvent = {
      kind: partial.kind,
      reason: partial.reason,
      remainingAllocationUsd: this.remainingAllocationUsd,
      remainingAllocationBaseUnits: this.remainingBase.toString(),
      avgSlippage: partial.avgSlippage ?? this.avgSlippage(),
      tradeId: partial.tradeId,
      timestamp: new Date().toISOString(),
      principalWallet: partial.principalWallet ?? this.principalWallet,
      auditTrace: partial.auditTrace,
    };
    try {
      const result = this.emitEvent(event);
      if (result && typeof (result as Promise<void>).then === 'function') {
        void (result as Promise<void>).catch((err) =>
          console.error('[CapacityCeiling] emit failed:', err),
        );
      }
    } catch (err) {
      console.error('[CapacityCeiling] emit failed:', err);
    }
  }
}
