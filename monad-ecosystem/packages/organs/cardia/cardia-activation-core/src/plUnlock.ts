/**
 * Cardia PL unlock logic — pure (no Kafka).
 * When totalPl crosses TIER_1_THRESHOLD, capital mandate unlock is eligible.
 */

export const TIER_1_THRESHOLD = 50;
export const TIER_1_CAPITAL_USD = 15_000;

/** Minimal shape Cardia needs from sovereign.pl.ledger.events */
export interface CardiaPlLedgerEvent {
  principalId: string;
  totalPl: number;
  taskId: string;
  pointsAwarded: number;
  verifiedBy: string;
  timestamp: string;
  status?: string;
}

export type CardiaPlUnlockResult =
  | {
      unlocked: true;
      principalId: string;
      totalPl: number;
      capitalUsd: number;
      mandate: 'TIER_1_MESHALEACH';
      reason: string;
    }
  | {
      unlocked: false;
      principalId: string;
      totalPl: number;
      remainingPl: number;
      reason: string;
    };

/**
 * Evaluate a PL ledger broadcast for Cardia Tier-1 capital unlock.
 *
 * Funding unlock requires wallet-bind-tier1-activation (Vector 3.2) — not
 * simulation PL alone. Rejects client-style verifiers (defense-in-depth).
 */
export function evaluatePlForTier1(
  event: CardiaPlLedgerEvent,
  threshold = TIER_1_THRESHOLD,
  capitalUsd = TIER_1_CAPITAL_USD,
): CardiaPlUnlockResult {
  if (event.verifiedBy === 'client') {
    return {
      unlocked: false,
      principalId: event.principalId,
      totalPl: event.totalPl,
      remainingPl: Math.max(0, threshold - event.totalPl),
      reason: 'rejected_client_verified',
    };
  }

  const walletBound = event.taskId === 'wallet-bind-tier1-activation';
  if (event.totalPl >= threshold && walletBound) {
    return {
      unlocked: true,
      principalId: event.principalId,
      totalPl: event.totalPl,
      capitalUsd,
      mandate: 'TIER_1_MESHALEACH',
      reason: `wallet-bound totalPl ${event.totalPl} ≥ ${threshold} — funding eligible`,
    };
  }

  if (event.totalPl >= threshold && !walletBound) {
    return {
      unlocked: false,
      principalId: event.principalId,
      totalPl: event.totalPl,
      remainingPl: 0,
      reason:
        'PL threshold met but wallet not bound — await wallet-bind-tier1-activation',
    };
  }

  return {
    unlocked: false,
    principalId: event.principalId,
    totalPl: event.totalPl,
    remainingPl: threshold - event.totalPl,
    reason: `requires ${threshold - event.totalPl} more PL for Tier 1`,
  };
}
