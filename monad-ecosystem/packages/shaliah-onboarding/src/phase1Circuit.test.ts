import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createCircuit,
  inspectConstraint,
  PHASE1_MIN_WIRE_INTERVAL_MS,
  seedFromCircuit,
  wireCircuit,
} from './phase1Circuit.js';

describe('phase1Circuit', () => {
  it('overloads when wiring too fast at high energy', () => {
    const c = createCircuit('p1', 1_000);
    c.energy = 0.8;
    c.density = 0.5;
    wireCircuit(c, 'technological', 'constraint_link', 1_000);
    wireCircuit(c, 'theological', 'constraint_link', 1_000 + 50); // < min interval
    assert.ok(c.overloadCount >= 1);
    assert.ok(c.events.some((e) => e.kind === 'phase1.overload'));
  });

  it('stabilizes when all domains connected with healthy density', () => {
    const t0 = 10_000;
    const c = createCircuit('p1', t0);
    // Slow, inspected wires across three domains
    let t = t0;
    for (const domain of ['theological', 'technological', 'cosmological'] as const) {
      t += PHASE1_MIN_WIRE_INTERVAL_MS + 100;
      inspectConstraint(c, domain, t);
      t += 50;
      wireCircuit(c, domain, 'density_cap', t);
      t += PHASE1_MIN_WIRE_INTERVAL_MS + 100;
      wireCircuit(c, domain, 'audit_splice', t);
      t += PHASE1_MIN_WIRE_INTERVAL_MS + 100;
      wireCircuit(c, domain, 'refusal_valve', t);
    }
    // Extra careful ticks to raise stableTicks
    for (let i = 0; i < 5; i++) {
      t += PHASE1_MIN_WIRE_INTERVAL_MS + 200;
      wireCircuit(c, 'cosmological', 'density_cap', t);
    }
    assert.equal(c.awake, true);
    const seed = seedFromCircuit(c);
    assert.ok(seed.theoShare + seed.technoShare + seed.cosmoShare > 0.99);
    assert.ok(seed.reasoningExposure > 0);
  });
});
