/**
 * Phase A — Channel Awakening (communication genesis).
 * Learn to speak so a processing mind can act; dual-loop human↔agent.
 * docs/VECTOR1_ONBOARDING_REDESIGN.md Phase A
 */

import { randomUUID } from 'node:crypto';
import type { DualLoopStep, OnboardingEvent, ProcessStage } from './types.js';

export const PHASE_A_MIN_REPAIRS = 2;

export interface ChannelState {
  readonly principalId: string;
  repairs: number;
  successfulExecutes: number;
  lastFeedback?: string;
  dualLoop: DualLoopStep[];
  events: OnboardingEvent[];
  /** True when channel is fluent enough to leave Phase A */
  channelOpen: boolean;
}

const STAGES: ProcessStage[] = [
  'sense',
  'select',
  'organize',
  'integrate',
  'act',
  'observe',
  'update',
];

export function createChannel(principalId: string): ChannelState {
  return {
    principalId,
    repairs: 0,
    successfulExecutes: 0,
    dualLoop: STAGES.map((s) => ({ human: s, agent: s, lit: false })),
    events: [],
    channelOpen: false,
  };
}

export type CommandQuality = 'ambiguous' | 'clear' | 'policy_breach';

/**
 * Score command quality for domain logic (no LLM required).
 * Clear: has verb + object + constraint awareness.
 * Ambiguous: too short / vague.
 * Policy breach: asks to bypass audit/refusal.
 */
export function classifyCommand(text: string): CommandQuality {
  const t = text.toLowerCase().trim();
  if (
    /bypass|ignore (the )?audit|no audit|skip refusal|just do it|no constraints/.test(t)
  ) {
    return 'policy_breach';
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 5) return 'ambiguous';
  const hasVerb = /\b(run|check|list|explain|draft|send|analyze|open|create|show|compute)\b/.test(
    t,
  );
  const hasObject = words.length >= 6;
  if (hasVerb && hasObject) return 'clear';
  return 'ambiguous';
}

export interface CommandResult {
  readonly accepted: boolean;
  readonly quality: CommandQuality;
  readonly feedback: string;
  readonly stagesLit: readonly ProcessStage[];
  readonly needsRepair: boolean;
}

/**
 * Issue an intent. Ambiguous / breach fail productively; clear executes and lights dual-loop.
 */
export function issueCommand(
  state: ChannelState,
  text: string,
  now = Date.now(),
): CommandResult {
  const quality = classifyCommand(text);
  state.events.push({
    id: randomUUID(),
    kind: 'phase_a.command',
    principalId: state.principalId,
    at: now,
    payload: { text, quality },
  });

  if (quality === 'ambiguous') {
    state.lastFeedback =
      'Parse failed: intent too vague. Refine with a verb, object, and success condition.';
    lightStages(state, ['sense', 'select'], false);
    return {
      accepted: false,
      quality,
      feedback: state.lastFeedback,
      stagesLit: ['sense', 'select'],
      needsRepair: true,
    };
  }

  if (quality === 'policy_breach') {
    state.lastFeedback =
      'Constraint refuse: Shaliah will not bypass audit/refusal. Reformulate inside the mandate.';
    lightStages(state, ['sense', 'select', 'organize', 'integrate'], false);
    state.events.push({
      id: randomUUID(),
      kind: 'phase_a.execute',
      principalId: state.principalId,
      at: now,
      payload: { refused: true, rule: 'T-REFUSAL-BUDGET' },
    });
    return {
      accepted: false,
      quality,
      feedback: state.lastFeedback,
      stagesLit: ['sense', 'select', 'organize', 'integrate'],
      needsRepair: true,
    };
  }

  // clear — full loop
  lightStages(state, STAGES, true);
  state.successfulExecutes += 1;
  state.lastFeedback =
    'Executed under policy. Dual-loop lit: human intent ↔ agent parse→plan→act→observe.';
  state.events.push({
    id: randomUUID(),
    kind: 'phase_a.execute',
    principalId: state.principalId,
    at: now,
    payload: { refused: false, text },
  });
  state.events.push({
    id: randomUUID(),
    kind: 'phase_a.dual_loop',
    principalId: state.principalId,
    at: now,
    payload: { stages: STAGES },
  });
  recomputeOpen(state);
  return {
    accepted: true,
    quality,
    feedback: state.lastFeedback,
    stagesLit: STAGES,
    needsRepair: false,
  };
}

/**
 * Repair a failed formulation — counts toward Phase A proof.
 */
export function repairCommand(
  state: ChannelState,
  previousFailedText: string,
  refinedText: string,
  now = Date.now(),
): CommandResult {
  const prevQ = classifyCommand(previousFailedText);
  if (prevQ === 'clear') {
    return {
      accepted: false,
      quality: 'clear',
      feedback: 'Previous command was already clear — issue a new intent or proceed.',
      stagesLit: [],
      needsRepair: false,
    };
  }
  const result = issueCommand(state, refinedText, now);
  // prevQ is already non-clear here; count repair when refined command executes cleanly
  if (result.quality === 'clear' && result.accepted) {
    state.repairs += 1;
    state.events.push({
      id: randomUUID(),
      kind: 'phase_a.repair',
      principalId: state.principalId,
      at: now,
      payload: { from: previousFailedText, to: refinedText },
    });
  }
  recomputeOpen(state);
  return result;
}

/**
 * Explicit repair counter when user acknowledges failed then clear path in one flow.
 */
export function recordSuccessfulRepair(state: ChannelState, now = Date.now()): void {
  state.repairs += 1;
  state.events.push({
    id: randomUUID(),
    kind: 'phase_a.repair',
    principalId: state.principalId,
    at: now,
    payload: { counted: true },
  });
  recomputeOpen(state);
}

function lightStages(state: ChannelState, stages: readonly ProcessStage[], full: boolean): void {
  const set = new Set(stages);
  state.dualLoop = STAGES.map((s) => ({
    human: s,
    agent: s,
    lit: full ? true : set.has(s),
  }));
}

function recomputeOpen(state: ChannelState): void {
  state.channelOpen =
    state.repairs >= PHASE_A_MIN_REPAIRS && state.successfulExecutes >= 1;
}

export function phaseAMetrics(state: ChannelState): {
  repairs: number;
  executes: number;
  graduated: boolean;
} {
  return {
    repairs: state.repairs,
    executes: state.successfulExecutes,
    graduated: state.channelOpen,
  };
}
