import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  composeShaliahPrompt,
  defaultOfficeForLesson,
  OFFICE_PROMPTS,
  promptForLesson,
} from './shaliahOffices.js';

describe('Shaliah office prompts', () => {
  it('exports five offices', () => {
    assert.equal(Object.keys(OFFICE_PROMPTS).length, 5);
  });

  it('forbids co-captain and setting r in every office', () => {
    for (const pack of Object.values(OFFICE_PROMPTS)) {
      assert.match(pack.system, /NOT a co-sovereign|co-captain|ONE identity spine/i);
      assert.ok(
        pack.never.some((n) => /r\b|rate|autopilot|co-authorship|life-agenda/i.test(n)) ||
          /never set/i.test(pack.system),
      );
    }
  });

  it('composes FG-3 overlay that forbids selecting r', () => {
    const p = composeShaliahPrompt({ office: 'coach', fgStage: 'fg3', lessonId: 'L3.3' });
    assert.match(p.system, /MUST NOT select r/i);
    assert.match(p.system, /I set r/i);
  });

  it('maps lessons to default offices', () => {
    assert.equal(defaultOfficeForLesson('L2.3'), 'transactional_vehicle');
    assert.equal(defaultOfficeForLesson('L1.3'), 'mirror');
    const lessonPrompt = promptForLesson('L1.1', 'Yield is not free', 'fg1');
    assert.equal(lessonPrompt.office, 'coach');
    assert.match(lessonPrompt.system, /FG-1/);
  });
});
