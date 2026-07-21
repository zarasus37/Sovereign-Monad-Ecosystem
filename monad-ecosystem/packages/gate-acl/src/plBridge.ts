/**
 * PL promote bridge — server-side structural verify + event construction.
 *
 * Client sends a *claim*; this module is the only path that may mint
 * verifiedBy task-verifier | comprehension-gate awards for onboarding tasks.
 * Never accepts verifiedBy: client.
 *
 * CPU-pure verify; Kafka emission lives in plBridgeService.ts.
 */

import { createHash, randomUUID } from 'node:crypto';
import type {
  ArchonTaskPayload,
  BrokenGenesisTaskPayload,
  PlLedgerKafkaEvent,
  PlOnboardingTaskId,
  PlPointsAwarded,
  PlPromoteClaim,
  PlVerifiedBy,
  QuarantineTaskPayload,
} from './plBridge.types.js';
import type { PLDomain, TaskEvent, GateEvent, PLEvent } from './types.js';

export const PL_POINTS: Record<PlOnboardingTaskId, PlPointsAwarded> = {
  'broken-genesis-repair': 10,
  'quarantine-refusal-literacy': 15,
  'archon-comprehension-gate': 25,
};

export const CONSTRAINT_ENVELOPE_VERSION = '1.1.0';

export type PromoteVerifyOk = {
  ok: true;
  taskId: PlOnboardingTaskId;
  verifiedBy: PlVerifiedBy;
  points: PlPointsAwarded;
  auditTrace: string[];
  status?: string;
};

export type PromoteVerifyFail = {
  ok: false;
  error: 'INVALID_TASK_PROOF' | 'UNKNOWN_TASK' | 'EMPTY_PRINCIPAL';
  message: string;
};

export type PromoteVerifyResult = PromoteVerifyOk | PromoteVerifyFail;

function isBrokenGenesis(p: unknown): p is BrokenGenesisTaskPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as BrokenGenesisTaskPayload).kind === 'broken-genesis'
  );
}

function isQuarantine(p: unknown): p is QuarantineTaskPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as QuarantineTaskPayload).kind === 'quarantine'
  );
}

function isArchon(p: unknown): p is ArchonTaskPayload {
  return (
    typeof p === 'object' &&
    p !== null &&
    (p as ArchonTaskPayload).kind === 'archon'
  );
}

/**
 * Structural verification of an onboarding PL claim.
 * Mirrors local-pl-ledger rules; server is source of truth.
 */
export function verifyPlPromoteClaim(claim: PlPromoteClaim): PromoteVerifyResult {
  if (!claim.principalId?.trim()) {
    return {
      ok: false,
      error: 'EMPTY_PRINCIPAL',
      message: 'principalId required',
    };
  }

  const { taskId, taskPayload } = claim;

  if (taskId === 'broken-genesis-repair') {
    if (!isBrokenGenesis(taskPayload)) {
      return {
        ok: false,
        error: 'INVALID_TASK_PROOF',
        message: 'broken-genesis payload kind mismatch',
      };
    }
    if (!taskPayload.isStable || taskPayload.totalEnergy <= 60 || taskPayload.totalEnergy >= 95) {
      return {
        ok: false,
        error: 'INVALID_TASK_PROOF',
        message: 'circuit not in stability band (floors + Σ∈(60,95))',
      };
    }
    const sum =
      taskPayload.theoWeight + taskPayload.technoWeight + taskPayload.cosmoWeight;
    if (sum < 1) {
      return {
        ok: false,
        error: 'INVALID_TASK_PROOF',
        message: 'empty profile weights',
      };
    }
    return {
      ok: true,
      taskId,
      verifiedBy: 'task-verifier',
      points: PL_POINTS[taskId],
      auditTrace: [
        'gate-acl:verify:broken-genesis-repair',
        `energy:${taskPayload.totalEnergy.toFixed(1)}`,
        'constraint_envelope:1.1.0',
      ],
    };
  }

  if (taskId === 'quarantine-refusal-literacy') {
    if (!isQuarantine(taskPayload)) {
      return {
        ok: false,
        error: 'INVALID_TASK_PROOF',
        message: 'quarantine payload kind mismatch',
      };
    }
    if (taskPayload.correctHalts < 3) {
      return {
        ok: false,
        error: 'INVALID_TASK_PROOF',
        message: `correctHalts ${taskPayload.correctHalts} < 3 (T-AXIS literacy)`,
      };
    }
    return {
      ok: true,
      taskId,
      verifiedBy: 'task-verifier',
      points: PL_POINTS[taskId],
      auditTrace: [
        'gate-acl:verify:quarantine-refusal-literacy',
        `correct_t_axis_halts:${taskPayload.correctHalts}`,
        'hcd:optimized_validated',
      ],
    };
  }

  if (taskId === 'archon-comprehension-gate') {
    if (!isArchon(taskPayload)) {
      return {
        ok: false,
        error: 'INVALID_TASK_PROOF',
        message: 'archon payload kind mismatch',
      };
    }
    if (taskPayload.gatesPassed < 2) {
      return {
        ok: false,
        error: 'INVALID_TASK_PROOF',
        message: `gatesPassed ${taskPayload.gatesPassed} < 2`,
      };
    }
    return {
      ok: true,
      taskId,
      verifiedBy: 'comprehension-gate',
      points: PL_POINTS[taskId],
      auditTrace: [
        'gate-acl:verify:archon-comprehension-gate',
        `gates_passed:${taskPayload.gatesPassed}`,
        'status:MESHALEACH_VERIFIED',
      ],
      status: 'MESHALEACH_VERIFIED',
    };
  }

  return {
    ok: false,
    error: 'UNKNOWN_TASK',
    message: `unknown taskId: ${String(taskId)}`,
  };
}

/** Deterministic event id (UUID-v5-style from SHA-1 namespace + key). */
export function deterministicEventId(
  principalId: string,
  taskId: string,
  salt = '',
): string {
  const h = createHash('sha1')
    .update(`sovereign-pl-v1:${principalId}:${taskId}:${salt}`)
    .digest('hex');
  // Format as UUID-ish
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function buildPlLedgerKafkaEvent(
  claim: PlPromoteClaim,
  verified: PromoteVerifyOk,
  serverCurrentPl: number,
  now = Date.now(),
): PlLedgerKafkaEvent {
  const totalPl = Math.min(100, serverCurrentPl + verified.points);
  return {
    eventId: deterministicEventId(claim.principalId, verified.taskId, String(now)),
    principalId: claim.principalId,
    domain: claim.domain ?? 'agent_ops',
    taskId: verified.taskId,
    pointsAwarded: verified.points,
    totalPl,
    verifiedBy: verified.verifiedBy,
    constraintEnvelopeVersion: CONSTRAINT_ENVELOPE_VERSION,
    auditTrace: verified.auditTrace,
    timestamp: new Date(now).toISOString(),
    status: verified.status,
  };
}

/**
 * Map onboarding award to gate-acl PLEvent for pl.events → PlLedgerService.
 * comprehension-gate awards use GateEvent; task-verifier use TaskEvent.
 */
export function toPlEvent(
  kafkaEvent: PlLedgerKafkaEvent,
  now = Date.now(),
): PLEvent {
  if (kafkaEvent.verifiedBy === 'comprehension-gate') {
    const ge: GateEvent = {
      kind: 'comprehension_gate',
      eventId: kafkaEvent.eventId,
      principalId: kafkaEvent.principalId,
      domain: kafkaEvent.domain as PLDomain,
      passed: true,
      gateId: kafkaEvent.taskId,
      verifiedBy: 'comprehension-gate',
      at: now,
      points: kafkaEvent.pointsAwarded,
    };
    return ge;
  }
  const te: TaskEvent = {
    kind: 'domain_task',
    eventId: kafkaEvent.eventId,
    principalId: kafkaEvent.principalId,
    domain: kafkaEvent.domain as PLDomain,
    taskId: kafkaEvent.taskId,
    outcome: 'passed',
    verifiedBy: 'task-verifier',
    at: now,
    points: kafkaEvent.pointsAwarded,
  };
  return te;
}

export function randomPromoteId(): string {
  return randomUUID();
}
