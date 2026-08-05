/**
 * Financial Graduation session — FG-1 → FG-2 → FG-3 progression.
 * docs/FG_CURRICULUM.md · docs/JOURNEY_MAP.md §5.1.1
 */

import { randomUUID } from 'node:crypto';
import { completeLessonHappyPath, startLesson } from '../lessonEngine/engine.js';
import type { LessonRuntime } from '../lessonEngine/types.js';
import { getLesson, FG1_LESSON_IDS, FG2_LESSON_IDS, FG3_LESSON_IDS } from './curriculum.js';
import type { MeshaleachPoC } from '@sovereign/types';
import type { Signer } from 'ethers';
import {
  evaluateFg1Gate,
  evaluateFg2Gate,
  evaluateFg3Gate,
  type Fg1Answers,
  type Fg2Answers,
  type Fg3Answers,
  type GateBatteryResult,
} from './gates.js';
import {
  buildUnsignedMeshaleachPoC,
  mintMeshaleachPoC,
} from './meshaleachPoCMint.js';

export type FgProgressState =
  | 'fg_locked'
  | 'fg1_in_progress'
  | 'fg1_passed'
  | 'fg2_in_progress'
  | 'fg2_passed'
  | 'fg3_in_progress'
  | 'fg3_passed';

export interface FgUnlocks {
  /** Full claim + NAV statement */
  readonly claimStatement: boolean;
  /** Safe deployment menu */
  readonly safeDeployMenu: boolean;
  /** High-risk human confirm path */
  readonly highRiskConfirm: boolean;
  /** User may set r in [0.05, 0.30] */
  readonly rateSovereignty: boolean;
  readonly domainTags: string[];
}

export interface FgSession {
  readonly sessionId: string;
  readonly principalId: string;
  state: FgProgressState;
  /** Lesson ids with local mastery events */
  completedLessons: string[];
  activeLesson?: LessonRuntime;
  gateResults: GateBatteryResult[];
  /** Issued Meshaleach PoC seals (one per passed gate when mint opts provided). */
  meshaleachSeals: MeshaleachPoC[];
  /** r locked at 0.20 until fg3_passed */
  r: number;
  rLocked: boolean;
  lastRateChangeAt?: number;
  unlocked: FgUnlocks;
  events: Array<{ id: string; kind: string; at: number; payload?: Record<string, unknown> }>;
}

/** Optional wallet signer for real EIP-191 MeshaleachPoC mint on gate pass. */
export interface FgMintOpts {
  readonly signer: Signer;
  readonly walletAddress?: string;
  readonly withMerkleDisclosure?: boolean;
}

const DEFAULT_R = 0.2;
const R_MIN = 0.05;
const R_MAX = 0.3;
const RATE_CHANGE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

function emptyUnlocks(): FgUnlocks {
  return {
    claimStatement: false,
    safeDeployMenu: false,
    highRiskConfirm: false,
    rateSovereignty: false,
    domainTags: [],
  };
}

export function startFgSession(principalId: string, now = Date.now()): FgSession {
  return {
    sessionId: randomUUID(),
    principalId,
    state: 'fg1_in_progress',
    completedLessons: [],
    gateResults: [],
    meshaleachSeals: [],
    r: DEFAULT_R,
    rLocked: true,
    unlocked: emptyUnlocks(),
    events: [
      {
        id: randomUUID(),
        kind: 'fg.session_start',
        at: now,
        payload: { r: DEFAULT_R, rLocked: true },
      },
    ],
  };
}

async function maybeMintSeal(
  session: FgSession,
  result: GateBatteryResult,
  mint: FgMintOpts | undefined,
  now: number,
): Promise<MeshaleachPoC | undefined> {
  if (!result.passed || !mint) return undefined;
  const unsigned = buildUnsignedMeshaleachPoC({
    principalId: session.principalId,
    gateResult: result,
    walletAddress: mint.walletAddress,
    issuedAt: new Date(now).toISOString(),
    allDomainTags: session.unlocked.domainTags.includes(result.domainTag)
      ? session.unlocked.domainTags
      : [...session.unlocked.domainTags, result.domainTag],
    withMerkleDisclosure: mint.withMerkleDisclosure ?? true,
    population: 'shaliah',
  });
  const { poc, signerAddress } = await mintMeshaleachPoC(unsigned, mint.signer);
  session.meshaleachSeals.push(poc);
  session.events.push({
    id: randomUUID(),
    kind: 'fg.meshaleach_poc_minted',
    at: now,
    payload: {
      gate: result.gate,
      domain_tag: poc.domain_tag,
      proof_system: poc.proof.system,
      signer: signerAddress,
      principal_commitment: poc.principal_commitment,
    },
  });
  return poc;
}

/** Growth Capital may arm before FG; r still locked. */
export function armGrowthCapital(session: FgSession, now = Date.now()): void {
  session.events.push({
    id: randomUUID(),
    kind: 'fg.growth_capital_armed',
    at: now,
    payload: { r: session.r, rLocked: session.rLocked },
  });
}

export function beginLesson(session: FgSession, lessonId: string, now = Date.now()): LessonRuntime {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error(`Unknown lesson ${lessonId}`);
  assertLessonAllowed(session, lesson.gate);
  const rt = startLesson(session.principalId, lesson, now);
  session.activeLesson = rt;
  session.events.push({
    id: randomUUID(),
    kind: 'fg.lesson_start',
    at: now,
    payload: { lessonId, gate: lesson.gate },
  });
  return rt;
}

function assertLessonAllowed(session: FgSession, gate: string): void {
  if (gate === 'fg1' && (session.state === 'fg1_in_progress' || session.state === 'fg_locked')) {
    if (session.state === 'fg_locked') session.state = 'fg1_in_progress';
    return;
  }
  if (gate === 'fg2' && (session.state === 'fg2_in_progress' || session.state === 'fg1_passed')) {
    if (session.state === 'fg1_passed') session.state = 'fg2_in_progress';
    return;
  }
  if (gate === 'fg3' && (session.state === 'fg3_in_progress' || session.state === 'fg2_passed')) {
    if (session.state === 'fg2_passed') session.state = 'fg3_in_progress';
    return;
  }
  // allow review of completed gate lessons
  if (gate === 'fg1' && ['fg1_passed', 'fg2_in_progress', 'fg2_passed', 'fg3_in_progress', 'fg3_passed'].includes(session.state))
    return;
  if (gate === 'fg2' && ['fg2_passed', 'fg3_in_progress', 'fg3_passed'].includes(session.state)) return;
  if (gate === 'fg3' && session.state === 'fg3_passed') return;
  throw new Error(`Lesson gate ${gate} not allowed in state ${session.state}`);
}

export function markLessonComplete(session: FgSession, lessonId: string, now = Date.now()): void {
  if (!session.completedLessons.includes(lessonId)) {
    session.completedLessons.push(lessonId);
  }
  session.events.push({
    id: randomUUID(),
    kind: 'fg.lesson_complete',
    at: now,
    payload: { lessonId },
  });
  session.activeLesson = undefined;
}

export function fg1LessonsComplete(session: FgSession): boolean {
  return FG1_LESSON_IDS.every((id) => session.completedLessons.includes(id));
}

export function fg2LessonsComplete(session: FgSession): boolean {
  return FG2_LESSON_IDS.every((id) => session.completedLessons.includes(id));
}

export function fg3LessonsComplete(session: FgSession): boolean {
  return FG3_LESSON_IDS.every((id) => session.completedLessons.includes(id));
}

export async function attemptFg1Gate(
  session: FgSession,
  answers: Fg1Answers,
  now = Date.now(),
  mint?: FgMintOpts,
): Promise<GateBatteryResult> {
  if (!fg1LessonsComplete(session)) {
    throw new Error('Complete L1.1–L1.5 before FG-1 gate battery');
  }
  const result = evaluateFg1Gate(session.principalId, answers, now);
  session.gateResults.push(result);
  session.events.push({
    id: randomUUID(),
    kind: result.passed ? 'fg.gate_pass' : 'fg.gate_fail',
    at: now,
    payload: { gate: 'fg1', failures: result.failures, sig: result.integritySignature },
  });
  if (result.passed) {
    session.state = 'fg1_passed';
    session.unlocked = {
      ...session.unlocked,
      claimStatement: true,
      safeDeployMenu: true,
      domainTags: [...session.unlocked.domainTags, result.domainTag],
    };
    await maybeMintSeal(session, result, mint, now);
  }
  return result;
}

export async function attemptFg2Gate(
  session: FgSession,
  answers: Fg2Answers,
  now = Date.now(),
  mint?: FgMintOpts,
): Promise<GateBatteryResult> {
  if (session.state !== 'fg2_in_progress' && session.state !== 'fg1_passed') {
    if (session.state !== 'fg2_passed' && session.state !== 'fg3_in_progress' && session.state !== 'fg3_passed') {
      // must have fg1
    }
  }
  if (!(session.state === 'fg1_passed' || session.state === 'fg2_in_progress')) {
    throw new Error('FG-2 gate requires fg1_passed or fg2_in_progress');
  }
  if (!fg2LessonsComplete(session)) {
    throw new Error('Complete L2.1–L2.5 before FG-2 gate battery');
  }
  session.state = 'fg2_in_progress';
  const result = evaluateFg2Gate(session.principalId, answers, now);
  session.gateResults.push(result);
  session.events.push({
    id: randomUUID(),
    kind: result.passed ? 'fg.gate_pass' : 'fg.gate_fail',
    at: now,
    payload: { gate: 'fg2', failures: result.failures, sig: result.integritySignature },
  });
  if (result.passed) {
    session.state = 'fg2_passed';
    session.unlocked = {
      ...session.unlocked,
      highRiskConfirm: true,
      domainTags: [...session.unlocked.domainTags, result.domainTag],
    };
    await maybeMintSeal(session, result, mint, now);
  }
  return result;
}

export async function attemptFg3Gate(
  session: FgSession,
  answers: Fg3Answers,
  now = Date.now(),
  mint?: FgMintOpts,
): Promise<GateBatteryResult> {
  if (!(session.state === 'fg2_passed' || session.state === 'fg3_in_progress')) {
    throw new Error('FG-3 gate requires fg2_passed or fg3_in_progress');
  }
  if (!fg3LessonsComplete(session)) {
    throw new Error('Complete L3.1–L3.4 before FG-3 gate battery');
  }
  session.state = 'fg3_in_progress';
  const result = evaluateFg3Gate(session.principalId, answers, now);
  session.gateResults.push(result);
  session.events.push({
    id: randomUUID(),
    kind: result.passed ? 'fg.gate_pass' : 'fg.gate_fail',
    at: now,
    payload: { gate: 'fg3', failures: result.failures, sig: result.integritySignature },
  });
  if (result.passed) {
    session.state = 'fg3_passed';
    session.rLocked = false;
    session.unlocked = {
      ...session.unlocked,
      rateSovereignty: true,
      domainTags: [...session.unlocked.domainTags, result.domainTag],
    };
    // apply first sovereign choice if provided
    if (answers.chosenR >= R_MIN && answers.chosenR <= R_MAX) {
      session.r = answers.chosenR;
      session.lastRateChangeAt = now;
    }
    await maybeMintSeal(session, result, mint, now);
  }
  return result;
}

/**
 * User sets r after FG-3 only. Cooldown 30 days. Bounds [0.05, 0.30].
 * Shaliah never calls this on behalf of the user without explicit principal intent.
 */
export function setUserRate(
  session: FgSession,
  nextR: number,
  now = Date.now(),
): { ok: boolean; feedback: string } {
  if (!session.unlocked.rateSovereignty || session.rLocked) {
    return { ok: false, feedback: 'Rate sovereignty locked until FG-3 pass.' };
  }
  if (nextR < R_MIN || nextR > R_MAX) {
    return { ok: false, feedback: `r must be in [${R_MIN}, ${R_MAX}].` };
  }
  if (nextR === 0) {
    return { ok: false, feedback: 'r=0 disallowed in v1.' };
  }
  if (session.lastRateChangeAt && now - session.lastRateChangeAt < RATE_CHANGE_COOLDOWN_MS) {
    return { ok: false, feedback: 'Max 1 rate change per 30 days.' };
  }
  session.r = nextR;
  session.lastRateChangeAt = now;
  session.events.push({
    id: randomUUID(),
    kind: 'fg.rate_set',
    at: now,
    payload: { r: nextR },
  });
  return { ok: true, feedback: `r set to ${nextR}` };
}

export function optInSeasonalEscalate(
  session: FgSession,
  confirm: boolean,
  now = Date.now(),
): { ok: boolean; feedback: string; newR?: number } {
  if (!session.unlocked.rateSovereignty) {
    return { ok: false, feedback: 'Escalate requires FG-3.' };
  }
  if (!confirm) {
    session.events.push({ id: randomUUID(), kind: 'fg.escalate_refuse', at: now });
    return { ok: true, feedback: 'Escalate refused — will preserved.' };
  }
  const bump = 0.02;
  const newR = Math.min(R_MAX, session.r + bump);
  // escalate bypasses 30d cooldown once per season by product rule (opt-in confirm)
  session.r = newR;
  session.lastRateChangeAt = now;
  session.events.push({
    id: randomUUID(),
    kind: 'fg.escalate_accept',
    at: now,
    payload: { r: newR, bump },
  });
  return { ok: true, feedback: `Escalated +${bump} → r=${newR}`, newR };
}

/** Demo helper: complete all lessons in a gate with keyword-rich answers. */
export function completeLessonsForGate(
  session: FgSession,
  gate: 'fg1' | 'fg2' | 'fg3',
  now = Date.now(),
): void {
  const ids =
    gate === 'fg1' ? FG1_LESSON_IDS : gate === 'fg2' ? FG2_LESSON_IDS : FG3_LESSON_IDS;
  let t = now;
  for (const id of ids) {
    const lesson = getLesson(id)!;
    const answers = cannedAnswers(id);
    completeLessonHappyPath(session.principalId, lesson, answers, t);
    markLessonComplete(session, id, t);
    t += 1000;
  }
  if (gate === 'fg1') session.state = 'fg1_in_progress';
  if (gate === 'fg2') session.state = session.state === 'fg1_passed' ? 'fg2_in_progress' : session.state;
  if (gate === 'fg3') session.state = session.state === 'fg2_passed' ? 'fg3_in_progress' : session.state;
}

function cannedAnswers(lessonId: string): {
  retrieve: string;
  explain: string;
  interleave: string;
  transfer: string;
} {
  // Broad keyword soup tuned to each lesson's keys — for tests/demos only.
  const table: Record<string, { retrieve: string; explain: string; interleave: string; transfer: string }> = {
    'L1.1': {
      retrieve: 'Yield is not free money; it pays for risk.',
      explain: 'Identical APY can hide drawdown and liquidity risk.',
      interleave: 'Guaranteed return still has risk and cost of capital.',
      transfer: 'A guaranteed savings return can still hide risk and cost.',
    },
    'L1.2': {
      retrieve: 'Time preference trades now cash vs future compound growth.',
      explain: 'Extracting early cuts compound seasons of growth capital.',
      interleave: 'Breaking soft commitment early has a cost in time value.',
      transfer: 'Waiting on a crop has a later payoff cost of waiting tradeoff.',
    },
    'L1.3': {
      retrieve: 'Units stay; NAV drop lowers claim value.',
      explain: 'Individual units track my claim; pool NAV is collective funds.',
      interleave: 'NAV rise increases claim value; units unchanged.',
      transfer: 'My claim is units in a collective pool, not a private vault of coins.',
    },
    'L1.4': {
      retrieve: 'I check liquidity risk and smart contract risk first.',
      explain: 'Naming failure modes first beats chasing yield.',
      interleave: 'Lower APY with audit can beat high risk pool on risk grounds.',
      transfer: 'Lending pool risk differs from AMM pool risk but both need risk naming.',
    },
    'L1.5': {
      retrieve: 'The cost of waiting includes storage and time.',
      explain: 'Storage time maps to growth capital soft commit windows.',
      interleave: 'Production needs capital now — time demand tradeoff.',
      transfer: 'Commodity hold cost of waiting maps to growth capital commit windows.',
    },
    'L2.1': {
      retrieve: 'Alpha claim, beta community, gamma job escrow — 40 35 25.',
      explain: 'Pure claim maximization starves community seasons and commons pool.',
      interleave: 'Season bounty from community pool benefits the cohort floor.',
      transfer: 'I allocate claim community and job channels without pure private hoarding.',
    },
    'L2.2': {
      retrieve: 'Panic selling and freeze are unhealthy drawdown reactions to loss.',
      explain: 'Coherent action reassesses risk; loss is information not panic.',
      interleave: 'Leaderboard pressure does not change my risk assess plan.',
      transfer: 'Market shock: reassess risk and keep commit unless hardship.',
    },
    'L2.3': {
      retrieve: 'The human must confirm high risk deploys.',
      explain: 'Autopilot success causes atrophy and must not raise PL.',
      interleave: 'Hidden auto confirm is wrong; require refuse or confirm.',
      transfer: 'I refuse auto accept on Multitude jobs; I confirm or refuse.',
    },
    'L2.4': {
      retrieve: 'Soft uses windows and emergency; hard vault is opt-in lock.',
      explain: 'Hard vault helps goals but can harm if not opt-in; not inaccessible by default.',
      interleave: 'Emergency path needs honest need without gaming.',
      transfer: 'Hardship request states honest need and short emergency window.',
    },
    'L2.5': {
      retrieve: 'Job escrow needs Integrity proof of skill and PoC seal.',
      explain: 'Teach bridge and escrow talent raise the floor with transfer proof.',
      interleave: 'Missing domain means I transfer skill before applying.',
      transfer: 'I teach a peer one domain bridge toward their seal.',
    },
    'L3.1': {
      retrieve: 'G equals r times eligible C yield.',
      explain: 'If C is zero, changing r does nothing without eligible yield.',
      interleave: 'Higher r funds more claim and commons from eligible C.',
      transfer: 'r is not a tax on all income; only eligible ecosystem yield.',
    },
    'L3.2': {
      retrieve: 'Floor is 5 percent and ceiling is 30 percent after graduation.',
      explain: 'Casual zero starves the pool and commons; autonomy still has bounds.',
      interleave: 'Floor protects pool mechanism and future self.',
      transfer: 'Locked default 20 is commitment; post-grad choice is bounded autonomy.',
    },
    'L3.3': {
      retrieve: 'Only the human user principal may set r after FG-3.',
      explain: 'I pick lower r if liquidity goal; higher if stable claim growth.',
      interleave: 'I refuse when a coach sounds like it decided my r for me.',
      transfer: 'I choose r because of my claim risk goal and horizon.',
    },
    'L3.4': {
      retrieve: 'Escalate is opt-in with user consent not automatic.',
      explain: 'I refuse escalate if liquidity stress or short-term goal.',
      interleave: 'Confirm copy must ask consent without dark patterns.',
      transfer: 'Habit escalate needs consent so will stays with the human.',
    },
  };
  return (
    table[lessonId] ?? {
      retrieve: 'risk time claim yield',
      explain: 'risk time claim yield pool',
      interleave: 'risk time claim yield pool',
      transfer: 'risk time claim yield pool transfer',
    }
  );
}

export const FG_R_DEFAULT = DEFAULT_R;
export const FG_R_MIN = R_MIN;
export const FG_R_MAX = R_MAX;
export const FG_RATE_COOLDOWN_MS = RATE_CHANGE_COOLDOWN_MS;
