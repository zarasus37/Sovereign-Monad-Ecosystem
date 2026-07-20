/**
 * Local Cardia funding types (mirror @sovereign/types cardia-funding).
 * Keep in sync with sovereign-types/src/types/cardia-funding.ts.
 */

export type FundingStatus =
  | 'PENDING_HEPAR_AUDIT'
  | 'AUDIT_PASSED'
  | 'AUDIT_FAILED'
  | 'TX_BROADCAST'
  | 'TX_CONFIRMED'
  | 'TX_FAILED'
  | 'TX_SYNTHESIZED';

export type FundingTier = 'TIER_1_MESHALEACH';

export interface FundingMandate {
  mandateId: string;
  principalWallet: string;
  amount: number;
  tier: FundingTier;
  status: FundingStatus;
  auditTrace: string[];
  txHash?: string;
  blockNumber?: number;
  timestamp: string;
  synthesized?: boolean;
}

export interface CardiaFundingKafkaEvent {
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
