/**
 * Browser-local PL ledger slice for onboarding.
 *
 * Honesty: local verifying service (task-verifier / comprehension-gate),
 * never client self-score. Production → Kafka pl-ledger.
 */

import type { Phase1ProfileWeights } from "@/types/broken-genesis";
import { ONBOARDING_CONSTRAINT_ENVELOPE_VERSION } from "@/types/broken-genesis";

const STORAGE_KEY = "gate-acl-local-pl-events-v1";

export type LocalPlTaskId =
  | "broken-genesis-repair"
  | "quarantine-refusal-literacy"
  | "archon-comprehension-gate";

export interface LocalPlEvent {
  kind: "domain_task" | "comprehension_gate";
  eventId: string;
  principalId: string;
  domain: string;
  taskId: LocalPlTaskId;
  outcome: "passed" | "failed";
  verifiedBy: "task-verifier" | "comprehension-gate" | "client";
  /** Points before any decay (mirrors gate-acl POINTS). */
  points: number;
  at: number;
  constraintEnvelopeVersion?: string;
  profileWeights?: Phase1ProfileWeights;
  meta?: Record<string, unknown>;
  /** True after successful POST /promote-pl (Kafka or local synthesis). */
  synced?: boolean;
  serverEventId?: string;
}

/** @deprecated alias for genesis-shaped records */
export type GenesisPlRecord = LocalPlEvent;

export interface LocalPlSnapshot {
  principalId: string;
  domain: string;
  score: number;
  events: LocalPlEvent[];
  lastUpdated: number;
}

const POINTS = {
  "broken-genesis-repair": 10,
  "quarantine-refusal-literacy": 15, // UMS Phase 2 → PL +15
  "archon-comprehension-gate": 25, // UMS Phase 3 → PL +25 COMPREHENSION_GATE_PASSED
} as const;

function loadAll(): LocalPlEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LocalPlEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAll(events: LocalPlEvent[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}`;
}

export function verifyBrokenGenesis(opts: {
  isStable: boolean;
  totalEnergy: number;
  profile: Phase1ProfileWeights;
}): { ok: boolean; reason?: string } {
  if (!opts.isStable) return { ok: false, reason: "circuit_not_stable" };
  if (opts.totalEnergy <= 60 || opts.totalEnergy >= 95) {
    return { ok: false, reason: "energy_outside_stability_band" };
  }
  const sum =
    opts.profile.theoWeight +
    opts.profile.technoWeight +
    opts.profile.cosmoWeight;
  if (sum < 1) return { ok: false, reason: "empty_profile_weights" };
  return { ok: true };
}

export function appendBrokenGenesisPl(input: {
  principalId: string;
  domain?: string;
  profileWeights: Phase1ProfileWeights;
  isStable: boolean;
  totalEnergy: number;
}):
  | { ok: true; record: LocalPlEvent; snapshot: LocalPlSnapshot }
  | { ok: false; reason: string } {
  const v = verifyBrokenGenesis({
    isStable: input.isStable,
    totalEnergy: input.totalEnergy,
    profile: input.profileWeights,
  });
  if (!v.ok) return { ok: false, reason: v.reason ?? "verify_failed" };

  return appendVerifiedTask({
    principalId: input.principalId,
    domain: input.domain ?? "agent_ops",
    taskId: "broken-genesis-repair",
    kind: "domain_task",
    verifiedBy: "task-verifier",
    constraintEnvelopeVersion: ONBOARDING_CONSTRAINT_ENVELOPE_VERSION,
    profileWeights: input.profileWeights,
  });
}

/**
 * Phase 2 quarantine complete — +15 PL (comprehension-gate family).
 * Requires literacy threshold already validated by caller.
 */
export function appendQuarantinePl(input: {
  principalId: string;
  domain?: string;
  comprehensionScore: number;
  passThreshold: number;
  hcd1Burden: number;
  hcd2Fidelity: number;
}):
  | { ok: true; record: LocalPlEvent; snapshot: LocalPlSnapshot }
  | { ok: false; reason: string } {
  if (input.comprehensionScore < input.passThreshold) {
    return {
      ok: false,
      reason: `comprehension_below_threshold (${input.comprehensionScore}/${input.passThreshold})`,
    };
  }
  return appendVerifiedTask({
    principalId: input.principalId,
    domain: input.domain ?? "agent_ops",
    taskId: "quarantine-refusal-literacy",
    kind: "comprehension_gate",
    verifiedBy: "comprehension-gate",
    meta: {
      comprehensionScore: input.comprehensionScore,
      hcd1Burden: input.hcd1Burden,
      hcd2Fidelity: input.hcd2Fidelity,
      hcd: "optimized_validated",
    },
  });
}

/**
 * Phase 3 Archon gate — +25 PL, status COMPREHENSION_GATE_PASSED / MESHALEACH_VERIFIED.
 */
export function appendArchonPl(input: {
  principalId: string;
  domain?: string;
  gatesPassed: number;
  passThreshold: number;
  telemetryCount: number;
}):
  | { ok: true; record: LocalPlEvent; snapshot: LocalPlSnapshot }
  | { ok: false; reason: string } {
  if (input.gatesPassed < input.passThreshold) {
    return {
      ok: false,
      reason: `gates_below_threshold (${input.gatesPassed}/${input.passThreshold})`,
    };
  }
  return appendVerifiedTask({
    principalId: input.principalId,
    domain: input.domain ?? "agent_ops",
    taskId: "archon-comprehension-gate",
    kind: "comprehension_gate",
    verifiedBy: "comprehension-gate",
    constraintEnvelopeVersion: ONBOARDING_CONSTRAINT_ENVELOPE_VERSION,
    meta: {
      status: "COMPREHENSION_GATE_PASSED",
      meshaleach: "MESHALEACH_VERIFIED",
      gatesPassed: input.gatesPassed,
      telemetryCount: input.telemetryCount,
    },
  });
}

function appendVerifiedTask(input: {
  principalId: string;
  domain: string;
  taskId: LocalPlTaskId;
  kind: "domain_task" | "comprehension_gate";
  verifiedBy: "task-verifier" | "comprehension-gate";
  constraintEnvelopeVersion?: string;
  profileWeights?: Phase1ProfileWeights;
  meta?: Record<string, unknown>;
}):
  | { ok: true; record: LocalPlEvent; snapshot: LocalPlSnapshot }
  | { ok: false; reason: string } {
  if (input.verifiedBy === ("client" as string)) {
    return { ok: false, reason: "client_verified_rejected" };
  }

  const record: LocalPlEvent = {
    kind: input.kind,
    eventId: newId(input.taskId),
    principalId: input.principalId,
    domain: input.domain,
    taskId: input.taskId,
    outcome: "passed",
    verifiedBy: input.verifiedBy,
    points: POINTS[input.taskId],
    at: Date.now(),
    constraintEnvelopeVersion: input.constraintEnvelopeVersion,
    profileWeights: input.profileWeights,
    meta: input.meta,
  };

  const all = loadAll();
  const exists = all.some(
    (e) =>
      e.principalId === record.principalId &&
      e.domain === record.domain &&
      e.taskId === record.taskId &&
      e.outcome === "passed",
  );
  if (!exists) {
    all.push(record);
    saveAll(all);
  }

  const stored =
    all.find(
      (e) =>
        e.principalId === record.principalId &&
        e.domain === record.domain &&
        e.taskId === record.taskId,
    ) ?? record;

  return {
    ok: true,
    record: stored,
    snapshot: computeSnapshot(record.principalId, record.domain),
  };
}

export function computeSnapshot(
  principalId: string,
  domain: string,
): LocalPlSnapshot {
  const events = loadAll().filter(
    (e) => e.principalId === principalId && e.domain === domain,
  );
  let score = 0;
  for (const e of events) {
    if (e.outcome === "passed" && e.verifiedBy !== "client") {
      score += e.points ?? POINTS[e.taskId] ?? 10;
    }
  }
  return {
    principalId,
    domain,
    score: Math.min(100, score),
    events,
    lastUpdated: Date.now(),
  };
}

/** Mark a local task award as synced to the server/Kafka bridge. */
export function markSynced(
  principalId: string,
  taskId: LocalPlTaskId,
  serverEventId?: string,
): void {
  const all = loadAll();
  let changed = false;
  for (const e of all) {
    if (
      e.principalId === principalId &&
      e.taskId === taskId &&
      e.outcome === "passed"
    ) {
      e.synced = true;
      if (serverEventId) e.serverEventId = serverEventId;
      changed = true;
    }
  }
  if (changed) saveAll(all);
}

export function isTaskSynced(
  principalId: string,
  taskId: LocalPlTaskId,
): boolean {
  return loadAll().some(
    (e) =>
      e.principalId === principalId &&
      e.taskId === taskId &&
      e.outcome === "passed" &&
      e.synced === true,
  );
}

export function getUnsyncedTasks(principalId: string): LocalPlEvent[] {
  return loadAll().filter(
    (e) =>
      e.principalId === principalId &&
      e.outcome === "passed" &&
      !e.synced,
  );
}
