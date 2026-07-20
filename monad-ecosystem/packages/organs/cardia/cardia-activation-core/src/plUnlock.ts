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
 * Rejects client-style verifiers (defense-in-depth).
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

  if (event.totalPl >= threshold) {
    return {
      unlocked: true,
      principalId: event.principalId,
      totalPl: event.totalPl,
      capitalUsd,
      mandate: 'TIER_1_MESHALEACH',
      reason: `totalPl ${event.totalPl} ≥ ${threshold} after ${event.taskId}`,
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
