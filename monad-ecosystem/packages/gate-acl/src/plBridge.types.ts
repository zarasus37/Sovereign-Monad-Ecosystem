/**
 * Local re-export of PL bridge types so gate-acl does not hard-depend on
 * @sovereign/types workspace graph for unit tests. Keep in sync with
 * sovereign-types/src/types/pl-ledger.ts.
 */

export type PlOnboardingTaskId =
  | 'broken-genesis-repair'
  | 'quarantine-refusal-literacy'
  | 'archon-comprehension-gate';

export type PlPointsAwarded = 10 | 15 | 25;
export type PlVerifiedBy = 'task-verifier' | 'comprehension-gate';

export interface PlLedgerKafkaEvent {
  eventId: string;
  principalId: string;
  domain: string;
  taskId: PlOnboardingTaskId;
  pointsAwarded: PlPointsAwarded;
  totalPl: number;
  verifiedBy: PlVerifiedBy;
  constraintEnvelopeVersion: string;
  auditTrace: string[];
  timestamp: string;
  status?: string;
}

export interface BrokenGenesisTaskPayload {
  kind: 'broken-genesis';
  isStable: boolean;
  totalEnergy: number;
  theoWeight: number;
  technoWeight: number;
  cosmoWeight: number;
  currentPl?: number;
}

export interface QuarantineTaskPayload {
  kind: 'quarantine';
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

export type PlTaskPayload =
  | BrokenGenesisTaskPayload
  | QuarantineTaskPayload
  | ArchonTaskPayload;

export interface PlPromoteClaim {
  principalId: string;
  domain?: string;
  taskId: PlOnboardingTaskId;
  taskPayload: PlTaskPayload;
}

export interface PlPromoteResult {
  status: 'PL_BROADCAST_SUCCESS' | 'PL_LOCAL_SYNTHESIS';
  event: PlLedgerKafkaEvent;
  kafkaEnabled: boolean;
}
