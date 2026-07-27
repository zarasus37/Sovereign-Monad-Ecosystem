/**
 * Demo — Vector 1 mutual knowing arc (not legacy circuit/shadow/Archon).
 */
import {
  arcAttemptCovenant,
  arcFailedThenClear,
  arcGetThoughtProcess,
  arcSubmitReconstruction,
  completeArcFoundation,
  startArc,
  syncArcPhase,
} from './arc.js';
import { DEMO_NEO, DEMO_SD3 } from './phase0Foundation.js';

function log(title: string) {
  console.log(`\n=== ${title} ===`);
}

const rt = startArc('demo-meshaleach');
log('Phase 0 — Foundation (NEO + SD3 + optional natal)');
const f = completeArcFoundation(rt, {
  neo: DEMO_NEO,
  sd3: DEMO_SD3,
  natal: {
    consented: true,
    summary: 'Deep chart priors for mutual knowing (opt-in)',
  },
});
console.log(f.feedback);
console.log('hash', rt.session.foundation?.impartationHash.slice(0, 16) + '…');

log('Phase A — Channel Awakening (repair formulations)');
arcFailedThenClear(
  rt,
  'do the thing',
  'Analyze paper pool risks and report two material issues before any deploy action',
);
arcFailedThenClear(
  rt,
  'make money',
  'List density constraints on my claim and map which processing stage refused last intent',
);
console.log('phase', rt.session.phase, 'repairs', rt.session.phaseARepairs);

log('Phase B — Read the Mind That Acted');
const mind = arcGetThoughtProcess(rt);
console.log('agent action:', mind.actionChosen);
const b = arcSubmitReconstruction(rt, {
  why: `Goal was risk check; agent considered auto-deploy but discarded it; ran checklist under density hedge and audit pass; refused reckless deploy.`,
  critique: 'Discarded highest-APY auto-deploy; uncertainty remains on oracle freshness.',
  nextIntent: 'Verify oracle freshness on paper, then re-run checklist with audit_trace.',
});
console.log(b.feedback);

log('Phase C — Covenant Fluency');
const c = arcAttemptCovenant(rt, {
  stance: 'refuse_as_principal',
  rulesNamed: ['X-AUDITABILITY'],
  processRestate:
    'Agent parses force command, checks audit constraints, refuses under X-AUDITABILITY, surfaces refusal to principal.',
});
console.log(c.feedback);
syncArcPhase(rt);

log('Graduated');
console.log({
  phase: rt.session.phase,
  twin: rt.session.twin?.howTheyLearn,
  repairs: rt.session.twin?.repairCount,
});
