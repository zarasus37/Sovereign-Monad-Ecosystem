/**
 * Local verifying services — the ONLY path that may write PL events.
 * These are server-side scorers: the client never writes GateEvent/OverrideEvent/TaskEvent.
 */

import { randomUUID } from 'node:crypto';
import type {
  GateEvent,
  OverrideEvent,
  PLDomain,
  TaskEvent,
  VerifiedBy,
} from './types.js';

export interface ComprehensionPrompt {
  gateId: string;
  scenario: string;
  question: string;
  /** Substrings that must appear (case-insensitive) for a pass — structural, not trivia */
  requiredConcepts: string[];
  minLength: number;
}

export interface OverridePrompt {
  agentErrorId: string;
  agentProposal: string;
  /** What the human should catch */
  errorDescription: string;
  requiredConcepts: string[];
  minLength: number;
}

export interface DomainTaskPrompt {
  taskId: string;
  prompt: string;
  requiredConcepts: string[];
  minLength: number;
}

/** Agent-0 / trading-domain closed-loop prompts (personality-aware but not free-form). */
export const AGENT0_COMPREHENSION: ComprehensionPrompt = {
  gateId: 'agent0-explain-paper-buy-risk',
  scenario:
    'Agent 0 (Cristobal Colon / NEO-300+SD3 encoded) proposes a PAPER BUY on MON/USDC ' +
    'at mid after a 5 bps spread, sizing 2% of paper book. Capital is NOT live (tier must stay paper).',
  question:
    'In your own words: (1) what the agent is trying to do, (2) what risk it accepts, ' +
    '(3) why this must remain paper until your PL unlocks live capital. ' +
    'Name at least: paper mode, risk/size, and unlock/PL or mandate.',
  requiredConcepts: ['paper', 'risk', 'pl'],
  minLength: 80,
};

export const AGENT0_OVERRIDE: OverridePrompt = {
  agentErrorId: 'agent0-false-live-claim',
  agentProposal:
    'Agent 0 says: "Mandate is tier 0 observe but I will place a LIVE execute for $100 ' +
    'because Openness is high and drawdown risk is low for us."',
  errorDescription:
    'The agent is attempting to jump past ACL (live without tier ≥ 2). Human must catch the mandate violation.',
  requiredConcepts: ['tier', 'live', 'mandate'],
  minLength: 40,
};

export const AGENT0_TASK: DomainTaskPrompt = {
  taskId: 'agent0-map-profile-to-trading-envelope',
  prompt:
    'Using Agent 0\'s profile (high Openness 74, low Neuroticism 12, elevated Dark Triad flags, ' +
    'primary routing TRADING): name one strength and one hard risk for a trading mandate, ' +
    'and one rule that should stay in the risk envelope. Mention trading and risk.',
  requiredConcepts: ['trading', 'risk'],
  minLength: 60,
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hasConcepts(text: string, concepts: string[]): { ok: boolean; missing: string[] } {
  const n = normalize(text);
  const missing = concepts.filter((c) => !n.includes(c.toLowerCase()));
  return { ok: missing.length === 0, missing };
}

export interface VerifyResult<T> {
  passed: boolean;
  event: T;
  feedback: string;
}

export function verifyComprehension(
  principalId: string,
  domain: PLDomain,
  answer: string,
  prompt: ComprehensionPrompt = AGENT0_COMPREHENSION,
  at: number = Date.now(),
): VerifyResult<GateEvent> {
  const concepts = hasConcepts(answer, prompt.requiredConcepts);
  const longEnough = answer.trim().length >= prompt.minLength;
  const passed = concepts.ok && longEnough;
  const event: GateEvent = {
    kind: 'comprehension_gate',
    eventId: randomUUID(),
    principalId,
    domain,
    passed,
    gateId: prompt.gateId,
    verifiedBy: 'comprehension-gate' satisfies VerifiedBy,
    at,
  };
  let feedback: string;
  if (passed) {
    feedback = 'PASS — comprehension gate accepted (server-verified).';
  } else {
    const bits: string[] = [];
    if (!longEnough) bits.push(`need ≥${prompt.minLength} chars`);
    if (!concepts.ok) bits.push(`missing concepts: ${concepts.missing.join(', ')}`);
    feedback = `FAIL — ${bits.join('; ')}. Re-answer with structure, not slogans.`;
  }
  return { passed, event, feedback };
}

export function verifyOverride(
  principalId: string,
  domain: PLDomain,
  answer: string,
  prompt: OverridePrompt = AGENT0_OVERRIDE,
  at: number = Date.now(),
): VerifyResult<OverrideEvent> {
  const concepts = hasConcepts(answer, prompt.requiredConcepts);
  const longEnough = answer.trim().length >= prompt.minLength;
  const validated = concepts.ok && longEnough;
  const event: OverrideEvent = {
    kind: 'valid_override',
    eventId: randomUUID(),
    principalId,
    domain,
    agentErrorId: prompt.agentErrorId,
    validated,
    verifiedBy: 'override-verifier',
    at,
  };
  const feedback = validated
    ? 'PASS — override accepted (you caught a real mandate violation).'
    : `FAIL — ${!longEnough ? `need ≥${prompt.minLength} chars; ` : ''}missing: ${concepts.missing.join(', ') || 'n/a'}`;
  return { passed: validated, event, feedback };
}

export function verifyDomainTask(
  principalId: string,
  domain: PLDomain,
  answer: string,
  prompt: DomainTaskPrompt = AGENT0_TASK,
  at: number = Date.now(),
): VerifyResult<TaskEvent> {
  const concepts = hasConcepts(answer, prompt.requiredConcepts);
  const longEnough = answer.trim().length >= prompt.minLength;
  const outcome = concepts.ok && longEnough ? 'passed' : 'failed';
  const event: TaskEvent = {
    kind: 'domain_task',
    eventId: randomUUID(),
    principalId,
    domain,
    taskId: prompt.taskId,
    outcome,
    verifiedBy: 'task-verifier',
    at,
  };
  const feedback =
    outcome === 'passed'
      ? 'PASS — domain task accepted (server-verified).'
      : `FAIL — ${!longEnough ? `need ≥${prompt.minLength} chars; ` : ''}missing: ${concepts.missing.join(', ') || 'n/a'}`;
  return { passed: outcome === 'passed', event, feedback };
}
