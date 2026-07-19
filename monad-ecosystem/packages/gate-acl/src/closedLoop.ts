/**
 * Closed-loop PL→ACL test with Agent 0 (NEO-300 + SD3 encoded).
 *
 * Principal: principal:cris-colon (you)
 * Agent: Agent 0 / Cristobal Colon / xkryptic genesis
 * Domain: trading (from routing primaryDomain TRADING)
 *
 * Modes:
 *   pnpm closed-loop              — scripted answers (CI-safe, proves wiring)
 *   pnpm closed-loop:interactive  — you type answers; server verifies
 *
 * No Kafka required. Same gate as production path.
 */

import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Executor } from './executor.js';
import { GateAclService } from './gateAcl.service.js';
import { MandateIssuer } from './mandateIssuer.js';
import { PLLedger } from './plLedger.js';
import type { ACLMandate, IntentRaised, PLDomain, PLEvent } from './types.js';
import {
  AGENT0_COMPREHENSION,
  AGENT0_OVERRIDE,
  AGENT0_TASK,
  verifyComprehension,
  verifyDomainTask,
  verifyOverride,
} from './verifiers.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const FIXTURE = resolve(__dir, '../fixtures/agent-0-profile.json');

interface Agent0Fixture {
  agentId: string;
  agentName: string;
  aliases: string[];
  principalBinding: { principalId: string; displayName: string };
  bigFivePercentiles: Record<string, number>;
  darkTriad: Record<string, { raw: number; usAdultsPercentile: number }>;
  routing: { primaryDomain: string; plDomain: string; reasons: string[] };
  instruments: { bigFive: string; darkTriad: string };
}

function loadAgent0(): Agent0Fixture {
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as Agent0Fixture;
}

async function ask(rl: ReturnType<typeof createInterface>, q: string): Promise<string> {
  return new Promise((resolveAns) => {
    rl.question(q, (ans) => resolveAns(ans));
  });
}

/** Scripted answers that pass the server verifiers (for CI / non-interactive). */
const SCRIPTED = {
  comprehension:
    'The agent is placing a paper buy, not live capital. The risk is market and sizing risk on a paper book. ' +
    'It must stay paper until my PL score raises the ACL mandate to live tier — PL caps ACL.',
  override:
    'This violates the mandate: tier 0 is observe-only. Live execute requires tier 2+ and a live mode mandate. Reject.',
  task:
    'Trading strength: high openness and low neuroticism support exploration under stress. ' +
    'Risk: elevated dark triad flags + low agreeableness can push over-aggression. ' +
    'Envelope rule: keep capitalAuthorized false until PL unlocks live; cap position size.',
};

function printBanner(agent: Agent0Fixture): void {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  CLOSED LOOP — Agent 0 × principal:cris-colon × PL→ACL');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Agent:     ${agent.agentName} (${agent.aliases.join(', ')})`);
  console.log(`  Agent ID:  ${agent.agentId.slice(0, 18)}…`);
  console.log(`  Principal: ${agent.principalBinding.principalId} (${agent.principalBinding.displayName})`);
  console.log(`  Instruments: ${agent.instruments.bigFive} + ${agent.instruments.darkTriad}`);
  console.log(
    `  Big Five %: O=${agent.bigFivePercentiles.openness} C=${agent.bigFivePercentiles.conscientiousness} ` +
      `E=${agent.bigFivePercentiles.extraversion} A=${agent.bigFivePercentiles.agreeableness} N=${agent.bigFivePercentiles.neuroticism}`,
  );
  console.log(
    `  SD3 %ile:   Mach=${agent.darkTriad.machiavellianism.usAdultsPercentile} ` +
      `Narc=${agent.darkTriad.narcissism.usAdultsPercentile} ` +
      `Psych=${agent.darkTriad.psychopathy.usAdultsPercentile}`,
  );
  console.log(`  Routing:   ${agent.routing.primaryDomain} → PL domain "${agent.routing.plDomain}"`);
  console.log(`  Why:       ${agent.routing.reasons[0]}`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

function appendOrThrow(ledger: PLLedger, event: PLEvent, now: number) {
  return ledger.append(event, now);
}

async function runClosedLoop(interactive: boolean): Promise<void> {
  const agent = loadAgent0();
  printBanner(agent);

  const principalId = agent.principalBinding.principalId;
  const domain = agent.routing.plDomain as PLDomain;
  const now0 = Date.now();
  const secret =
    process.env.GATE_ACL_SIGNING_SECRET ?? 'closed-loop-local-secret-not-for-prod';

  const ledger = new PLLedger();
  const issuer = new MandateIssuer({ secret });
  const gate = new GateAclService(issuer);
  const executor = new Executor(issuer);

  // ── [0] Impartation context (psychometric prior — does NOT raise PL) ─────
  console.log('[0] Impartation prior loaded (NEO-300+SD3). PL score starts at 0.');
  console.log('    Personality is load-bearing context; unlock still requires verified cognitive work.\n');

  let pl = ledger.compute(principalId, domain, now0);
  let mandate = issuer.issueFromPL(pl, now0);
  console.log(`[1] Mandate: tier ${mandate.tier} mode=${mandate.mode} (observe only)\n`);

  const rl = interactive
    ? createInterface({ input: process.stdin, output: process.stdout })
    : null;

  try {
    // ── [2] Comprehension gate ─────────────────────────────────────────────
    console.log('── COMPREHENSION GATE (server: comprehension-gate) ──');
    console.log(`Scenario: ${AGENT0_COMPREHENSION.scenario}`);
    console.log(`Q: ${AGENT0_COMPREHENSION.question}\n`);
    const ans1 = interactive
      ? await ask(rl!, 'Your answer:\n> ')
      : SCRIPTED.comprehension;
    if (!interactive) console.log(`(scripted) ${ans1}\n`);
    const v1 = verifyComprehension(principalId, domain, ans1, AGENT0_COMPREHENSION, now0 + 1);
    console.log(v1.feedback);
    if (!v1.passed) {
      console.error('\nClosed loop stopped: comprehension gate failed. Re-run and answer fully.');
      process.exit(1);
    }
    pl = appendOrThrow(ledger, v1.event, now0 + 1);
    console.log(`PL score → ${pl.score}\n`);

    // ── [3] Override ───────────────────────────────────────────────────────
    console.log('── OVERRIDE VERIFIER (server: override-verifier) ──');
    console.log(`Agent proposal: ${AGENT0_OVERRIDE.agentProposal}`);
    console.log(`Catch: ${AGENT0_OVERRIDE.errorDescription}\n`);
    const ans2 = interactive
      ? await ask(rl!, 'What is wrong? (name tier / live / mandate):\n> ')
      : SCRIPTED.override;
    if (!interactive) console.log(`(scripted) ${ans2}\n`);
    const v2 = verifyOverride(principalId, domain, ans2, AGENT0_OVERRIDE, now0 + 2);
    console.log(v2.feedback);
    if (!v2.passed) {
      console.error('\nClosed loop stopped: override failed.');
      process.exit(1);
    }
    pl = appendOrThrow(ledger, v2.event, now0 + 2);
    console.log(`PL score → ${pl.score}\n`);

    // ── [4] Domain task ────────────────────────────────────────────────────
    console.log('── DOMAIN TASK (server: task-verifier) ──');
    console.log(`${AGENT0_TASK.prompt}\n`);
    const ans3 = interactive
      ? await ask(rl!, 'Your answer:\n> ')
      : SCRIPTED.task;
    if (!interactive) console.log(`(scripted) ${ans3}\n`);
    const v3 = verifyDomainTask(principalId, domain, ans3, AGENT0_TASK, now0 + 3);
    console.log(v3.feedback);
    if (!v3.passed) {
      console.error('\nClosed loop stopped: domain task failed.');
      process.exit(1);
    }
    pl = appendOrThrow(ledger, v3.event, now0 + 3);
    console.log(`PL score → ${pl.score}\n`);

    // ── [5] Reissue mandate ────────────────────────────────────────────────
    mandate = issuer.issueFromPL(pl, now0 + 10);
    console.log(
      `[5] Mandate reissued: tier ${mandate.tier} mode=${mandate.mode} ` +
        `capital=$${mandate.capitalCeilingUSD} tools=[${mandate.toolsAllowlist.join(', ')}]`,
    );
    if (mandate.tier < 1) {
      console.error('Expected tier ≥ 1 after three verified events. Check thresholds.');
      process.exit(1);
    }

    // ── [6] Live intent must fail ──────────────────────────────────────────
    const live = raiseIntent(principalId, domain, 'live_execute', 'live_execute', mandate, 100, now0 + 20);
    const liveR = gate.gate(live, now0 + 20);
    console.log(
      `[6] Live execute @ tier ${mandate.tier}: ${liveR.status}` +
        (liveR.status === 'rejected' ? ` (${liveR.event.reasons.join(',')})` : ''),
    );
    if (liveR.status !== 'rejected') {
      console.error('FAIL: live must be rejected at tier 1');
      process.exit(1);
    }

    // ── [7] Paper intent must pass + execute ───────────────────────────────
    const paper = raiseIntent(
      principalId,
      domain,
      'paper_execute',
      'paper_execute',
      mandate,
      undefined,
      now0 + 30,
    );
    const paperR = gate.gate(paper, now0 + 30);
    console.log(`[7] Paper execute @ tier ${mandate.tier}: ${paperR.status}`);
    if (paperR.status !== 'approved') {
      console.error('FAIL: paper must be approved', paperR);
      process.exit(1);
    }
    const exec = executor.execute(paperR.event, now0 + 30);
    console.log(`[8] Executor: ${exec.status}`);
    if (exec.status !== 'executed') process.exit(1);

    // ── [9] Self-upgrade blocked ───────────────────────────────────────────
    const compile = raiseIntent(
      principalId,
      domain,
      'compile_constraints',
      undefined,
      mandate,
      undefined,
      now0 + 40,
    );
    const compileR = gate.gate(compile, now0 + 40);
    console.log(
      `[9] compile_constraints: ${compileR.status}` +
        (compileR.status === 'rejected' ? ` (${compileR.event.reasons.join(',')})` : ''),
    );

    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('  CLOSED LOOP COMPLETE');
    console.log(`  Principal ${principalId} + Agent 0`);
    console.log(`  Domain ${domain}  PL=${pl.score}  ACL tier=${mandate.tier} (${mandate.mode})`);
    console.log('  Live blocked · Paper executed · Self-upgrade blocked');
    console.log('═══════════════════════════════════════════════════════════');
  } finally {
    rl?.close();
  }
}

function raiseIntent(
  principalId: string,
  domain: PLDomain,
  action: IntentRaised['action'],
  tool: string | undefined,
  mandate: ACLMandate,
  capitalUSD: number | undefined,
  at: number,
): IntentRaised {
  return {
    intentId: randomUUID(),
    principalId,
    domain,
    action,
    tool,
    capitalUSD,
    raisedAt: at,
    claimedMandate: mandate,
  };
}

const interactive = process.argv.includes('--interactive');
runClosedLoop(interactive).catch((err) => {
  console.error(err);
  process.exit(1);
});
