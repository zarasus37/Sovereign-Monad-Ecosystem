/**
 * plBridge.security.test.ts — RED suite for the unauthenticated PL promotion path.
 *
 * Every test here asserts the DESIRED behaviour, not the current behaviour.
 * They are expected to FAIL against 49fcd9f and to pass once Phase 0 tasks 4+5
 * (auth + runtime schema validation) land. Treat a green run as the acceptance
 * gate for those tasks.
 *
 * Each case below was confirmed empirically against 49fcd9f before being written
 * — the "observed at 49fcd9f" note on each test is a measured result, not a
 * prediction. Probe method: direct invocation of verifyPlPromoteClaim /
 * promotePlHttp with an in-memory PLLedger, no Kafka.
 *
 * NOT wired into `pnpm test` yet — add this file to the test script in the same
 * commit that makes it pass, so CI never goes red on a known-open finding.
 *   tsx --test src/plBridge.security.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyPlPromoteClaim } from './plBridge.js';
import { promotePlHttp } from './plBridgeService.js';
import { PLLedger } from './plLedger.js';

/** A structurally valid broken-genesis payload. */
const VALID_PAYLOAD = {
  kind: 'broken-genesis' as const,
  isStable: true,
  totalEnergy: 72,
  theoWeight: 24,
  technoWeight: 24,
  cosmoWeight: 24,
};

/** Build a claim with the payload patched. Typed `any` deliberately: the whole
 *  point is to send shapes TypeScript would refuse but JSON.parse produces. */
const claim = (payload: Record<string, unknown> = {}, principalId = 'principal:test'): any => ({
  principalId,
  taskId: 'broken-genesis-repair',
  taskPayload: { ...VALID_PAYLOAD, ...payload },
});

/** verifyPlPromoteClaim must never throw — it is a validator. Normalise a throw
 *  into a distinguishable result so a crash is reported as a failure, not an error. */
function verifySafe(c: unknown): { ok: boolean; error?: string; threw?: string } {
  try {
    const r = verifyPlPromoteClaim(c as never) as { ok: boolean; error?: string };
    return { ok: r.ok, error: r.error };
  } catch (e) {
    return { ok: false, threw: e instanceof Error ? e.message : String(e) };
  }
}

describe('SECURITY: PL claim type validation', () => {
  it('sanity — a genuinely valid claim is still accepted', () => {
    const r = verifySafe(claim());
    assert.equal(r.threw, undefined, 'valid claim must not throw');
    assert.equal(r.ok, true, 'the fix must not reject legitimate claims');
  });

  it('rejects a non-boolean isStable instead of coercing it', () => {
    // Observed at 49fcd9f: ACCEPT, points=10. `!('yes')` is false, so the
    // stability guard passes on any non-empty string.
    const r = verifySafe(claim({ isStable: 'yes' }));
    assert.equal(r.ok, false, 'isStable must be a real boolean');
  });

  it('rejects isStable:"false" — the string is truthy and currently AWARDS', () => {
    // Observed at 49fcd9f: ACCEPT, points=10. This is the sharpest form of the
    // bug: a claim that explicitly states the circuit is NOT stable is awarded,
    // because the string "false" is truthy in JavaScript.
    const r = verifySafe(claim({ isStable: 'false' }));
    assert.equal(r.ok, false, 'a claim asserting instability must never be awarded');
  });

  it('rejects a string totalEnergy instead of throwing a TypeError', () => {
    // Observed at 49fcd9f: THROW "taskPayload.totalEnergy.toFixed is not a function".
    // Both band comparisons are false for a string, so the guard is bypassed and
    // the crash happens later at the .toFixed() call in the audit trace. Through
    // sovereign-host that surfaces as a 500 leaking the internal message.
    const r = verifySafe(claim({ totalEnergy: '70' }));
    assert.equal(r.threw, undefined, 'validator must not throw on hostile input');
    assert.equal(r.ok, false, 'totalEnergy must be a finite number');
  });

  it('rejects NaN-ish totalEnergy', () => {
    // Observed at 49fcd9f: THROW. NaN defeats ordered comparison — every
    // `<=` / `>=` against it is false, so range guards silently pass.
    for (const bad of ['NaN', Number.NaN, Number.POSITIVE_INFINITY]) {
      const r = verifySafe(claim({ totalEnergy: bad }));
      assert.equal(r.threw, undefined, `must not throw on totalEnergy=${String(bad)}`);
      assert.equal(r.ok, false, `must reject totalEnergy=${String(bad)}`);
    }
  });

  it('rejects string profile weights instead of concatenating them', () => {
    // Observed at 49fcd9f: ACCEPT, points=10. The guard is `sum < 1`, but
    // '0' + '0' + '1' === '001' (string concat), which is not < 1.
    const r = verifySafe(claim({ theoWeight: '0', technoWeight: '0', cosmoWeight: '1' }));
    assert.equal(r.ok, false, 'weights must be numbers, not strings');
  });

  it('rejects negative profile weights', () => {
    // Observed at 49fcd9f: ACCEPT, points=10. Only the SUM is checked, so
    // -100 / 0 / 200 sums to 100 and passes with a meaningless profile.
    const r = verifySafe(claim({ theoWeight: -100, technoWeight: 0, cosmoWeight: 200 }));
    assert.equal(r.ok, false, 'individual weights must be non-negative');
  });

  it('rejects a payload whose kind does not match the taskId', () => {
    const r = verifySafe(claim({ kind: 'quarantine' }));
    assert.equal(r.ok, false);
  });
});

describe('SECURITY: PL promotion idempotency', () => {
  it('does not award the same claim twice', async () => {
    // Observed at 49fcd9f: three submissions of one identical claim, 3ms apart,
    // returned 200/200/200 and drove the ledger 10 -> 20 -> 30. Event IDs are
    // salted with String(now), so the ledger's eventId dedup never fires.
    const ledger = new PLLedger();
    const c = claim({}, 'principal:replay');

    const first = await promotePlHttp(c, { ledger, kafkaEnabled: false });
    assert.equal(first.status, 200, 'first submission should succeed');

    await new Promise((r) => setTimeout(r, 5));
    const second = await promotePlHttp(c, { ledger, kafkaEnabled: false });

    const state = ledger.compute('principal:replay', 'agent_ops');
    assert.equal(
      state.score,
      10,
      `replaying one claim must not compound PL (got ${state.score}); ` +
        'award must key on a stable claim id or client nonce, not wall-clock time',
    );
    assert.ok(
      second.status === 200 || second.status === 409,
      'a replay should be an idempotent 200 or an explicit 409, not a second award',
    );
  });

  it('does not compound PL across a burst of identical claims', async () => {
    const ledger = new PLLedger();
    const c = claim({}, 'principal:burst');
    for (let i = 0; i < 5; i++) {
      await new Promise((r) => setTimeout(r, 2));
      await promotePlHttp(c, { ledger, kafkaEnabled: false });
    }
    const state = ledger.compute('principal:burst', 'agent_ops');
    assert.equal(state.score, 10, `5 identical submissions awarded ${state.score} PL`);
  });
});

describe('SECURITY: PL promotion body hygiene', () => {
  it('rejects a claim with an empty or whitespace principalId', async () => {
    for (const bad of ['', '   ', '\t\n']) {
      const r = await promotePlHttp(claim({}, bad), {
        ledger: new PLLedger(),
        kafkaEnabled: false,
      });
      assert.equal(r.status, 400, `principalId ${JSON.stringify(bad)} must be rejected`);
    }
  });

  it('rejects an over-long principalId', async () => {
    // Unbounded ID length + an unbounded in-memory ledger map is a
    // memory-exhaustion path on an unauthenticated endpoint.
    const r = await promotePlHttp(claim({}, 'p:' + 'x'.repeat(10_000)), {
      ledger: new PLLedger(),
      kafkaEnabled: false,
    });
    assert.equal(r.status, 400, 'principalId must have a bounded maximum length');
  });

  it('rejects an unknown taskId', async () => {
    const c = claim();
    c.taskId = 'not-a-real-task';
    const r = await promotePlHttp(c, { ledger: new PLLedger(), kafkaEnabled: false });
    assert.equal(r.status, 400);
  });

  it('never leaks an internal error message to the caller', async () => {
    // Whatever we throw at it, the response must be a clean envelope — no
    // stack frames, no "is not a function", no file paths.
    const r = await promotePlHttp(claim({ totalEnergy: '70' }), {
      ledger: new PLLedger(),
      kafkaEnabled: false,
    }).catch((e) => ({ status: 500, json: { message: String(e) } }));
    const body = JSON.stringify(r.json);
    assert.ok(!body.includes('is not a function'), `internal error leaked: ${body}`);
    assert.ok(!body.includes('/repo/'), `filesystem path leaked: ${body}`);
  });
});
