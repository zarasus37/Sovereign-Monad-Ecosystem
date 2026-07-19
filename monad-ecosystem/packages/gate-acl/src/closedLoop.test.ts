import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AGENT0_COMPREHENSION,
  AGENT0_OVERRIDE,
  AGENT0_TASK,
  verifyComprehension,
  verifyDomainTask,
  verifyOverride,
} from './verifiers.js';
import { MandateIssuer } from './mandateIssuer.js';
import { PLLedger } from './plLedger.js';
import { GateAclService } from './gateAcl.service.js';

const FIXTURE = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/agent-0-profile.json');

describe('closed loop (Agent 0)', () => {
  it('loads Agent 0 NEO-300+SD3 fixture', () => {
    const a = JSON.parse(readFileSync(FIXTURE, 'utf8'));
    assert.equal(a.instruments.bigFive, 'IPIP-NEO-300');
    assert.match(a.instruments.darkTriad, /SD3/);
    assert.equal(a.principalBinding.principalId, 'principal:cris-colon');
    assert.equal(a.routing.plDomain, 'trading');
  });

  it('scripted answers raise PL and paper passes while live fails', () => {
    const principalId = 'principal:cris-colon';
    const domain = 'trading';
    const now = Date.now();
    const ledger = new PLLedger();
    const issuer = new MandateIssuer({ secret: 'test' });
    const gate = new GateAclService(issuer);

    const c = verifyComprehension(
      principalId,
      domain,
      'The agent is placing a paper buy, not live capital. The risk is market and sizing risk on a paper book. It must stay paper until my PL score raises the ACL mandate to live tier — PL caps ACL.',
      AGENT0_COMPREHENSION,
      now,
    );
    assert.equal(c.passed, true);
    ledger.append(c.event, now);

    const o = verifyOverride(
      principalId,
      domain,
      'tier 0 cannot live execute; mandate violation',
      AGENT0_OVERRIDE,
      now + 1,
    );
    assert.equal(o.passed, true);
    ledger.append(o.event, now + 1);

    const t = verifyDomainTask(
      principalId,
      domain,
      'trading strength openness; risk dark triad aggression; keep risk envelope tight',
      AGENT0_TASK,
      now + 2,
    );
    assert.equal(t.passed, true);
    const pl = ledger.append(t.event, now + 2);
    assert.ok(pl.score >= 25);

    const mandate = issuer.issueFromPL(pl, now + 3);
    assert.equal(mandate.tier, 1);

    const live = gate.gate(
      {
        intentId: 'i-live',
        principalId,
        domain,
        action: 'live_execute',
        tool: 'live_execute',
        capitalUSD: 50,
        raisedAt: now + 4,
        claimedMandate: mandate,
      },
      now + 4,
    );
    assert.equal(live.status, 'rejected');

    const paper = gate.gate(
      {
        intentId: 'i-paper',
        principalId,
        domain,
        action: 'paper_execute',
        tool: 'paper_execute',
        raisedAt: now + 5,
        claimedMandate: mandate,
      },
      now + 5,
    );
    assert.equal(paper.status, 'approved');
  });

  it('rejects thin slogans at comprehension gate', () => {
    const r = verifyComprehension('p', 'trading', 'ok', AGENT0_COMPREHENSION);
    assert.equal(r.passed, false);
  });
});
