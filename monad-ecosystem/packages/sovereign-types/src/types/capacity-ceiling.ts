/**
 * Capacity Ceiling — dynamic allocation guard for Meshaleach Tier-1 capital (Vector 5.2).
 *
 * After Cardia funds ~$15k, monad-mev must not burn the envelope via adverse slippage.
 * C-DENSITY-FLOOR: if rolling realized slippage exceeds the density floor, halt new risk.
 */

/** Kafka topic for capacity ceiling lifecycle events. */
export const CAPACITY_CEILING_TOPIC = 'sovereign.capacity.ceiling.events';

/** Default Tier-1 envelope (USD). Matches Cardia TIER_1_FUNDING_USD. */
export const CAPACITY_CEILING_DEFAULT_ALLOCATION_USD = 15_000;

/** Stablecoin base-unit decimals (USDC). */
export const CAPACITY_CEILING_STABLE_DECIMALS = 6;

/** C-DENSITY-FLOOR — halt new trades when rolling avg slippage ≥ this (2%). */
export const C_DENSITY_FLOOR_DEFAULT = 0.02;

/** Warning band lower bound — proportional throttle between this and density floor (1%). */
export const C_DENSITY_WARNING_DEFAULT = 0.01;

/** Stop trading when remaining allocation falls below this USD floor. */
export const CAPACITY_MIN_FLOOR_USD_DEFAULT = 500;

/** Rolling window of trade outcomes for slippage average. */
export const CAPACITY_ROLLING_WINDOW_DEFAULT = 10;

export type CapacityCeilingEventKind =
  | 'CAPACITY_EXHAUSTED'
  | 'DENSITY_FLOOR_HALT'
  | 'THROTTLE_ACTIVE'
  | 'TRADE_RECORDED'
  | 'CEILING_RESET'
  | 'TOP_UP';

/**
 * Outcome of a completed (or simulated) MEV/arb trade.
 * Slippage is a fraction: 0.015 = 1.5% adverse.
 */
export interface TradeOutcome {
  tradeId: string;
  /** Gross notional in USD. */
  notionalUsd: number;
  /** Realized adverse slippage as a fraction of notional (0–1+). */
  realizedSlippage: number;
  /** Realized PnL in USD (may be negative). */
  pnlUsd: number;
  /**
   * Capital drawn from the ceiling envelope (USD).
   * Defaults to notionalUsd when omitted.
   */
  capitalConsumedUsd?: number;
  timestamp?: string;
  principalWallet?: string;
}

/** Result of pre-trade ceiling check. */
export interface CeilingDecision {
  allowed: boolean;
  reason: string;
  /** When allowed but size-reduced, the max USD size permitted. */
  throttledSize?: number;
  /** Rolling average slippage used for the decision (if available). */
  avgSlippage?: number;
  remainingAllocationUsd?: number;
}

/** Tunable monitor configuration. */
export interface CapacityCeilingConfig {
  /** Starting envelope in USD (default 15_000). */
  initialAllocationUsd?: number;
  /** Stablecoin decimals for base-unit accounting (default 6). */
  stablecoinDecimals?: number;
  /** C-DENSITY-FLOOR fraction (default 0.02). */
  densityFloor?: number;
  /** Warning / throttle lower bound (default 0.01). */
  warningThreshold?: number;
  /** Rolling window length (default 10). */
  rollingWindowSize?: number;
  /** Halt when remaining USD &lt; this (default 500). */
  minAllocationFloorUsd?: number;
  /** Optional principal for event correlation. */
  principalWallet?: string;
  /**
   * Injected event sink (tests). When omitted, default Kafka-behind-KAFKA_ENABLED
   * broadcaster is used from the monitor package.
   */
  emitEvent?: (event: CapacityCeilingEvent) => void | Promise<void>;
}

/** Event published to sovereign.capacity.ceiling.events (+ optional bus). */
export interface CapacityCeilingEvent {
  kind: CapacityCeilingEventKind;
  remainingAllocationUsd: number;
  /** Base units as string (bigint-safe for Kafka JSON). */
  remainingAllocationBaseUnits: string;
  avgSlippage?: number;
  tradeId?: string;
  reason: string;
  timestamp: string;
  principalWallet?: string;
  /** Extra audit crumbs. */
  auditTrace?: string[];
}

/** Convert USD notional to stablecoin base units (integer string). */
export function usdToStableBaseUnits(
  usd: number,
  decimals: number = CAPACITY_CEILING_STABLE_DECIMALS,
): bigint {
  if (!Number.isFinite(usd) || usd < 0) {
    throw new Error(`usdToStableBaseUnits: invalid usd=${usd}`);
  }
  const scale = 10 ** decimals;
  return BigInt(Math.round(usd * scale));
}

/** Convert base units back to USD number (display / throttle math). */
export function stableBaseUnitsToUsd(
  units: bigint,
  decimals: number = CAPACITY_CEILING_STABLE_DECIMALS,
): number {
  const scale = 10 ** decimals;
  return Number(units) / scale;
}
