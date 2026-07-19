/**
 * Node built-in test runner — full minimal slice + TOCTOU + client rejection.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { Executor } from './executor.js';
import { GateAclService } from './gateAcl.service.js';
import { MandateIssuer, MANDATE_TTL_MS } from './mandateIssuer.js';
import { PLLedger, scoreToTier } from './plLedger.js';
import type { IntentRaised, PLDomain } from './types.js';

const SECRET = 'test-signing-secret';
const PRINCIPAL = 'p-test';
const DOMAIN: PLDomain = 'defi_execution';

function seedPL(ledger: PLLedger, now: number) {
  ledger.append(
    {
      kind: 'comprehension_gate',
      eventId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      passed: true,
      gateId: 'g1',
      verifiedBy: 'comprehension-gate',
      at: now,
    },
    now,
  );
  ledger.append(
    {
      kind: 'valid_override',
      eventId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      agentErrorId: 'e1',
      validated: true,
      verifiedBy: 'override-verifier',
      at: now + 1,
    },
    now + 1,
  );
  return ledger.append(
    {
      kind: 'domain_task',
      eventId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      taskId: 't1',
      outcome: 'passed',
      verifiedBy: 'task-verifier',
      at: now + 2,
    },
    now + 2,
  );
}

describe('gate-acl vertical slice', () => {
  it('rejects client-emitted PL events', () => {
    const ledger = new PLLedger();
    assert.throws(() =>
      ledger.append({
        kind: 'comprehension_gate',
        eventId: 'x',
        principalId: PRINCIPAL,
        domain: DOMAIN,
        passed: true,
        gateId: 'g',
        verifiedBy: 'client',
        at: Date.now(),
      }),
    );
  });

  it('runs observe → earn PL → paper pass → live reject → execute', () => {
    const now = Date.now();
    const ledger = new PLLedger();
    const issuer = new MandateIssuer({ secret: SECRET });
    const gate = new GateAclService(issuer);
    const executor = new Executor(issuer);

    let pl = ledger.compute(PRINCIPAL, DOMAIN, now);
    let mandate = issuer.issueFromPL(pl, now);
    assert.equal(mandate.tier, 0);
    assert.equal(mandate.mode, 'observe');
    assert.equal(pl.score, 0);

    pl = seedPL(ledger, now);
    assert.ok(pl.score >= 25, `expected score >= 25, got ${pl.score}`);
    assert.equal(scoreToTier(pl.score), 1);

    mandate = issuer.issueFromPL(pl, now + 10);
    assert.equal(mandate.tier, 1);
    assert.equal(mandate.mode, 'paper');

    const live: IntentRaised = {
      intentId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      action: 'live_execute',
      tool: 'live_execute',
      capitalUSD: 50,
      raisedAt: now + 20,
      claimedMandate: mandate,
    };
    const liveResult = gate.gate(live, now + 20);
    assert.equal(liveResult.status, 'rejected');
    if (liveResult.status === 'rejected') {
      assert.ok(liveResult.event.reasons.includes('tier_insufficient'));
    }

    const paper: IntentRaised = {
      intentId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      action: 'paper_execute',
      tool: 'paper_execute',
      raisedAt: now + 30,
      claimedMandate: mandate,
    };
    const paperResult = gate.gate(paper, now + 30);
    assert.equal(paperResult.status, 'approved');
    if (paperResult.status === 'approved') {
      const exec = executor.execute(paperResult.event, now + 30);
      assert.equal(exec.status, 'executed');
    }
  });

  it('blocks compile_constraints below tier 3', () => {
    const now = Date.now();
    const ledger = new PLLedger();
    const issuer = new MandateIssuer({ secret: SECRET });
    const gate = new GateAclService(issuer);
    const pl = seedPL(ledger, now);
    const mandate = issuer.issueFromPL(pl, now);
    assert.equal(mandate.tier, 1);

    const intent: IntentRaised = {
      intentId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      action: 'compile_constraints',
      raisedAt: now,
      claimedMandate: mandate,
    };
    const result = gate.gate(intent, now);
    assert.equal(result.status, 'rejected');
    if (result.status === 'rejected') {
      assert.ok(
        result.event.reasons.includes('tier_insufficient_for_compile_constraints'),
      );
    }
  });

  it('refuses execution when mandate expires (TOCTOU close)', () => {
    const now = Date.now();
    const ledger = new PLLedger();
    const issuer = new MandateIssuer({ secret: SECRET, ttlMs: MANDATE_TTL_MS });
    const gate = new GateAclService(issuer);
    const executor = new Executor(issuer);
    const pl = seedPL(ledger, now);
    const mandate = issuer.issueFromPL(pl, now);

    const paper: IntentRaised = {
      intentId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      action: 'paper_execute',
      tool: 'paper_execute',
      raisedAt: now,
      claimedMandate: mandate,
    };
    const approved = gate.gate(paper, now);
    assert.equal(approved.status, 'approved');
    if (approved.status !== 'approved') return;

    const afterExpiry = mandate.expiresAt + 1;
    const exec = executor.execute(approved.event, afterExpiry);
    assert.equal(exec.status, 'refused');
    if (exec.status === 'refused') {
      assert.ok(exec.reasons.some((r) => r.includes('mandate_expired')));
    }
  });

  it('isolates domains', () => {
    const now = Date.now();
    const ledger = new PLLedger();
    seedPL(ledger, now);
    const defi = ledger.compute(PRINCIPAL, 'defi_execution', now);
    const ops = ledger.compute(PRINCIPAL, 'agent_ops', now);
    assert.ok(defi.score >= 25);
    assert.equal(ops.score, 0);
  });
});
