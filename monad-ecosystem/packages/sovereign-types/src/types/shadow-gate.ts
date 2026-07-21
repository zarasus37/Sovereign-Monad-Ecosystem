/**
 * Shadow Markout Gate Types
 * 
 * Synchronous bridge between TS execution engine and Python analytical engine.
 * Enforces the Fail-Closed Doctrine for live MEV trading.
 */

export type ShadowVerdict = 
  | 'PASS' 
  | 'FAIL_ADVERSE_SELECTION' 
  | 'FAIL_STALE_PRICE' 
  | 'FAIL_CAPACITY_EXCEEDED' 
  | 'ERROR_SERVICE_UNAVAILABLE';

/** Request payload for shadow markout evaluation. */
export interface ShadowMarkoutRequest {
  poolAddress: string;
  amountInUsd: number;
  isBuy: boolean;
  /** The Pyth price update data (VAA or parsed price feed) */
  pythPriceUpdate: {
    price: number;
    conf: number;
    expo: number;
    publishTime: number;
  };
}

/** Response from the shadow markout engine. */
export interface ShadowMarkoutResponse {
  verdict: ShadowVerdict;
  expectedSlippage: number;
  shadowProfitUsd: number;
  auditId: string;
}

/** Trade payload for the MEV engine. */
export interface TradePayload {
  poolAddress: string;
  amountUsd: number;
  isBuy: boolean;
  assetPair: string;
  /** Stablecoin / yield token for Router B routing. */
  tokenAddress?: string;
  tradeId?: string;
  pythPriceUpdate?: {
    price: number;
    conf: number;
    expo: number;
    publishTime: number;
  };
  status: TradeStatus;
  txHash?: string;
  auditTrace: string[];
  /** Gross yield after fill (set by engine). */
  grossYieldUsd?: number;
}

export type TradeStatus =
  | 'PENDING'
  | 'MANDATE_REJECTED'
  | 'CEILING_REJECTED'
  | 'SHADOW_GATE_EVALUATING'
  | 'SHADOW_FAIL_ABORTED'
  | 'TX_BROADCAST'
  | 'TX_CONFIRMED'
  | 'TX_FAILED'
  | 'YIELD_ROUTED'
  | 'YIELD_ROUTE_FAILED';

// Use globalThis so this TypeScript file doesn't require @types/node as a peer dep
const _process = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
export const SHADOW_API_URL =
  (_process?.env?.SHADOW_API_URL as string | undefined) ?? 'http://localhost:8000/api/v1/shadow/evaluate';
export const SHADOW_TIMEOUT_MS = 2000;