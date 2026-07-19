/**
 * Minimal vertical slice — runnable in-memory demo (no Kafka).
 *
 * [1] Initial mandate tier 0 observe
 * [2] PL after gate + override + task
 * [3] Reissued mandate tier 1 paper
 * [4] Live trade at tier 1 → rejected
 * [5] Paper trade at tier 1 → approved
 * [6] Executor result: executed
 */

import { randomUUID } from 'node:crypto';
import { InMemoryBus } from './bus.js';
import { Executor } from './executor.js';
import { GateAclService } from './gateAcl.service.js';
import { MandateIssuer } from './mandateIssuer.js';
import { PLLedger } from './plLedger.js';
import { TOPICS, type IntentRaised, type PLDomain } from './types.js';

const PRINCIPAL = 'principal-demo-1';
const DOMAIN: PLDomain = 'defi_execution';

function main(): void {
  const now0 = Date.now();
  const ledger = new PLLedger();
  const issuer = new MandateIssuer({ secret: 'demo-secret-for-local-slice' });
  const gate = new GateAclService(issuer);
  const executor = new Executor(issuer);
  const bus = new InMemoryBus();

  // [1] Initial mandate from empty PL
  let pl = ledger.compute(PRINCIPAL, DOMAIN, now0);
  let mandate = issuer.issueFromPL(pl, now0);
  bus.publish(TOPICS.MANDATE_REISSUED, mandate);
  console.log(
    `[1] Initial mandate: tier ${mandate.tier}, ${mandate.mode}, score=${pl.score}`,
  );

  // [2] Server-verified PL events only
  const t = now0 + 1000;
  pl = ledger.append(
    {
      kind: 'comprehension_gate',
      eventId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      passed: true,
      gateId: 'explain-back-next-trade',
      verifiedBy: 'comprehension-gate',
      at: t,
    },
    t,
  );
  pl = ledger.append(
    {
      kind: 'valid_override',
      eventId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      agentErrorId: 'err-bad-sizing',
      validated: true,
      verifiedBy: 'override-verifier',
      at: t + 1,
    },
    t + 1,
  );
  pl = ledger.append(
    {
      kind: 'domain_task',
      eventId: randomUUID(),
      principalId: PRINCIPAL,
      domain: DOMAIN,
      taskId: 'broken-genesis-repair',
      outcome: 'passed',
      verifiedBy: 'task-verifier',
      at: t + 2,
    },
    t + 2,
  );
  bus.publish(TOPICS.PL_STATE_UPDATED, pl);
  console.log(
    `[2] PL after gate + override + task: score=${pl.score}`,
  );

  // Client event must be rejected
  try {
    ledger.append(
      {
        kind: 'comprehension_gate',
        eventId: randomUUID(),
        principalId: PRINCIPAL,
        domain: DOMAIN,
        passed: true,
        gateId: 'cheat',
        verifiedBy: 'client',
        at: t + 3,
      },
      t + 3,
    );
    console.error('FAIL: client event should have been rejected');
    process.exit(1);
  } catch {
    console.log(`[2b] Client-emitted PL event correctly rejected`);
  }

  // [3] Reissue mandate from live PL
  mandate = issuer.issueFromPL(pl, t + 10);
  bus.publish(TOPICS.MANDATE_REISSUED, mandate);
  console.log(
    `[3] Reissued mandate: tier ${mandate.tier}, ${mandate.mode}, capital=$${mandate.capitalCeilingUSD}`,
  );

  // [4] Live trade at tier 1 → rejected
  const liveIntent: IntentRaised = {
    intentId: randomUUID(),
    principalId: PRINCIPAL,
    domain: DOMAIN,
    action: 'live_execute',
    tool: 'live_execute',
    capitalUSD: 100,
    raisedAt: t + 20,
    claimedMandate: mandate,
  };
  bus.publish(TOPICS.INTENT_RAISED, liveIntent);
  const liveGate = gate.gate(liveIntent, t + 20);
  if (liveGate.status === 'rejected') {
    bus.publish(TOPICS.EXECUTION_REJECTED, liveGate.event);
    console.log(
      `[4] Live trade at tier ${mandate.tier} → rejected (${liveGate.event.reasons.join(',')})`,
    );
  } else {
    console.error('FAIL: live trade should be rejected at tier 1');
    process.exit(1);
  }

  // [5] Paper trade at tier 1 → approved
  const paperIntent: IntentRaised = {
    intentId: randomUUID(),
    principalId: PRINCIPAL,
    domain: DOMAIN,
    action: 'paper_execute',
    tool: 'paper_execute',
    raisedAt: t + 30,
    claimedMandate: mandate,
  };
  bus.publish(TOPICS.INTENT_RAISED, paperIntent);
  const paperGate = gate.gate(paperIntent, t + 30);
  if (paperGate.status !== 'approved') {
    console.error('FAIL: paper trade should be approved', paperGate);
    process.exit(1);
  }
  bus.publish(TOPICS.EXECUTION_APPROVED, paperGate.event);
  console.log(`[5] Paper trade at tier ${mandate.tier} → approved`);

  // [6] Executor re-verifies at consume time
  const exec = executor.execute(paperGate.event, t + 30);
  console.log(`[6] Executor result: ${exec.status}`);
  if (exec.status !== 'executed') {
    process.exit(1);
  }

  // Self-upgrade blocked at tier 1
  const compileIntent: IntentRaised = {
    intentId: randomUUID(),
    principalId: PRINCIPAL,
    domain: DOMAIN,
    action: 'compile_constraints',
    raisedAt: t + 40,
    claimedMandate: mandate,
  };
  const compileGate = gate.gate(compileIntent, t + 40);
  if (
    compileGate.status !== 'rejected' ||
    !compileGate.event.reasons.includes('tier_insufficient_for_compile_constraints')
  ) {
    console.error('FAIL: compile_constraints should require tier 3', compileGate);
    process.exit(1);
  }
  console.log(`[7] compile_constraints at tier 1 → rejected (self-upgrade blocked)`);

  console.log('\nFull loop verified end-to-end.');
  console.log(`Bus log entries: ${bus.log.length}`);
}

main();
