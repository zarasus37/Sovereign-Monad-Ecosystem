import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLesson } from '../fg/curriculum.js';
import {
  completeLessonHappyPath,
  completeModel,
  keyCoverage,
  satisfyDelay,
  startLesson,
  submitInterleave,
  submitRetrieval,
  submitSelfExplain,
  submitTransfer,
} from './engine.js';

describe('lesson engine', () => {
  it('scores key coverage', () => {
    assert.ok(keyCoverage('yield is risk pay', ['risk', 'yield']) >= 1);
    assert.equal(keyCoverage('hello', ['risk', 'yield']), 0);
  });

  it('enforces delay before transfer', () => {
    const lesson = getLesson('L1.3')!;
    const rt = startLesson('p1', lesson, 1000);
    completeModel(rt, 1000);
    submitRetrieval(rt, 'Units stay; NAV drop lowers claim value.', {}, 1001);
    submitSelfExplain(
      rt,
      'Individual units track my claim; pool NAV is collective funds working together.',
      {},
      1002,
    );
    submitInterleave(rt, 'NAV rise increases claim value; units unchanged.', {}, 1003);
    const early = satisfyDelay(rt, 1003 + 10);
    assert.equal(early.correct, false);
    const okDelay = satisfyDelay(rt, 1003 + lesson.delayMs + 1);
    assert.equal(okDelay.correct, true);
    const tr = submitTransfer(
      rt,
      'My claim is units in a collective pool, not a private vault of coins.',
      {},
      1003 + lesson.delayMs + 2,
    );
    assert.equal(tr.correct, true);
    assert.equal(rt.mastery, 'mastered');
    assert.ok(rt.masteryEvent?.integritySignature);
  });

  it('happy path mints mastery for L1.1', () => {
    const lesson = getLesson('L1.1')!;
    const rt = completeLessonHappyPath(
      'p1',
      lesson,
      {
        retrieve: 'Yield is not free money; it pays for risk.',
        explain: 'Identical APY can hide drawdown and liquidity risk.',
        interleave: 'Guaranteed return still has risk and cost.',
        transfer: 'A guaranteed savings return can still hide risk and cost.',
      },
      1,
    );
    assert.equal(rt.phase, 'complete');
    assert.equal(rt.mastery, 'mastered');
  });
});
