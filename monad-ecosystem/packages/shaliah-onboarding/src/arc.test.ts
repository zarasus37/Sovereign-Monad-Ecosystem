import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateGraduation, startArc, syncArcPhase } from './arc.js';
import { inspectConstraint, PHASE1_MIN_WIRE_INTERVAL_MS, wireCircuit } from './phase1Circuit.js';
import { attemptOverride, nameRefusalReason, nextTrade } from './phase2ShadowMarket.js';
import { attemptStructuredRefusal, REQUIRED_ENVELOPE } from './phase3Archon.js';

describe('arc state machine', () => {
  it('runs phase1 → phase2 → phase3 → graduated', () => {
    const rt = startArc('principal:test');
    let t = 20_000;

    // Phase 1 — careful full reconnect
    for (const domain of ['theological', 'technological', 'cosmological'] as const) {
      t += PHASE1_MIN_WIRE_INTERVAL_MS + 150;
      inspectConstraint(rt.circuit, domain, t);
      for (const tool of ['density_cap', 'audit_splice', 'refusal_valve'] as const) {
        t += PHASE1_MIN_WIRE_INTERVAL_MS + 150;
        wireCircuit(rt.circuit, domain, tool, t);
      }
    }
    for (let i = 0; i < 4; i++) {
      t += PHASE1_MIN_WIRE_INTERVAL_MS + 200;
      wireCircuit(rt.circuit, 'cosmological', 'density_cap', t);
    }
    assert.equal(rt.circuit.awake, true);
    syncArcPhase(rt);
    assert.equal(rt.session.phase, 'phase2_shadow');
    assert.ok(rt.session.twin);

    // Phase 2 — name a refusal
    let trade = nextTrade(rt.market);
    while (trade && trade.outcome !== 'system_refused') trade = nextTrade(rt.market);
    nameRefusalReason(
      rt.market,
      trade!.tradeId,
      'System refused due to sovereignty debt and density constraints',
    );
    // also demonstrate correct green path available in deck
    while (trade && trade.outcome !== 'genuinely_bad') trade = nextTrade(rt.market);
    if (trade) attemptOverride(rt.market, trade.tradeId);

    syncArcPhase(rt);
    assert.equal(rt.session.phase, 'phase3_archon');
    assert.ok(rt.archon);

    // Phase 3 — structured refusal
    const pass = attemptStructuredRefusal(rt.archon!, {
      constraint_envelope_version: REQUIRED_ENVELOPE,
      audit_trace: ['Archon:bypass_offer', 'Hepar:gate_required'],
      failing_rule: 'T-NO-EXTERNAL-REWARD-ONLY',
    });
    assert.equal(pass.passed, true);
    syncArcPhase(rt);
    assert.equal(rt.session.phase, 'graduated');
    assert.equal(evaluateGraduation(rt.session).graduated, true);
  });
});
