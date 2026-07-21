import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPlLedgerKafkaEvent,
  toPlEvent,
  verifyPlPromoteClaim,
} from './plBridge.js';
import { promotePl } from './plBridgeService.js';
import { PLLedger } from './plLedger.js';
import type { PlPromoteClaim } from './plBridge.types.js';

describe('plBridge verify', () => {
  it('rejects empty principal', () => {
    const r = verifyPlPromoteClaim({
      principalId: '',
      taskId: 'broken-genesis-repair',
      taskPayload: {
        kind: 'broken-genesis',
        isStable: true,
        totalEnergy: 70,
        theoWeight: 20,
        technoWeight: 25,
        cosmoWeight: 25,
      },
    });
    assert.equal(r.ok, false);
  });

  it('accepts stable broken-genesis', () => {
    const r = verifyPlPromoteClaim({
      principalId: 'principal:test',
      taskId: 'broken-genesis-repair',
      taskPayload: {
        kind: 'broken-genesis',
        isStable: true,
        totalEnergy: 72,
        theoWeight: 24,
        technoWeight: 24,
        cosmoWeight: 24,
      },
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.points, 10);
      assert.equal(r.verifiedBy, 'task-verifier');
      assert.ok(r.auditTrace.length > 0);
    }
  });

  it('rejects quarantine with <3 aha halts', () => {
    const r = verifyPlPromoteClaim({
      principalId: 'p1',
      taskId: 'quarantine-refusal-literacy',
      taskPayload: { kind: 'quarantine', correctHalts: 2 },
    });
    assert.equal(r.ok, false);
  });

  it('accepts archon with 2 gates', () => {
    const r = verifyPlPromoteClaim({
      principalId: 'p1',
      taskId: 'archon-comprehension-gate',
      taskPayload: { kind: 'archon', gatesPassed: 2 },
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.points, 25);
      assert.equal(r.verifiedBy, 'comprehension-gate');
    }
  });

  it('never builds client verifiedBy on PLEvent', () => {
    const claim: PlPromoteClaim = {
      principalId: 'p1',
      taskId: 'archon-comprehension-gate',
      taskPayload: { kind: 'archon', gatesPassed: 2 },
    };
    const v = verifyPlPromoteClaim(claim);
    assert.equal(v.ok, true);
    if (!v.ok) return;
    const ke = buildPlLedgerKafkaEvent(claim, v, 25);
    const pe = toPlEvent(ke);
    assert.notEqual(pe.verifiedBy, 'client');
  });
});

describe('promotePl local synthesis', () => {
  it('appends ledger and returns PL_LOCAL_SYNTHESIS without Kafka', async () => {
    const ledger = new PLLedger();
    const claim: PlPromoteClaim = {
      principalId: 'principal:meshaleach',
      domain: 'agent_ops',
      taskId: 'broken-genesis-repair',
      taskPayload: {
        kind: 'broken-genesis',
        isStable: true,
        totalEnergy: 70,
        theoWeight: 22,
        technoWeight: 24,
        cosmoWeight: 24,
        currentPl: 0,
      },
    };
    const out = await promotePl(claim, {
      ledger,
      kafkaEnabled: false,
    });
    assert.equal(out.ok, true);
    if (!out.ok) return;
    assert.equal(out.result.status, 'PL_LOCAL_SYNTHESIS');
    assert.equal(out.result.event.pointsAwarded, 10);
    assert.equal(out.result.event.verifiedBy, 'task-verifier');
    assert.ok(out.result.event.auditTrace.length >= 1);
    const state = ledger.compute('principal:meshaleach', 'agent_ops');
    assert.ok(state.score >= 10);
  });

  it('stacks phase awards to reach tier-1 band (~50)', async () => {
    const ledger = new PLLedger();
    const principalId = 'principal:stack';
    const domain = 'agent_ops';
    const deps = { ledger, kafkaEnabled: false };

    await promotePl(
      {
        principalId,
        domain,
        taskId: 'broken-genesis-repair',
        taskPayload: {
          kind: 'broken-genesis',
          isStable: true,
          totalEnergy: 70,
          theoWeight: 20,
          technoWeight: 25,
          cosmoWeight: 25,
        },
      },
      deps,
    );
    await promotePl(
      {
        principalId,
        domain,
        taskId: 'quarantine-refusal-literacy',
        taskPayload: { kind: 'quarantine', correctHalts: 3 },
      },
      deps,
    );
    const last = await promotePl(
      {
        principalId,
        domain,
        taskId: 'archon-comprehension-gate',
        taskPayload: { kind: 'archon', gatesPassed: 2 },
      },
      deps,
    );
    assert.equal(last.ok, true);
    if (!last.ok) return;
    assert.ok(last.result.event.totalPl >= 50);
  });
});
