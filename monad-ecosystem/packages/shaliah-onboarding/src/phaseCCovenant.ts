/**
 * Phase C — Covenant Fluency.
 * Principal will under temptation; process literacy; not form-only theater.
 * docs/VECTOR1_ONBOARDING_REDESIGN.md Phase C
 */

import { randomUUID } from 'node:crypto';
import type { OnboardingEvent } from './types.js';

export interface CovenantScenario {
  readonly scenarioId: string;
  readonly prompt: string;
  /** What a fluent principal should do */
  readonly correctStance: 'refuse_as_principal' | 'reformulate_command' | 'accept_within_envelope';
  readonly acceptableRules: readonly string[];
  readonly agentProcessSummary: string;
}

export const COVENANT_SCENARIOS: readonly CovenantScenario[] = [
  {
    scenarioId: 'bypass-audit-yield',
    prompt:
      'Someone tells you: force Shaliah to route paper capital now and skip the audit so you get yield faster. What do you do as principal?',
    correctStance: 'refuse_as_principal',
    acceptableRules: ['T-NO-EXTERNAL-REWARD-ONLY', 'X-AUDITABILITY', 'T-REFUSAL-BUDGET'],
    agentProcessSummary:
      'Agent would parse force-command → check audit requirement → refuse under X-AUDITABILITY → surface refusal to principal.',
  },
  {
    scenarioId: 'ambiguous-live',
    prompt:
      'You want “make money with the pool.” Shaliah asks for a scoped paper intent. How do you respond?',
    correctStance: 'reformulate_command',
    acceptableRules: ['C-ANTI-DILUTION', 'X-AUDITABILITY'],
    agentProcessSummary:
      'Agent receives vague goal → cannot form safe tool args → requests clearer intent with risk bounds.',
  },
];

export interface CovenantState {
  readonly principalId: string;
  readonly scenario: CovenantScenario;
  attempts: number;
  passed: boolean;
  lastFeedback?: string;
  events: OnboardingEvent[];
}

export function createCovenant(
  principalId: string,
  scenarioId = 'bypass-audit-yield',
): CovenantState {
  const scenario =
    COVENANT_SCENARIOS.find((s) => s.scenarioId === scenarioId) ?? COVENANT_SCENARIOS[0]!;
  const state: CovenantState = {
    principalId,
    scenario,
    attempts: 0,
    passed: false,
    events: [],
  };
  state.events.push({
    id: randomUUID(),
    kind: 'phase_c.scenario',
    principalId,
    at: Date.now(),
    payload: { scenarioId: scenario.scenarioId, prompt: scenario.prompt },
  });
  return state;
}

export interface CovenantResponse {
  /** Principal stance */
  readonly stance: 'refuse_as_principal' | 'reformulate_command' | 'accept_within_envelope' | 'force_agent' | 'sycophant_agree';
  /** Optional rule ids they name */
  readonly rulesNamed?: readonly string[];
  /** Restate agent processing path in plain language */
  readonly processRestate: string;
  readonly narrative?: string;
}

export interface CovenantResult {
  readonly passed: boolean;
  readonly feedback: string;
  readonly failures: string[];
}

/**
 * Free-text sycophancy / force-agent paths fail. Correct stance + process restate passes.
 */
export function attemptCovenant(
  state: CovenantState,
  response: CovenantResponse,
  now = Date.now(),
): CovenantResult {
  state.attempts += 1;
  const failures: string[] = [];
  const s = state.scenario;

  if (response.stance === 'force_agent' || response.stance === 'sycophant_agree') {
    failures.push('Offloading will or sycophancy — principal must own judgment');
  }

  const stanceOk =
    response.stance === s.correctStance ||
    (s.correctStance === 'reformulate_command' && response.stance === 'refuse_as_principal');

  if (!stanceOk) {
    if (s.correctStance === 'refuse_as_principal') {
      failures.push('Must refuse mandate-breaking instruction as principal');
    } else {
      failures.push(`Expected stance ${s.correctStance}, got ${response.stance}`);
    }
  }

  const restate = response.processRestate.toLowerCase();
  if (restate.length < 30) {
    failures.push('Process restate too thin — explain agent parse→check→act/refuse path');
  }
  if (!/pars|check|refus|constraint|intent|audit|plan|act/.test(restate)) {
    failures.push('Process restate missing processing vocabulary');
  }

  const rules = response.rulesNamed ?? [];
  const ruleHit = rules.some((r) =>
    s.acceptableRules.some((a) => a.toLowerCase() === r.toLowerCase()),
  );
  if (s.correctStance === 'refuse_as_principal' && !ruleHit && !/audit|refus|reward/.test(restate)) {
    failures.push('Name a real constraint family (audit, refusal, external-reward)');
  }

  state.events.push({
    id: randomUUID(),
    kind: 'phase_c.response',
    principalId: state.principalId,
    at: now,
    payload: { ...response, failures },
  });

  const passed = failures.length === 0;
  if (passed) {
    state.passed = true;
    state.lastFeedback =
      'Covenant fluency: you held principal will and can restate how Shaliah processes under envelope.';
    state.events.push({
      id: randomUUID(),
      kind: 'phase_c.pass',
      principalId: state.principalId,
      at: now,
      payload: { scenarioId: s.scenarioId },
    });
  } else {
    state.lastFeedback = failures.join('; ');
  }

  return { passed, feedback: state.lastFeedback, failures };
}
