/**
 * Sovereign Execution Loop (Vector 5.3) — Capital Mandate + Router B yield split.
 *
 * CapitalMandate: EIP-712 bounded agency (shelichut) from Shaliah → MEV engine.
 * YieldDistribution: 50/40/10 reciprocal loop after profitable trade.
 */

/** EIP-712 domain name for capital mandates. */
export const SOVEREIGN_MANDATE_DOMAIN_NAME = 'SovereignMonadEcosystem';
export const SOVEREIGN_MANDATE_DOMAIN_VERSION = '1.1.0';

/** Kafka topic for loop / yield routing events. */
export const SOVEREIGN_LOOP_TOPIC = 'sovereign.execution.loop.events';

/** Router B split ratios (basis points of 100). */
export const YIELD_SPLIT_PRINCIPAL_BPS = 50;
export const YIELD_SPLIT_SHALIAH_BPS = 40;
export const YIELD_SPLIT_VAULT_BPS = 10;

/** Stablecoin decimals for mandate amount + yield routing. */
export const LOOP_STABLE_DECIMALS = 6;

/**
 * Cryptographic, time-bound, amount-limited permission for the MEV engine.
 * `amountAllocated` is in stablecoin base units (e.g. USDC 6 decimals).
 */
export interface CapitalMandate {
  mandateId: string;
  /** Shaliah principal 0x address. */
  principalWallet: string;
  /** MEV engine operator 0x address. */
  engineOperator: string;
  /** Max notional in base units (uint256-compatible number or string for large values). */
  amountAllocated: number;
  /** Unix timestamp (seconds) when agency ends. */
  expiration: number;
  /** EIP-712 signature from principalWallet. */
  signature: string;
  /** Optional chain id used at signing (for multi-chain verify). */
  chainId?: number;
}

/** Physical Router B distribution after a profitable trade. */
export interface YieldDistribution {
  tradeId: string;
  /** Gross profit USD. */
  grossYield: number;
  splits: {
    /** 50% — Principal treasury. */
    principal: number;
    /** 40% — Shaliah agent treasury. */
    shaliahTreasury: number;
    /** 10% — Ecosystem vault (commons). */
    ecosystemVault: number;
  };
  /** Three transfer tx hashes (or synthetic in dry-run). */
  txHashes: string[];
  /** True when transfers were synthesized (no chain). */
  synthesized?: boolean;
  auditTrace?: string[];
  timestamp?: string;
}

/** Result of mandate verification (richer than boolean for audit). */
export interface MandateVerifyResult {
  valid: boolean;
  reason: string;
  recoveredSigner?: string;
}

/** Loop status events for Control Center / Kafka. */
export type SovereignLoopEventKind =
  | 'MANDATE_VERIFIED'
  | 'MANDATE_REJECTED'
  | 'TRADE_EXECUTED'
  | 'YIELD_ROUTED'
  | 'TRADE_FAILED';

export interface SovereignLoopEvent {
  kind: SovereignLoopEventKind;
  mandateId?: string;
  tradeId?: string;
  principalWallet?: string;
  amountUsd?: number;
  grossYield?: number;
  distribution?: YieldDistribution;
  reason: string;
  auditTrace: string[];
  timestamp: string;
  synthesized?: boolean;
}

/** Convert USD to base units (floored). */
export function loopUsdToBaseUnits(
  usd: number,
  decimals: number = LOOP_STABLE_DECIMALS,
): number {
  if (!Number.isFinite(usd) || usd < 0) return 0;
  return Math.floor(usd * 10 ** decimals);
}

/** Convert base units to USD. */
export function loopBaseUnitsToUsd(
  units: number,
  decimals: number = LOOP_STABLE_DECIMALS,
): number {
  return units / 10 ** decimals;
}

/** Compute 50/40/10 splits in base units (BigInt-safe). */
export function computeYieldSplitsBaseUnits(grossBaseUnits: bigint): {
  principal: bigint;
  shaliahTreasury: bigint;
  ecosystemVault: bigint;
} {
  const principal = (grossBaseUnits * 50n) / 100n;
  const shaliahTreasury = (grossBaseUnits * 40n) / 100n;
  // Remainder goes to vault so sum === gross (no dust stranded)
  const ecosystemVault = grossBaseUnits - principal - shaliahTreasury;
  return { principal, shaliahTreasury, ecosystemVault };
}
