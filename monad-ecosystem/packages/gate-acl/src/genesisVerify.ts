/**
 * Local structural verifier for Broken Genesis (taskId: broken-genesis-repair).
 * Only a pass here may stamp verifiedBy: 'task-verifier' on the PL ledger.
 * Mirrors control-center lib/local-pl-ledger.ts for package-side demos.
 */

import { randomUUID } from 'node:crypto';
import type { PLDomain, TaskEvent } from './types.js';

export interface GenesisProfileWeights {
  theoWeight: number;
  technoWeight: number;
  cosmoWeight: number;
}

export interface GenesisVerifyInput {
  principalId: string;
  domain?: PLDomain;
  /** Circuit currently in stability band. */
  isStable: boolean;
  profile: GenesisProfileWeights;
  /** Optional: CURRENT pack version the UI compiled. */
  constraintEnvelopeVersion?: string;
  at?: number;
}

export function verifyBrokenGenesisStructural(input: {
  isStable: boolean;
  profile: GenesisProfileWeights;
}): { ok: boolean; reason?: string } {
  if (!input.isStable) return { ok: false, reason: 'circuit_not_stable' };
  const total =
    input.profile.theoWeight +
    input.profile.technoWeight +
    input.profile.cosmoWeight;
  if (total <= 60 || total >= 95) {
    return { ok: false, reason: 'energy_outside_stability_band' };
  }
  if (total < 1) return { ok: false, reason: 'empty_profile_weights' };
  return { ok: true };
}

/**
 * Build a TaskEvent for PLLedger.append — only if structural verify passes.
 * Never returns verifiedBy: 'client'.
 */
export function buildBrokenGenesisTaskEvent(
  input: GenesisVerifyInput,
): { ok: true; event: TaskEvent } | { ok: false; reason: string } {
  const v = verifyBrokenGenesisStructural({
    isStable: input.isStable,
    profile: input.profile,
  });
  if (!v.ok) return { ok: false, reason: v.reason ?? 'verify_failed' };

  const event: TaskEvent = {
    kind: 'domain_task',
    eventId: randomUUID(),
    principalId: input.principalId,
    domain: input.domain ?? 'agent_ops',
    taskId: 'broken-genesis-repair',
    outcome: 'passed',
    verifiedBy: 'task-verifier',
    at: input.at ?? Date.now(),
  };
  return { ok: true, event };
}
