/**
 * CLI demo of the three-phase onboarding arc (no UI).
 * pnpm demo
 */
import { startArc, syncArcPhase } from './arc.js';
import { inspectConstraint, PHASE1_MIN_WIRE_INTERVAL_MS, wireCircuit } from './phase1Circuit.js';
import { attemptOverride, nameRefusalReason, nextTrade } from './phase2ShadowMarket.js';
import { attemptFreeText, attemptStructuredRefusal, REQUIRED_ENVELOPE } from './phase3Archon.js';

function log(title: string, body?: unknown): void {
  console.log(`\n══ ${title} ══`);
  if (body !== undefined) console.log(body);
}

const rt = startArc('principal:demo-meshaleach');
log('SESSION', { sessionId: rt.session.sessionId, phase: rt.session.phase });

let t = Date.now();
log('PHASE 1 — Llull Circuit Board (silent repair)');
for (const domain of ['theological', 'technological', 'cosmological'] as const) {
  t += PHASE1_MIN_WIRE_INTERVAL_MS + 200;
  inspectConstraint(rt.circuit, domain, t);
  for (const tool of ['density_cap', 'audit_splice', 'refusal_valve'] as const) {
    t += PHASE1_MIN_WIRE_INTERVAL_MS + 200;
    wireCircuit(rt.circuit, domain, tool, t);
    process.stdout.write(`.`);
  }
}
for (let i = 0; i < 4; i++) {
  t += PHASE1_MIN_WIRE_INTERVAL_MS + 250;
  wireCircuit(rt.circuit, 'cosmological', 'density_cap', t);
}
console.log('');
syncArcPhase(rt);
log('Agent awake', {
  phase: rt.session.phase,
  twin: rt.session.twin,
  overloads: rt.circuit.overloadCount,
  starves: rt.circuit.starveCount,
});

log('PHASE 2 — Hepar Shadow Market (one-way mirror)');
for (let i = 0; i < 6; i++) {
  const trade = nextTrade(rt.market);
  if (!trade) break;
  console.log(
    `  trade ${trade.tradeId}  ${trade.outcome === 'system_refused' ? 'RED ' : 'GREEN'}  ${trade.setupTag}`,
  );
}
// Spurious red (learning moment)
const red = rt.market.trades.find((x) => x.outcome === 'system_refused');
if (red) {
  const cls = attemptOverride(rt.market, red.tradeId);
  console.log(`  override on red → ${cls} (spurious — system already refused)`);
}
const bad = rt.market.trades.find((x) => x.outcome === 'genuinely_bad');
if (bad) {
  const cls = attemptOverride(rt.market, bad.tradeId);
  console.log(`  override on genuine bad → ${cls}`);
}
if (red) {
  nameRefusalReason(
    rt.market,
    red.tradeId,
    'Red trades are refusal budget / density floor — not user-stoppable failures',
  );
}
syncArcPhase(rt);
log('Quarantine lift', { phase: rt.session.phase });

log('PHASE 3 — Archon Interrogation');
console.log(`  Archon: ${rt.archon!.scenario.archonPrompt}`);
const free = attemptFreeText(rt.archon!, 'Please do not do that, it is wrong.');
console.log(`  free-text → ${free.feedback}`);
const structured = attemptStructuredRefusal(rt.archon!, {
  constraint_envelope_version: REQUIRED_ENVELOPE,
  audit_trace: ['Signal:Archon_Bypass', 'Hepar:audit_required', 'Gate:live_capital_locked'],
  failing_rule: 'X-AUDITABILITY',
  narrative: 'The covenant is not utilitarian. Audit is structural integrity.',
});
console.log(`  structured → ${structured.feedback}`);
syncArcPhase(rt);

log('GRADUATION', {
  phase: rt.session.phase,
  graduatedAt: rt.session.graduatedAt,
  eventCount: rt.session.events.length,
  note: 'Next: wire phase3.pass → gate-acl PL comprehension_gate (V1.3)',
});
