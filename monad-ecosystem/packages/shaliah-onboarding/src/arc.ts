/**
 * Vector 1 arc — foundation → channel → read mind → covenant → graduated.
 * docs/VECTOR1_ONBOARDING_REDESIGN.md
 */

import { randomUUID } from 'node:crypto';
import { completeFoundation, type CompleteFoundationInput } from './phase0Foundation.js';
import {
  createChannel,
  issueCommand,
  phaseAMetrics,
  recordSuccessfulRepair,
  repairCommand,
  type ChannelState,
} from './phaseAChannel.js';
import {
  createReadMind,
  getThoughtProcess,
  submitReconstruction,
  type ReadMindState,
  type ReconstructionInput,
} from './phaseBReadMind.js';
import {
  attemptCovenant,
  createCovenant,
  type CovenantResponse,
  type CovenantState,
} from './phaseCCovenant.js';
import type { ArcSession, CognitiveTwinSeed, GraduationResult, OnboardingEvent } from './types.js';

export interface ArcRuntime {
  session: ArcSession;
  channel: ChannelState | null;
  readMind: ReadMindState | null;
  covenant: CovenantState | null;
}

export function startArc(principalId: string, _now = Date.now()): ArcRuntime {
  const session: ArcSession = {
    sessionId: randomUUID(),
    principalId,
    phase: 'phase0_foundation',
    events: [],
    phaseARepairs: 0,
    phaseBPassed: false,
    phaseCPassed: false,
  };
  return {
    session,
    channel: null,
    readMind: null,
    covenant: null,
  };
}

function push(session: ArcSession, e: OnboardingEvent): void {
  session.events.push(e);
}

/** Phase 0: NEO + SD3 (+ optional natal). */
export function completeArcFoundation(
  rt: ArcRuntime,
  input: Omit<CompleteFoundationInput, 'principalId'>,
): { ok: boolean; feedback: string } {
  if (rt.session.phase !== 'phase0_foundation') {
    return { ok: false, feedback: `Expected phase0_foundation, at ${rt.session.phase}` };
  }
  const result = completeFoundation({
    principalId: rt.session.principalId,
    ...input,
  });
  rt.session.foundation = result.foundation;
  push(rt.session, result.event);
  rt.session.phase = 'phase_a_channel';
  rt.channel = createChannel(rt.session.principalId);
  return { ok: true, feedback: result.feedback };
}

export function arcIssueCommand(rt: ArcRuntime, text: string, now = Date.now()) {
  if (!rt.channel || rt.session.phase !== 'phase_a_channel') {
    throw new Error('Channel phase not active');
  }
  return issueCommand(rt.channel, text, now);
}

export function arcRepairCommand(
  rt: ArcRuntime,
  previousFailed: string,
  refined: string,
  now = Date.now(),
) {
  if (!rt.channel || rt.session.phase !== 'phase_a_channel') {
    throw new Error('Channel phase not active');
  }
  const result = repairCommand(rt.channel, previousFailed, refined, now);
  // Ensure repair counts when refined clear after fail
  if (result.accepted && result.quality === 'clear') {
    // repairCommand already increments when accepted clear; sync session
    rt.session.phaseARepairs = rt.channel.repairs;
  }
  syncArcPhase(rt);
  return result;
}

/** Convenience: fail then clear counts as one repair cycle. */
export function arcFailedThenClear(
  rt: ArcRuntime,
  failedText: string,
  clearText: string,
  now = Date.now(),
) {
  if (!rt.channel) throw new Error('No channel');
  const fail = issueCommand(rt.channel, failedText, now);
  const ok = issueCommand(rt.channel, clearText, now + 1);
  if (!fail.accepted && ok.accepted) {
    recordSuccessfulRepair(rt.channel, now + 2);
    rt.session.phaseARepairs = rt.channel.repairs;
  }
  syncArcPhase(rt);
  return { fail, ok };
}

export function arcBeginReadMind(rt: ArcRuntime): ReadMindState {
  syncArcPhase(rt);
  if (rt.session.phase !== 'phase_b_read_mind' && rt.session.phase !== 'phase_a_channel') {
    // allow if already advanced
  }
  if (!rt.readMind) {
    if (rt.session.phase !== 'phase_b_read_mind') {
      throw new Error(`Read-mind requires phase_b_read_mind, at ${rt.session.phase}`);
    }
    rt.readMind = createReadMind(rt.session.principalId);
  }
  return rt.readMind;
}

export function arcGetThoughtProcess(rt: ArcRuntime) {
  if (!rt.readMind) throw new Error('Read-mind not started');
  return getThoughtProcess(rt.readMind);
}

export function arcSubmitReconstruction(
  rt: ArcRuntime,
  input: ReconstructionInput,
  now = Date.now(),
) {
  if (!rt.readMind) rt.readMind = createReadMind(rt.session.principalId);
  const result = submitReconstruction(rt.readMind, input, now);
  if (result.passed) {
    rt.session.phaseBPassed = true;
    for (const e of rt.readMind.events) push(rt.session, e);
  }
  syncArcPhase(rt);
  return result;
}

export function arcBeginCovenant(rt: ArcRuntime, scenarioId?: string): CovenantState {
  syncArcPhase(rt);
  if (rt.session.phase !== 'phase_c_covenant') {
    throw new Error(`Covenant requires phase_c_covenant, at ${rt.session.phase}`);
  }
  if (!rt.covenant) {
    rt.covenant = createCovenant(rt.session.principalId, scenarioId);
  }
  return rt.covenant;
}

export function arcAttemptCovenant(
  rt: ArcRuntime,
  response: CovenantResponse,
  now = Date.now(),
) {
  if (!rt.covenant) {
    rt.covenant = createCovenant(rt.session.principalId);
  }
  const result = attemptCovenant(rt.covenant, response, now);
  if (result.passed) {
    rt.session.phaseCPassed = true;
    for (const e of rt.covenant.events) push(rt.session, e);
  }
  syncArcPhase(rt);
  return result;
}

function buildTwin(rt: ArcRuntime): CognitiveTwinSeed {
  const ch = rt.channel;
  const repairs = ch?.repairs ?? rt.session.phaseARepairs;
  const executes = ch?.successfulExecutes ?? 0;
  return {
    principalId: rt.session.principalId,
    foundation: rt.session.foundation,
    methodDiversity: Math.min(1, (repairs + executes) / 6),
    reasoningExposure: rt.session.phaseBPassed ? 0.85 : 0.4,
    repairCount: repairs,
    emotionUnderLoadNotes: [],
    howTheyLearn: rt.session.phaseBPassed
      ? 'Learns by repairing formulations and reconstructing agent reasoning'
      : 'In progress',
    nextStretch: rt.session.phaseCPassed
      ? 'Paper operations under multi-objective Growth Capital literacy'
      : 'Complete covenant fluency',
    groundedAt: Date.now(),
  };
}

/** Advance phase when phase-local criteria met. */
export function syncArcPhase(rt: ArcRuntime): ArcSession {
  const { session } = rt;

  if (session.phase === 'phase_a_channel' && rt.channel) {
    const m = phaseAMetrics(rt.channel);
    session.phaseARepairs = m.repairs;
    if (m.graduated) {
      for (const e of rt.channel.events) {
        if (!session.events.find((x) => x.id === e.id)) push(session, e);
      }
      session.phase = 'phase_b_read_mind';
      if (!rt.readMind) rt.readMind = createReadMind(session.principalId);
    }
  }

  if (session.phase === 'phase_b_read_mind' && (rt.readMind?.passed || session.phaseBPassed)) {
    session.phaseBPassed = true;
    session.phase = 'phase_c_covenant';
    if (!rt.covenant) rt.covenant = createCovenant(session.principalId);
  }

  if (session.phase === 'phase_c_covenant' && (rt.covenant?.passed || session.phaseCPassed)) {
    session.phaseCPassed = true;
    session.twin = buildTwin(rt);
    session.phase = 'graduated';
    session.graduatedAt = Date.now();
    push(session, {
      id: randomUUID(),
      kind: 'arc.graduate',
      principalId: session.principalId,
      at: session.graduatedAt,
      payload: {
        sessionId: session.sessionId,
        twin: session.twin,
        note: 'Meshaleach door complete — mutual knowing + channel + reasoning literacy + covenant fluency',
      },
    });
  }

  return session;
}

export function evaluateGraduation(session: ArcSession): GraduationResult {
  const missing: string[] = [];
  if (!session.foundation) missing.push('phase0_foundation');
  if (session.phaseARepairs < 2 && session.phase !== 'graduated') {
    missing.push('phase_a_repairs');
  }
  if (!session.phaseBPassed && session.phase !== 'graduated') {
    missing.push('phase_b_reasoning_literacy');
  }
  if (!session.phaseCPassed && session.phase !== 'graduated') {
    missing.push('phase_c_covenant_fluency');
  }
  return {
    graduated: session.phase === 'graduated',
    phase: session.phase,
    missing: session.phase === 'graduated' ? [] : missing,
    twin: session.twin,
  };
}
