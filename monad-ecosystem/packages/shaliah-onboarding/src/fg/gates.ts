/**
 * FG-1 / FG-2 / FG-3 gate batteries — docs/FG_CURRICULUM.md
 */

import { createHash, randomUUID } from 'node:crypto';
import { explanationQuality, keyCoverage } from '../lessonEngine/engine.js';

export type FgGateId = 'fg1' | 'fg2' | 'fg3';

export interface GateItemResult {
  readonly itemId: string;
  readonly passed: boolean;
  readonly feedback: string;
  readonly score: number;
}

export interface GateBatteryResult {
  readonly gate: FgGateId;
  readonly passed: boolean;
  readonly items: GateItemResult[];
  readonly integritySignature: string;
  readonly domainTag: string;
  readonly failures: string[];
}

function sign(principalId: string, gate: FgGateId, score: number, at: number): string {
  return createHash('sha256')
    .update(`${principalId}|${gate}|${score}|${at}`)
    .digest('hex')
    .slice(0, 32);
}

// ─── FG-1 ─────────────────────────────────────────────────

export interface Fg1Answers {
  /** DeFi: safer structure + two risks */
  readonly defiRisk: string;
  /** Time preference tradeoff */
  readonly timePreference: string;
  /** Real-economy transfer */
  readonly realEconomy: string;
  /** Claim vs pool explanation */
  readonly claimExplain: string;
}

export function evaluateFg1Gate(
  principalId: string,
  answers: Fg1Answers,
  now = Date.now(),
): GateBatteryResult {
  const items: GateItemResult[] = [
    item(
      'T1',
      keyCoverage(answers.defiRisk, ['risk', 'liquidity', 'pool', 'drawdown', 'contract']) >= 0.25 &&
        answers.defiRisk.trim().length >= 20,
      answers.defiRisk,
      'Name safer structure and at least two risks.',
    ),
    item(
      'T2',
      keyCoverage(answers.timePreference, ['time', 'compound', 'wait', 'future', 'patience']) >= 0.25,
      answers.timePreference,
      'Explain time preference / compounding tradeoff.',
    ),
    item(
      'T3',
      keyCoverage(answers.realEconomy, ['cost', 'time', 'storage', 'demand', 'production', 'commodity']) >=
        0.2,
      answers.realEconomy,
      'Transfer deep rule to real-economy surface.',
    ),
    item(
      'E1',
      explanationQuality(answers.claimExplain, ['claim', 'units', 'nav', 'pool', 'collective']) >= 0.4,
      answers.claimExplain,
      'Explain claim vs pool in plain language.',
    ),
  ];
  return finalize(principalId, 'fg1', 'fg1.literacy', items, now);
}

// ─── FG-2 ─────────────────────────────────────────────────

export interface Fg2Answers {
  readonly channelAlloc: string;
  readonly drawdown: string;
  /** Must confirm or refuse high-risk — never autopilot */
  readonly highRiskAction: 'confirm' | 'refuse' | 'autopilot';
  readonly highRiskReason: string;
  readonly liquidityChoice: string;
  readonly stewardshipExplain: string;
}

export function evaluateFg2Gate(
  principalId: string,
  answers: Fg2Answers,
  now = Date.now(),
): GateBatteryResult {
  const autopilotFail = answers.highRiskAction === 'autopilot';
  const highRiskOk =
    !autopilotFail &&
    (answers.highRiskAction === 'confirm' || answers.highRiskAction === 'refuse') &&
    answers.highRiskReason.trim().length >= 12;

  const items: GateItemResult[] = [
    item(
      'T1',
      keyCoverage(answers.channelAlloc, ['claim', 'community', 'job', 'escrow', 'commons']) >= 0.3,
      answers.channelAlloc,
      'Allocate mock G across channels with justification.',
    ),
    item(
      'T2',
      keyCoverage(answers.drawdown, ['panic', 'risk', 'action', 'assess', 'not freeze', 'loss']) >= 0.2 &&
        answers.drawdown.trim().length >= 24,
      answers.drawdown,
      'Drawdown: coherent action + self-explanation.',
    ),
    item(
      'T3',
      highRiskOk,
      answers.highRiskReason,
      autopilotFail
        ? 'FAIL: autopilot high-risk is forbidden (Identity v2 / Learning Constitution).'
        : 'High-risk confirm or refuse with reason.',
    ),
    item(
      'T4',
      keyCoverage(answers.liquidityChoice, ['soft', 'hard', 'window', 'emergency', 'vault', 'commit']) >=
        0.25,
      answers.liquidityChoice,
      'Choose liquidity mode and explain.',
    ),
    item(
      'E1',
      explanationQuality(answers.stewardshipExplain, ['steward', 'claim', 'pool', 'shared', 'human']) >=
        0.35,
      answers.stewardshipExplain,
      'What stewardship means for personal claim in shared pool.',
    ),
  ];
  return finalize(principalId, 'fg2', 'fg2.stewardship', items, now);
}

// ─── FG-3 ─────────────────────────────────────────────────

export interface Fg3Answers {
  /** Predictions for 5% / 20% / 30% */
  readonly ratePredictions: string;
  readonly boundsDefense: string;
  /** Chosen r in [0.05, 0.30] */
  readonly chosenR: number;
  readonly chosenRReason: string;
  readonly escalate: 'accept' | 'refuse';
  readonly escalateReason: string;
  readonly covenantStatement: string;
}

export function evaluateFg3Gate(
  principalId: string,
  answers: Fg3Answers,
  now = Date.now(),
): GateBatteryResult {
  const rOk = answers.chosenR >= 0.05 && answers.chosenR <= 0.3;
  const items: GateItemResult[] = [
    item(
      'T1',
      keyCoverage(answers.ratePredictions, ['5', '20', '30', 'claim', 'commons', '0.05', '0.20', '0.30']) >=
        0.3,
      answers.ratePredictions,
      'Predict outcomes for 5% / 20% / 30%.',
    ),
    item(
      'T2',
      keyCoverage(answers.boundsDefense, ['floor', 'ceiling', 'pool', 'commons', 'zero', 'liquidity']) >=
        0.25,
      answers.boundsDefense,
      'Defend floor/ceiling with mechanism language.',
    ),
    item(
      'T3',
      rOk && answers.chosenRReason.trim().length >= 16,
      answers.chosenRReason,
      rOk ? 'Personal rate choice with reason.' : 'chosenR must be in [0.05, 0.30].',
    ),
    item(
      'T4',
      (answers.escalate === 'accept' || answers.escalate === 'refuse') &&
        answers.escalateReason.trim().length >= 8,
      answers.escalateReason,
      'Accept or refuse seasonal escalate with reason.',
    ),
    item(
      'E1',
      keyCoverage(answers.covenantStatement, ['i set', 'shaliah', 'not', 'r', 'claim', 'mine', 'human']) >=
        0.25 ||
        /i set.*r|shaliah does not|my claim/i.test(answers.covenantStatement),
      answers.covenantStatement,
      'Covenant: I set r; Shaliah does not; claim stays mine.',
    ),
  ];
  return finalize(principalId, 'fg3', 'fg3.rate_sovereignty', items, now);
}

function item(
  itemId: string,
  passed: boolean,
  _response: string,
  feedback: string,
): GateItemResult {
  return {
    itemId,
    passed,
    feedback: passed ? `PASS ${itemId}` : `FAIL ${itemId}: ${feedback}`,
    score: passed ? 1 : 0,
  };
}

function finalize(
  principalId: string,
  gate: FgGateId,
  domainTag: string,
  items: GateItemResult[],
  now: number,
): GateBatteryResult {
  const failures = items.filter((i) => !i.passed).map((i) => i.feedback);
  const passed = failures.length === 0;
  const score = items.reduce((s, i) => s + i.score, 0) / items.length;
  return {
    gate,
    passed,
    items,
    integritySignature: sign(principalId, gate, score, now),
    domainTag,
    failures,
  };
}

export function gateEventPayload(result: GateBatteryResult, principalId: string): Record<string, unknown> {
  return {
    id: randomUUID(),
    principalId,
    gate: result.gate,
    passed: result.passed,
    domainTag: result.domainTag,
    integritySignature: result.integritySignature,
    failures: result.failures,
    items: result.items,
  };
}
