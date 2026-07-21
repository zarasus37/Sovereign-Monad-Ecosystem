/**
 * Wallet binding protocol (UMS Vector 3.2).
 * Cryptographic bind of local onboarding principal → 0x wallet before Cardia funding.
 */

export interface WalletBindRequest {
  /** UUID / local principal from onboarding session */
  localPrincipalId: string;
  /** Claimed EVM address (0x…) */
  walletAddress: string;
  /** EIP-191 personal_sign signature */
  signature: string;
  /** Exact message that was signed (server recovers address from this) */
  message: string;
}

export interface WalletBindKafkaPayload {
  eventId: string;
  /** Canonical principal after bind = wallet address */
  principalId: string;
  walletAddress: string;
  localPrincipalId: string;
  totalPl: number;
  tier: 'TIER_1_MESHALEACH';
  taskId: 'wallet-bind-tier1-activation';
  pointsAwarded: 0;
  verifiedBy: 'comprehension-gate';
  constraintEnvelopeVersion: '1.1.0' | string;
  auditTrace: string[];
  timestamp: string;
  status: 'WALLET_BOUND_TIER1';
}

export interface WalletBindResult {
  status: 'WALLET_BOUND_AND_BROADCAST' | 'WALLET_BOUND_LOCAL';
  walletAddress: string;
  event: WalletBindKafkaPayload;
  kafkaEnabled: boolean;
}

/** Prefix for EIP-191 bind messages (anti-phishing human readable). */
export const WALLET_BIND_MESSAGE_PREFIX = 'Sovereign Monad Ecosystem Bind';
