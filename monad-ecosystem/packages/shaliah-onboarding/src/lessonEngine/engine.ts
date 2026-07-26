/**
 * Lesson engine — phase progression with retrieval, delay, transfer, mastery.
 */

import { createHash, randomUUID } from 'node:crypto';
import type {
  Attempt,
  LessonDefinition,
  LessonRuntime,
  LessonSubmitResult,
  MasteryEvent,
  MasteryState,
  TutorAction,
} from './types.js';

const PHASE_ORDER = [
  'orient',
  'model',
  'retrieve',
  'feedback',
  'fade',
  'interleave',
  'delay',
  'transfer',
  'gate',
  'complete',
] as const;

function nextPhase(current: (typeof PHASE_ORDER)[number]): (typeof PHASE_ORDER)[number] {
  const i = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[Math.min(i + 1, PHASE_ORDER.length - 1)]!;
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Score how many expected keys appear in response (0..1). */
export function keyCoverage(response: string, keys: readonly string[]): number {
  if (keys.length === 0) return response.trim().length >= 12 ? 1 : 0;
  const n = normalize(response);
  let hit = 0;
  for (const k of keys) {
    if (n.includes(normalize(k))) hit += 1;
  }
  return hit / keys.length;
}

export function explanationQuality(response: string, keys: readonly string[]): number {
  const coverage = keyCoverage(response, keys);
  const lenBonus = Math.min(1, response.trim().length / 80);
  return Math.min(1, coverage * 0.7 + lenBonus * 0.3);
}

function pushAttempt(
  rt: LessonRuntime,
  phase: LessonRuntime['phase'],
  response: string,
  correct: boolean,
  quality: number,
  hintsUsed: number,
  startedAt: number,
  now: number,
): Attempt {
  const a: Attempt = {
    id: randomUUID(),
    lessonId: rt.lesson.id,
    phase,
    response,
    at: now,
    latencyMs: Math.max(0, now - startedAt),
    hintsUsed,
    correct,
    explanationQuality: quality,
  };
  rt.attempts.push(a);
  return a;
}

function pushTutor(
  rt: LessonRuntime,
  selectedPrompt: string,
  rationale: string,
  next: LessonRuntime['phase'],
  interleaving: boolean,
  now: number,
): TutorAction {
  const t: TutorAction = {
    id: randomUUID(),
    lessonId: rt.lesson.id,
    at: now,
    selectedPrompt,
    rationale,
    nextPhase: next,
    scaffoldLevel: rt.scaffoldLevel,
    interleaving,
  };
  rt.tutorActions.push(t);
  return t;
}

function masteryFromPhase(rt: LessonRuntime): MasteryState {
  if (rt.masteryEvent) return 'mastered';
  if (rt.transferPassedAt) return 'transferable';
  if (rt.delaySatisfiedAt) return 'delayed';
  if (rt.retrievePassedAt && rt.explainPassedAt) return 'practiced';
  if (rt.modelSeenAt) return 'guided';
  return 'novice';
}

export function startLesson(
  principalId: string,
  lesson: LessonDefinition,
  now = Date.now(),
): LessonRuntime {
  const rt: LessonRuntime = {
    principalId,
    lesson,
    phase: 'orient',
    mastery: 'novice',
    scaffoldLevel: 3,
    startedAt: now,
    attempts: [],
    tutorActions: [],
  };
  pushTutor(rt, lesson.objective, 'orient: state objective and success condition', 'model', false, now);
  rt.phase = 'model';
  return rt;
}

/** Learner acknowledges the worked example. */
export function completeModel(rt: LessonRuntime, now = Date.now()): LessonSubmitResult {
  if (rt.phase !== 'model' && rt.phase !== 'orient') {
    return fail(rt, 'Expected model phase');
  }
  rt.modelSeenAt = now;
  rt.phase = 'retrieve';
  rt.mastery = masteryFromPhase(rt);
  pushTutor(rt, rt.lesson.retrievePrompt, 'model done → retrieval', 'retrieve', false, now);
  return ok(rt, true, 'Worked example absorbed. Retrieve the rule before going further.');
}

/**
 * Retrieval attempt — must hit key coverage threshold before explain.
 */
export function submitRetrieval(
  rt: LessonRuntime,
  response: string,
  opts: { hintsUsed?: number; startedAt?: number } = {},
  now = Date.now(),
): LessonSubmitResult {
  if (rt.phase !== 'retrieve' && rt.phase !== 'feedback') {
    return fail(rt, 'Not in retrieve phase');
  }
  const coverage = keyCoverage(response, rt.lesson.retrieveKeys);
  const correct = coverage >= 0.34 && response.trim().length >= 8;
  pushAttempt(
    rt,
    'retrieve',
    response,
    correct,
    coverage,
    opts.hintsUsed ?? 0,
    opts.startedAt ?? rt.startedAt,
    now,
  );

  if (!correct) {
    rt.phase = 'feedback';
    rt.scaffoldLevel = Math.min(5, rt.scaffoldLevel + 1);
    rt.lastFeedback =
      'Retrieval incomplete. Name the deep rule in your own words — risk, claim, or time, not slogans.';
    pushTutor(rt, rt.lesson.retrievePrompt, 'failed retrieval → feedback', 'retrieve', false, now);
    return ok(rt, false, rt.lastFeedback);
  }

  rt.retrievePassedAt = now;
  rt.phase = 'fade';
  rt.scaffoldLevel = Math.max(0, rt.scaffoldLevel - 1);
  rt.mastery = masteryFromPhase(rt);
  pushTutor(rt, rt.lesson.selfExplainPrompt, 'retrieval ok → self-explain', 'fade', false, now);
  // collapse fade into explain prompt for v1 engine
  rt.phase = 'fade';
  return ok(rt, true, 'Retrieval accepted. Now self-explain why the rule holds.');
}

export function submitSelfExplain(
  rt: LessonRuntime,
  response: string,
  opts: { hintsUsed?: number; startedAt?: number } = {},
  now = Date.now(),
): LessonSubmitResult {
  if (rt.phase !== 'fade' && rt.phase !== 'feedback' && rt.phase !== 'retrieve') {
    // allow explain right after retrieve pass
    if (!rt.retrievePassedAt) return fail(rt, 'Complete retrieval first');
  }
  const quality = explanationQuality(response, rt.lesson.explainKeys);
  const correct = quality >= 0.4;
  pushAttempt(
    rt,
    'fade',
    response,
    correct,
    quality,
    opts.hintsUsed ?? 0,
    opts.startedAt ?? rt.startedAt,
    now,
  );

  if (!correct) {
    rt.phase = 'feedback';
    rt.lastFeedback = 'Explanation too thin. Connect the deep rule to a concrete consequence.';
    return ok(rt, false, rt.lastFeedback);
  }

  rt.explainPassedAt = now;
  rt.phase = 'interleave';
  rt.mastery = masteryFromPhase(rt);
  pushTutor(rt, rt.lesson.interleavePrompt, 'explain ok → interleave', 'interleave', true, now);
  return ok(rt, true, 'Good explanation. Interleave: related but distinct case.');
}

export function submitInterleave(
  rt: LessonRuntime,
  response: string,
  opts: { hintsUsed?: number; startedAt?: number } = {},
  now = Date.now(),
): LessonSubmitResult {
  if (rt.phase !== 'interleave' && !rt.explainPassedAt) {
    return fail(rt, 'Not ready for interleave');
  }
  const coverage = keyCoverage(response, rt.lesson.retrieveKeys);
  const correct = coverage >= 0.25 && response.trim().length >= 8;
  pushAttempt(
    rt,
    'interleave',
    response,
    correct,
    coverage,
    opts.hintsUsed ?? 0,
    opts.startedAt ?? rt.startedAt,
    now,
  );

  if (!correct) {
    rt.lastFeedback = 'Interleave failed — discriminate this case from the model example.';
    return ok(rt, false, rt.lastFeedback);
  }

  rt.interleavePassedAt = now;
  rt.phase = 'delay';
  rt.mastery = masteryFromPhase(rt);
  pushTutor(
    rt,
    `Wait ≥ ${rt.lesson.delayMs}ms before transfer (spacing).`,
    'interleave ok → delay',
    'delay',
    true,
    now,
  );
  return ok(
    rt,
    true,
    `Interleave accepted. Spacing delay required before transfer (≥ ${rt.lesson.delayMs}ms).`,
  );
}

/** Call when delay window has elapsed (or force in tests with now). */
export function satisfyDelay(rt: LessonRuntime, now = Date.now()): LessonSubmitResult {
  if (rt.phase !== 'delay' && !rt.interleavePassedAt) {
    return fail(rt, 'Not in delay phase');
  }
  const anchor = rt.interleavePassedAt ?? rt.explainPassedAt ?? rt.startedAt;
  if (now - anchor < rt.lesson.delayMs) {
    const left = rt.lesson.delayMs - (now - anchor);
    rt.lastFeedback = `Delay not satisfied — ${left}ms remaining (desirable difficulty / spacing).`;
    return ok(rt, false, rt.lastFeedback);
  }
  rt.delaySatisfiedAt = now;
  rt.phase = 'transfer';
  rt.mastery = masteryFromPhase(rt);
  pushTutor(rt, rt.lesson.transferPrompt, 'delay ok → transfer', 'transfer', false, now);
  return ok(rt, true, 'Delay satisfied. Transfer: new surface, same deep rule.');
}

export function submitTransfer(
  rt: LessonRuntime,
  response: string,
  opts: { hintsUsed?: number; startedAt?: number } = {},
  now = Date.now(),
): LessonSubmitResult {
  if (rt.phase !== 'transfer') {
    if (rt.phase === 'delay') {
      return fail(rt, 'Satisfy delay before transfer');
    }
    return fail(rt, 'Not in transfer phase');
  }
  const coverage = keyCoverage(response, rt.lesson.transferKeys);
  const quality = explanationQuality(response, rt.lesson.explainKeys);
  const correct = coverage >= 0.34 && quality >= 0.35;
  pushAttempt(
    rt,
    'transfer',
    response,
    correct,
    quality,
    opts.hintsUsed ?? 0,
    opts.startedAt ?? rt.startedAt,
    now,
  );

  if (!correct) {
    rt.scaffoldLevel = Math.min(5, rt.scaffoldLevel + 1);
    rt.lastFeedback =
      'Transfer incomplete. Keep the deep rule constant; change only the surface form.';
    return ok(rt, false, rt.lastFeedback);
  }

  rt.transferPassedAt = now;
  rt.phase = 'gate';
  rt.mastery = 'transferable';

  const score = Math.min(1, (coverage + quality) / 2);
  const masteryEvent = mintMastery(rt, score, true, now);
  rt.masteryEvent = masteryEvent;
  rt.phase = 'complete';
  rt.mastery = 'mastered';
  pushTutor(rt, 'Lesson mastery minted (local Integrity placeholder).', 'transfer ok → complete', 'complete', false, now);

  return {
    ok: true,
    phase: rt.phase,
    mastery: rt.mastery,
    feedback: 'Delayed transfer accepted. Lesson mastery event minted.',
    correct: true,
    masteryEvent,
  };
}

function mintMastery(
  rt: LessonRuntime,
  score: number,
  delayedTransfer: boolean,
  now: number,
): MasteryEvent {
  const payload = `${rt.principalId}|${rt.lesson.id}|${score}|${now}`;
  const integritySignature = createHash('sha256').update(payload).digest('hex').slice(0, 32);
  return {
    id: randomUUID(),
    principalId: rt.principalId,
    lessonId: rt.lesson.id,
    gate: rt.lesson.gate,
    at: now,
    delayedTransfer,
    score,
    integritySignature,
    domainTags: [rt.lesson.gate, rt.lesson.id],
  };
}

function ok(rt: LessonRuntime, correct: boolean, feedback: string): LessonSubmitResult {
  rt.lastFeedback = feedback;
  return {
    ok: true,
    phase: rt.phase,
    mastery: rt.mastery,
    feedback,
    correct,
    masteryEvent: rt.masteryEvent,
  };
}

function fail(rt: LessonRuntime, feedback: string): LessonSubmitResult {
  rt.lastFeedback = feedback;
  return {
    ok: false,
    phase: rt.phase,
    mastery: rt.mastery,
    feedback,
    correct: false,
  };
}

/** Fast path for demos/tests: run full pipeline with canned good answers. */
export function completeLessonHappyPath(
  principalId: string,
  lesson: LessonDefinition,
  answers: {
    retrieve: string;
    explain: string;
    interleave: string;
    transfer: string;
  },
  now = Date.now(),
): LessonRuntime {
  let t = now;
  const rt = startLesson(principalId, lesson, t);
  completeModel(rt, t);
  t += 1;
  submitRetrieval(rt, answers.retrieve, {}, t);
  t += 1;
  submitSelfExplain(rt, answers.explain, {}, t);
  t += 1;
  submitInterleave(rt, answers.interleave, {}, t);
  t += lesson.delayMs + 1;
  satisfyDelay(rt, t);
  t += 1;
  submitTransfer(rt, answers.transfer, {}, t);
  return rt;
}

export function advancePhaseName(phase: LessonRuntime['phase']): LessonRuntime['phase'] {
  return nextPhase(phase as (typeof PHASE_ORDER)[number]);
}
