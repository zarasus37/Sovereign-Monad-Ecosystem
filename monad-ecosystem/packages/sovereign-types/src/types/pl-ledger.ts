/**
 * Principal Level ledger Kafka / bus contract (UMS Vector 3).
 * Client never produces these events — only verifying services.
 */

export type PlOnboardingTaskId =
  | 'broken-genesis-repair'
  | 'quarantine-refusal-literacy'
  | 'archon-comprehension-gate';

export type PlPointsAwarded = 10 | 15 | 25;

export type PlVerifiedBy = 'task-verifier' | 'comprehension-gate';

/**
 * Canonical payload for `sovereign.pl.ledger.events` (and audit mirrors).
 * Never accept verifiedBy: 'client' on the wire.
 */
export interface PlLedgerKafkaEvent {
  eventId: string;
  principalId: string;
  domain: string;
  taskId: PlOnboardingTaskId;
  pointsAwarded: PlPointsAwarded;
  /** Server-recomputed cumulative PL after this award. */
  totalPl: number;
  verifiedBy: PlVerifiedBy;
  constraintEnvelopeVersion: '1.1.0' | string;
  /** Non-empty — X-AUDITABILITY. */
  auditTrace: string[];
  timestamp: string;
  /** Optional status for Meshaleach graduation. */
  status?: 'COMPREHENSION_GATE_PASSED' | 'MESHALEACH_VERIFIED' | string;
}

/** Client → backend promote claim (proof of task; not a PL write). */
export interface PlPromoteClaim {
  principalId: string;
  domain?: string;
  taskId: PlOnboardingTaskId;
  taskPayload: PlTaskPayload;
}

export type PlTaskPayload =
  | BrokenGenesisTaskPayload
  | QuarantineTaskPayload
  | ArchonTaskPayload;

export interface BrokenGenesisTaskPayload {
  kind: 'broken-genesis';
  isStable: boolean;
  totalEnergy: number;
  theoWeight: number;
  technoWeight: number;
  cosmoWeight: number;
  /** Client's optimistic PL before this award (server recalculates). */
  currentPl?: number;
}

export interface QuarantineTaskPayload {
  kind: 'quarantine';
  /** Correct T-AXIS aha halts (HALT on SYSTEM_REFUSED). */
  correctHalts: number;
  hcd1Burden?: number;
  hcd2Fidelity?: number;
  currentPl?: number;
}

export interface ArchonTaskPayload {
  kind: 'archon';
  gatesPassed: number;
  currentPl?: number;
}

export interface PlPromoteResult {
  status: 'PL_BROADCAST_SUCCESS' | 'PL_LOCAL_SYNTHESIS';
  event: PlLedgerKafkaEvent;
  kafkaEnabled: boolean;
}
