/**
 * Cardia Funding Engine contracts (UMS Vector 3.3).
 * Identity bind (V3.2) → value transfer under Hepar gate + Cosmo constraints.
 */

export type FundingStatus =
  | 'PENDING_HEPAR_AUDIT'
  | 'AUDIT_PASSED'
  | 'AUDIT_FAILED'
  | 'TX_BROADCAST'
  | 'TX_CONFIRMED'
  | 'TX_FAILED'
  | 'TX_SYNTHESIZED'; // local/dev — no chain broadcast

export type FundingTier = 'TIER_1_MESHALEACH';

export interface FundingMandate {
  mandateId: string;
  principalWallet: string;
  /** USD notional (stablecoin decimals applied at execution). */
  amount: number;
  tier: FundingTier;
  status: FundingStatus;
  auditTrace: string[];
  txHash?: string;
  blockNumber?: number;
  timestamp: string;
  /** True when CARDIA_FUNDING_LIVE is not enabled — honest dry-run. */
  synthesized?: boolean;
}

export interface CardiaFundingKafkaEvent {
  /** Unique event identifier. */
  eventId?: string;
  mandateId: string;
  principalWallet: string;
  status: FundingStatus;
  amount: number;
  tier: FundingTier;
  txHash?: string;
  blockNumber?: number;
  auditTrace: string[];
  timestamp: string;
  synthesized?: boolean;
}

export const CARDIA_FUNDING_TOPIC = 'sovereign.cardia.funding.events';
export const TIER_1_FUNDING_USD = 15_000;
