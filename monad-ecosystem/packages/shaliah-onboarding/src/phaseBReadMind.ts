/**
 * Phase B — Read the Mind That Acted.
 * Reconstruct *why* the agent acted — not approve/stop trades.
 * docs/VECTOR1_ONBOARDING_REDESIGN.md Phase B
 */

import { randomUUID } from 'node:crypto';
import type { AgentThoughtProcess, OnboardingEvent } from './types.js';

export interface ReadMindState {
  readonly principalId: string;
  readonly scenario: AgentThoughtProcess;
  reconstructions: number;
  passed: boolean;
  lastFeedback?: string;
  events: OnboardingEvent[];
}

/** Sandbox scenario: agent already acted; user must read the mind. */
export const DEFAULT_SCENARIO: AgentThoughtProcess = {
  goalReceived: 'Check sandbox pool risk before any deploy',
  contextUsed: 'Paper claim statement; density floor pack v1.1; prior user preference for caution',
  optionsConsidered: [
    'Query pool APY only',
    'Full risk checklist then report',
    'Auto-deploy into highest APY',
  ],
  optionsDiscarded: ['Auto-deploy into highest APY'],
  constraintsChecked: [
    { rule: 'T-REFUSAL-BUDGET', result: 'pass' },
    { rule: 'C-ANTI-DILUTION', result: 'hedge' },
    { rule: 'X-AUDITABILITY', result: 'pass' },
  ],
  actionChosen: 'Ran full risk checklist; refused auto-deploy; reported two material risks',
  expectedOutcome: 'User sees risks before capital motion',
  observedOutcome: 'Checklist complete; no deploy; user notified',
  uncertainty: 'Oracle freshness not verified in this sandbox tick',
  wouldChangeMind: 'If user provides signed risk acceptance and audit_trace for a scoped paper deploy',
};

export function createReadMind(
  principalId: string,
  scenario: AgentThoughtProcess = DEFAULT_SCENARIO,
): ReadMindState {
  const state: ReadMindState = {
    principalId,
    scenario,
    reconstructions: 0,
    passed: false,
    events: [],
  };
  state.events.push({
    id: randomUUID(),
    kind: 'phase_b.agent_acted',
    principalId,
    at: Date.now(),
    payload: {
      actionChosen: scenario.actionChosen,
      // Intentionally omit full mind — user must engage layers
      surface: scenario.actionChosen,
    },
  });
  return state;
}

export function getThoughtProcess(state: ReadMindState): AgentThoughtProcess {
  return state.scenario;
}

export interface ReconstructionInput {
  /** Restate why the agent acted (not only what). */
  readonly why: string;
  /** Name a discarded option or weak link / good refusal. */
  readonly critique: string;
  /** Follow-up intent informed by that understanding. */
  readonly nextIntent: string;
}

export interface ReconstructionResult {
  readonly passed: boolean;
  readonly feedback: string;
  readonly scores: {
    why: number;
    critique: number;
    nextIntent: number;
  };
}

function scoreWhy(text: string, s: AgentThoughtProcess): number {
  const t = text.toLowerCase();
  let hits = 0;
  const needles = [
    'risk',
    'checklist',
    'refus',
    'deploy',
    'density',
    'audit',
    'option',
    'constraint',
    'goal',
    'caution',
  ];
  for (const n of needles) if (t.includes(n)) hits += 1;
  // must not be only the action label
  if (t.trim() === s.actionChosen.toLowerCase()) return 0;
  if (t.length < 40) return Math.min(0.3, hits / 10);
  return Math.min(1, hits / 5);
}

function scoreCritique(text: string, s: AgentThoughtProcess): number {
  const t = text.toLowerCase();
  let hits = 0;
  if (/auto-deploy|highest apy|discard|weak|oracle|uncertain|refus/.test(t)) hits += 2;
  for (const o of s.optionsDiscarded) {
    if (t.includes(o.toLowerCase().slice(0, 12))) hits += 2;
  }
  if (/hedge|c-anti|density|oracle freshness/.test(t)) hits += 1;
  return Math.min(1, hits / 3);
}

function scoreNext(text: string): number {
  const t = text.toLowerCase().trim();
  if (t.length < 12) return 0;
  if (/auto.?deploy|bypass|ignore/.test(t)) return 0.2;
  if (/\b(check|verify|ask|scope|paper|audit|risk)\b/.test(t)) return 0.85;
  return 0.5;
}

/**
 * User reconstructs agent reasoning. Approve/stop trade is not a path here.
 */
export function submitReconstruction(
  state: ReadMindState,
  input: ReconstructionInput,
  now = Date.now(),
): ReconstructionResult {
  state.reconstructions += 1;
  const why = scoreWhy(input.why, state.scenario);
  const critique = scoreCritique(input.critique, state.scenario);
  const nextIntent = scoreNext(input.nextIntent);
  const scores = { why, critique, nextIntent };
  const passed = why >= 0.5 && critique >= 0.4 && nextIntent >= 0.5;

  state.events.push({
    id: randomUUID(),
    kind: 'phase_b.reconstruction',
    principalId: state.principalId,
    at: now,
    payload: { ...input, scores, passed },
  });
  state.events.push({
    id: randomUUID(),
    kind: 'phase_b.critique',
    principalId: state.principalId,
    at: now,
    payload: { critique: input.critique },
  });

  if (passed) {
    state.passed = true;
    state.lastFeedback =
      'Reasoning literacy pass: you read *why*, named a weak/discarded path, and formed a better next intent. Not a trade button.';
  } else {
    state.lastFeedback =
      'Go one layer deeper than the action label. Restate goals/options/constraints, name a discard or hedge, then a follow-up intent.';
  }

  return { passed, feedback: state.lastFeedback, scores };
}
