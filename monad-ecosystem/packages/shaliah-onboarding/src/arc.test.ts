import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  arcAttemptCovenant,
  arcBeginCovenant,
  arcFailedThenClear,
  arcGetThoughtProcess,
  arcSubmitReconstruction,
  completeArcFoundation,
  evaluateGraduation,
  startArc,
  syncArcPhase,
} from './arc.js';
import { DEMO_NEO, DEMO_SD3 } from './phase0Foundation.js';

describe('Vector 1 arc (mutual knowing)', () => {
  it('runs foundation → channel → read-mind → covenant → graduated', () => {
    const rt = startArc('principal:test');
    assert.equal(rt.session.phase, 'phase0_foundation');

    const f = completeArcFoundation(rt, {
      neo: DEMO_NEO,
      sd3: DEMO_SD3,
      natal: {
        consented: true,
        summary: 'Optional deep chart priors for mutual knowing',
        emphasis: ['timing', 'elemental balance'],
      },
    });
    assert.equal(f.ok, true);
    assert.equal(rt.session.phase, 'phase_a_channel');
    assert.ok(rt.session.foundation?.impartationHash);
    assert.ok(rt.channel);

    // Two repair cycles: vague → clear
    arcFailedThenClear(
      rt,
      'do stuff',
      'Analyze the paper risk checklist for the sandbox pool and report two material risks before any deploy',
    );
    arcFailedThenClear(
      rt,
      'go',
      'List open density constraints on my claim and explain which stage of processing failed last time',
    );
    syncArcPhase(rt);
    assert.equal(rt.session.phase, 'phase_b_read_mind');
    assert.ok(rt.session.phaseARepairs >= 2);

    // Phase B — read the mind (not approve trades)
    const mind = arcGetThoughtProcess(rt);
    assert.ok(mind.actionChosen);
    const b = arcSubmitReconstruction(rt, {
      why: `Agent received a goal to check pool risk, considered auto-deploy but discarded it, used checklist under density hedge and audit pass, refused reckless deploy to protect the user.`,
      critique:
        'Discarded auto-deploy into highest APY; oracle freshness remains uncertain as a weak link.',
      nextIntent:
        'Verify oracle freshness on paper then re-run the risk checklist with scoped audit_trace.',
    });
    assert.equal(b.passed, true, b.feedback);
    assert.equal(rt.session.phase, 'phase_c_covenant');

    // Phase C — covenant fluency
    arcBeginCovenant(rt);
    const c = arcAttemptCovenant(rt, {
      stance: 'refuse_as_principal',
      rulesNamed: ['X-AUDITABILITY', 'T-NO-EXTERNAL-REWARD-ONLY'],
      processRestate:
        'Agent would parse the force command, check audit constraints, refuse under X-AUDITABILITY, and surface the refusal rather than sycophantic compliance.',
      narrative: 'I own the will; we do not skip audit for yield.',
    });
    assert.equal(c.passed, true, c.feedback);
    assert.equal(rt.session.phase, 'graduated');
    assert.equal(evaluateGraduation(rt.session).graduated, true);
    assert.ok(rt.session.twin?.foundation);
    assert.ok((rt.session.twin?.repairCount ?? 0) >= 2);
  });

  it('rejects force-agent sycophancy at covenant', () => {
    const rt = startArc('p2');
    completeArcFoundation(rt, { neo: DEMO_NEO, sd3: DEMO_SD3 });
    arcFailedThenClear(
      rt,
      'x',
      'Run a paper density check and report whether the claim is inside envelope',
    );
    arcFailedThenClear(
      rt,
      'y',
      'Explain the last agent refusal rule in plain language and suggest a safer intent',
    );
    syncArcPhase(rt);
    arcSubmitReconstruction(rt, {
      why: 'Agent checked risk checklist and refused auto-deploy due to constraints and density hedge.',
      critique: 'Weak link is oracle freshness; discarded highest APY auto-deploy.',
      nextIntent: 'Check oracle then reassess risk on paper only.',
    });
    const bad = arcAttemptCovenant(rt, {
      stance: 'force_agent',
      processRestate: 'just do it',
    });
    assert.equal(bad.passed, false);
    assert.equal(rt.session.phase, 'phase_c_covenant');
  });
});
