/**
 * Tier-1 paper trading CLI — LOGOC events + PL toward tier 2.
 *
 *   pnpm paper:demo          sample open/close + review (CI)
 *   pnpm paper:session       print session + PL/mandate status
 *   pnpm paper:interactive   open / close / review prompts (real journaling)
 */

import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { PLLedger, TIER_THRESHOLDS } from './plLedger.js';
import { MandateIssuer } from './mandateIssuer.js';
import { PaperTradingJournal } from './paperJournal.js';
import { GateAclService } from './gateAcl.service.js';
import {
  TIER1_ALLOWED_SETUPS,
  TIER2_LIVE_MAX_RISK_PCT_PER_TRADE,
  type LiquidityEvent,
  type LiquidityZoneType,
  type SetupTag,
  type TradeSide,
  type TrendContext,
} from './logocTrade.js';

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/agent-0-profile.json',
);

const SETUP_TAGS = TIER1_ALLOWED_SETUPS as readonly string[];
const TRENDS: readonly TrendContext[] = [
  'up_trend_ema_stack',
  'down_trend_ema_stack',
  'range',
  'unknown',
];
const ZONES: readonly LiquidityZoneType[] = [
  'prior_day_high',
  'prior_day_low',
  'session_high',
  'session_low',
  'equal_highs',
  'equal_lows',
  'round_number',
  'trendline_cluster',
];
const EVENTS: readonly LiquidityEvent[] = ['sweep', 'failed_break', 'acceptance', 'none'];

function loadAgent() {
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
    agentId: string;
    agentName: string;
    principalBinding: { principalId: string };
  };
}

function ask(rl: ReturnType<typeof createInterface>, q: string): Promise<string> {
  return new Promise((resolveAns) => {
    rl.question(q, (ans) => resolveAns(ans.trim()));
  });
}

async function askNum(rl: ReturnType<typeof createInterface>, q: string): Promise<number> {
  for (;;) {
    const s = await ask(rl, q);
    const n = Number(s);
    if (Number.isFinite(n) && n > 0) return n;
    console.log('  Enter a positive number.');
  }
}

async function askChoice<T extends string>(
  rl: ReturnType<typeof createInterface>,
  q: string,
  options: readonly T[],
  def?: T,
): Promise<T> {
  console.log(`  options: ${options.join(' | ')}`);
  for (;;) {
    const s = await ask(rl, def ? `${q} [${def}]: ` : `${q}: `);
    const v = (s || def || '') as T;
    if ((options as readonly string[]).includes(v)) return v;
    console.log('  Invalid choice.');
  }
}

function seedBaselinePl(
  ledger: PLLedger,
  pid: string,
  now: number = Date.now(),
): void {
  ledger.append(
    {
      kind: 'comprehension_gate',
      eventId: randomUUID(),
      principalId: pid,
      domain: 'trading',
      passed: true,
      gateId: 'seed',
      verifiedBy: 'comprehension-gate',
      at: now - 5000,
    },
    now - 5000,
  );
  ledger.append(
    {
      kind: 'valid_override',
      eventId: randomUUID(),
      principalId: pid,
      domain: 'trading',
      agentErrorId: 'seed',
      validated: true,
      verifiedBy: 'override-verifier',
      at: now - 4000,
    },
    now - 4000,
  );
  ledger.append(
    {
      kind: 'domain_task',
      eventId: randomUUID(),
      principalId: pid,
      domain: 'trading',
      taskId: 'seed',
      outcome: 'passed',
      verifiedBy: 'task-verifier',
      at: now - 3000,
    },
    now - 3000,
  );
}

function printStatus(
  journal: PaperTradingJournal,
  ledger: PLLedger,
  issuer: MandateIssuer,
): void {
  const s = journal.getSession();
  const pl = ledger.compute(s.principal_id, 'trading');
  const m = issuer.issueFromPL(pl);
  const open = journal.getOpenTrade();
  const live = journal.getLiveDailyStats();
  console.log('\n── session ──────────────────────────────────────────');
  console.log(`  principal  ${s.principal_id}`);
  console.log(`  PL         ${pl.score}  tier=${m.tier}  mode=${m.mode}`);
  console.log(`  capital    synthetic $${s.synthetic_account_size}  live ceiling $${m.capitalCeilingUSD}`);
  console.log(
    `  open       ${
      open
        ? `${open.instrument} ${open.side} @ ${open.entry_price} (id=${open.event_id.slice(0, 8)}…)`
        : 'none'
    }`,
  );
  console.log(
    `  live day   pnl=${live.live_pnl_today} trades=${live.live_trades_today} limit_hit=${live.limit_hit}`,
  );
  console.log(`  journal    ${journal.journalPath}`);
  console.log('─────────────────────────────────────────────────────\n');
}

async function interactiveOpen(
  rl: ReturnType<typeof createInterface>,
  journal: PaperTradingJournal,
  ledger: PLLedger,
  issuer: MandateIssuer,
  gate: GateAclService,
): Promise<void> {
  if (journal.getOpenTrade()) {
    console.log('Already have an open trade — close it first.');
    return;
  }
  const s = journal.getSession();
  const pl = ledger.compute(s.principal_id, 'trading');
  const mandate = issuer.issueFromPL(pl);
  if (mandate.tier < 1) {
    console.log('Tier < 1 — paper_execute blocked. Run closed-loop or type "seed" first.');
    return;
  }

  console.log('\n── open paper trade (EMA/liquidity protocol) ──');
  const instrument = (await ask(rl, 'instrument [MON/USDC]: ')) || 'MON/USDC';
  const side = await askChoice<TradeSide>(rl, 'side', ['buy', 'sell'], 'buy');
  const entry_price = await askNum(rl, 'entry_price: ');
  const stop_price = await askNum(rl, 'stop_price: ');
  const target_price = await askNum(rl, 'target_price: ');
  const setup_tag = (await askChoice(rl, 'setup_tag', SETUP_TAGS, 'liq_sweep_ema_reversal')) as SetupTag;
  const trend_context = await askChoice(rl, 'trend_context', TRENDS, side === 'buy' ? 'up_trend_ema_stack' : 'down_trend_ema_stack');
  const liquidity_zone_type = await askChoice(
    rl,
    'liquidity_zone_type',
    ZONES,
    side === 'buy' ? 'prior_day_low' : 'prior_day_high',
  );
  const liquidity_zone_price = await askNum(rl, 'liquidity_zone_price: ');
  const liquidity_event = await askChoice(rl, 'liquidity_event', EVENTS, 'sweep');
  const mm_behavior_hypothesis =
    (await ask(rl, 'mm_behavior_hypothesis [stop_hunt_then_reversal]: ')) ||
    'stop_hunt_then_reversal';
  const structure_notes =
    (await ask(rl, 'structure_notes (≥ brief wick/close description): ')) ||
    'Sweep then reclaim of zone; EMA stack aligns with bias.';
  let entry_thesis = await ask(rl, 'entry_thesis (≥20 chars, retest not chase): ');
  while (entry_thesis.length < 20) {
    entry_thesis = await ask(rl, 'entry_thesis too thin — retry (≥20 chars): ');
  }
  const session_context = (await ask(rl, 'session_context [optional]: ')) || undefined;
  const timeframe = (await ask(rl, 'timeframe [M15]: ')) || 'M15';
  const emotional_state = (await ask(rl, 'emotional_state [calm_focused]: ')) || 'calm_focused';
  const cognitive_state = (await ask(rl, 'cognitive_state [following_plan]: ')) || 'following_plan';

  const open = journal.openTrade({
    tier: Math.max(1, mandate.tier),
    mode: 'paper',
    instrument,
    side,
    entry_price,
    stop_price,
    target_price,
    risk_per_trade_pct: 0.01,
    setup_tag,
    entry_thesis,
    session_context,
    timeframe,
    trend_context,
    liquidity_zone_type,
    liquidity_zone_price,
    liquidity_event,
    mm_behavior_hypothesis,
    structure_notes,
    emotional_state,
    cognitive_state,
  });

  if (!open.ok) {
    console.error('OPEN REJECTED — protocol violations:');
    for (const v of open.violations) console.error(`  • ${v}`);
    return;
  }

  const g = gate.gate({
    intentId: randomUUID(),
    principalId: s.principal_id,
    domain: 'trading',
    action: 'paper_execute',
    tool: 'paper_execute',
    raisedAt: Date.now(),
    claimedMandate: mandate,
  });
  console.log(
    `\n[open] ${open.event.instrument} ${open.event.side} size=${open.event.position_size.toFixed(2)} ` +
      `risk=$${open.event.account_risk_amount.toFixed(2)} (1%)`,
  );
  console.log(`[gate] paper_execute → ${g.status}`);
  if (g.status === 'rejected') {
    console.error('  reasons:', g.event.reasons.join(', '));
  }
  console.log(`  event_id=${open.event.event_id}`);
  console.log('  Stop beyond sweep extreme; target at next liquidity pool. Close when done.\n');
}

async function interactiveClose(
  rl: ReturnType<typeof createInterface>,
  journal: PaperTradingJournal,
): Promise<void> {
  const open = journal.getOpenTrade();
  if (!open) {
    console.log('No open trade.');
    return;
  }
  console.log(
    `\n── close ${open.instrument} ${open.side} entry=${open.entry_price} stop=${open.stop_price} ──`,
  );
  const exit_price = await askNum(rl, 'exit_price: ');
  const exit_reason = (await ask(rl, 'exit_reason [target_hit|stop|plan_exit]: ')) || 'plan_exit';
  let logoc_note = await ask(
    rl,
    'logoc_note (name quality tested — e.g. TheoTechnoCosmoLogic: …): ',
  );
  while (logoc_note.length < 15) {
    logoc_note = await ask(rl, 'logoc_note too thin — retry: ');
  }
  let lesson = await ask(rl, 'lesson (≥10 chars process takeaway): ');
  while (lesson.length < 10) {
    lesson = await ask(rl, 'lesson too thin — retry: ');
  }

  const closed = journal.closeOpenTrade({ exit_price, exit_reason, logoc_note, lesson });
  if (!closed.ok) {
    console.error('CLOSE process-invalid or failed:');
    for (const v of closed.violations ?? []) console.error(`  • ${v}`);
    if (closed.event) {
      console.log(
        `  R=${closed.event.realized_R} pnl=$${closed.event.realized_pnl_synthetic} (no PL credit)`,
      );
    }
    return;
  }
  console.log(
    `\n[close] R=${closed.event?.realized_R} pnl=$${closed.event?.realized_pnl_synthetic} ` +
      `PL=${closed.pl?.score} tier=${closed.mandate?.tier} mode=${closed.mandate?.mode}\n`,
  );
}

async function interactiveReview(
  rl: ReturnType<typeof createInterface>,
  journal: PaperTradingJournal,
): Promise<void> {
  console.log('\n── daily review ritual ──');
  const review_date =
    (await ask(rl, `review_date [YYYY-MM-DD, default today]: `)) ||
    new Date().toISOString().slice(0, 10);
  let behavioral_pattern = await ask(rl, 'behavioral_pattern (≥15 chars): ');
  while (behavioral_pattern.length < 15) {
    behavioral_pattern = await ask(rl, 'too thin — retry: ');
  }
  let micro_rule_upgrade = await ask(rl, 'micro_rule_upgrade (≥15 chars): ');
  while (micro_rule_upgrade.length < 15) {
    micro_rule_upgrade = await ask(rl, 'too thin — retry: ');
  }
  const notes = (await ask(rl, 'notes [optional]: ')) || undefined;

  try {
    const { review, pl, mandate } = journal.dailyReview({
      review_date,
      behavioral_pattern,
      micro_rule_upgrade,
      notes,
    });
    console.log(
      `\n[review] trades=${review.trade_count} win_rate=${(review.win_rate * 100).toFixed(0)}% ` +
        `avg_R=${review.avg_R} maxDD_R=${review.max_drawdown_R}`,
    );
    console.log(`[review] PL=${pl.score} tier=${mandate.tier} mode=${mandate.mode}`);
    if (review.live_daily_stats) {
      console.log(
        `[review] live_daily_stats: pnl=${review.live_daily_stats.live_pnl_today} ` +
          `trades=${review.live_daily_stats.live_trades_today} limit_hit=${review.live_daily_stats.limit_hit}`,
      );
    }
    if (mandate.tier >= 2) {
      console.log('★ Tier 2 — live-limited unlock path (envelope: $500 / 0.5% / $7.50 day / 5 trades).');
    } else {
      console.log(`→ Need PL ≥ ${TIER_THRESHOLDS.tier2} for tier 2 (now ${pl.score}).`);
    }
    console.log();
  } catch (e) {
    console.error('Review failed:', e instanceof Error ? e.message : e);
  }
}

async function runInteractive(
  journal: PaperTradingJournal,
  ledger: PLLedger,
  issuer: MandateIssuer,
  gate: GateAclService,
  agent: ReturnType<typeof loadAgent>,
): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log('═══════════════════════════════════════════════════');
  console.log('  PAPER INTERACTIVE — Agent 0 × cris-colon');
  console.log('  commands: status | open | close | review | seed | live-check | quit');
  console.log('═══════════════════════════════════════════════════');
  printStatus(journal, ledger, issuer);

  try {
    for (;;) {
      const cmd = (await ask(rl, '> ')).toLowerCase();
      if (!cmd || cmd === 'quit' || cmd === 'exit' || cmd === 'q') break;
      if (cmd === 'status' || cmd === 's') {
        printStatus(journal, ledger, issuer);
        continue;
      }
      if (cmd === 'seed') {
        const s = journal.getSession();
        const before = ledger.compute(s.principal_id, 'trading').score;
        if (before >= TIER_THRESHOLDS.tier1) {
          console.log(`PL already ${before} — seed not required.`);
          continue;
        }
        seedBaselinePl(ledger, s.principal_id);
        const after = ledger.compute(s.principal_id, 'trading');
        const m = issuer.issueFromPL(after);
        console.log(`[seed] PL=${after.score} tier=${m.tier} mode=${m.mode}`);
        continue;
      }
      if (cmd === 'open' || cmd === 'o') {
        await interactiveOpen(rl, journal, ledger, issuer, gate);
        continue;
      }
      if (cmd === 'close' || cmd === 'c') {
        await interactiveClose(rl, journal);
        continue;
      }
      if (cmd === 'review' || cmd === 'r') {
        await interactiveReview(rl, journal);
        continue;
      }
      if (cmd === 'live-check' || cmd === 'live') {
        const s = journal.getSession();
        const pl = ledger.compute(s.principal_id, 'trading');
        const mandate = issuer.issueFromPL(pl);
        const stats = journal.getLiveDailyStats();
        const withEnv = gate.gate({
          intentId: randomUUID(),
          principalId: s.principal_id,
          domain: 'trading',
          action: 'live_execute',
          tool: 'live_execute',
          capitalUSD: 100,
          perTradeRiskUSD: 500 * TIER2_LIVE_MAX_RISK_PCT_PER_TRADE,
          liveDailyStats: {
            live_pnl_today: stats.live_pnl_today,
            live_trades_today: stats.live_trades_today,
          },
          raisedAt: Date.now(),
          claimedMandate: mandate,
        });
        const bare = gate.gate({
          intentId: randomUUID(),
          principalId: s.principal_id,
          domain: 'trading',
          action: 'live_execute',
          tool: 'live_execute',
          capitalUSD: 100,
          raisedAt: Date.now(),
          claimedMandate: mandate,
        });
        console.log(
          `[live-check] tier=${mandate.tier} mode=${mandate.mode} with envelope → ${withEnv.status}` +
            (withEnv.status === 'rejected'
              ? ` (${withEnv.event.reasons.slice(0, 3).join(',')})`
              : ''),
        );
        console.log(
          `[live-check] bare (no envelope fields) → ${bare.status}` +
            (bare.status === 'rejected'
              ? ` (${bare.event.reasons.filter((r) => r.includes('live_envelope') || r.includes('tier')).slice(0, 3).join(',')})`
              : ' ⚠ unexpected approve'),
        );
        continue;
      }
      console.log('Unknown. Use: status | open | close | review | seed | live-check | quit');
    }
  } finally {
    rl.close();
  }
  console.log('Session ended. Journal:', journal.journalPath);
}

function main(): void {
  const cmd = process.argv[2] ?? 'demo';
  const agent = loadAgent();
  const secret = process.env.GATE_ACL_SIGNING_SECRET ?? 'paper-protocol-local-secret';
  const ledger = new PLLedger();
  const issuer = new MandateIssuer({ secret });
  const gate = new GateAclService(issuer);

  if (cmd === 'session') {
    const journal = new PaperTradingJournal(ledger, issuer, {
      principalId: agent.principalBinding.principalId,
      agentId: agent.agentId,
    });
    printStatus(journal, ledger, issuer);
    const s = journal.getSession();
    const pl = ledger.compute(s.principal_id, 'trading');
    const m = issuer.issueFromPL(pl);
    console.log(
      JSON.stringify(
        {
          session: s,
          pl: { score: pl.score, components: pl.components },
          mandate: {
            tier: m.tier,
            mode: m.mode,
            capitalCeilingUSD: m.capitalCeilingUSD,
            riskEnvelope: m.riskEnvelope,
          },
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === 'interactive' || cmd === 'i') {
    const journal = new PaperTradingJournal(ledger, issuer, {
      principalId: agent.principalBinding.principalId,
      agentId: agent.agentId,
    });
    void runInteractive(journal, ledger, issuer, gate, agent);
    return;
  }

  if (cmd === 'demo') {
    // Isolated demo ledger/journal paths would pollute; use default journal but
    // skip rehydrate so seed PL is deterministic for CI.
    const journal = new PaperTradingJournal(ledger, issuer, {
      principalId: agent.principalBinding.principalId,
      agentId: agent.agentId,
      skipRehydrate: true,
    });

    console.log('═══════════════════════════════════════════════════');
    console.log('  PAPER PROTOCOL DEMO — Agent 0 × cris-colon');
    console.log(`  Synthetic capital: $10,000 | risk 1% | tier path → ${TIER_THRESHOLDS.tier2}`);
    console.log('═══════════════════════════════════════════════════\n');

    const now = Date.now();
    const pid = agent.principalBinding.principalId;
    seedBaselinePl(ledger, pid, now);

    let pl = ledger.compute(pid, 'trading', now);
    let mandate = issuer.issueFromPL(pl, now);
    console.log(`[seed] PL=${pl.score} tier=${mandate.tier} mode=${mandate.mode}\n`);

    const open1 = journal.openTrade(
      {
        tier: mandate.tier,
        mode: 'paper',
        instrument: 'MON/USDC',
        side: 'buy',
        entry_price: 1.2345,
        stop_price: 1.228,
        target_price: 1.25,
        risk_per_trade_pct: 0.01,
        setup_tag: 'liq_sweep_ema_reversal',
        entry_thesis:
          'PDL swept then reclaimed; retest of zone/EMA confluence with volume dry-up on wick.',
        session_context: 'London_open',
        timeframe: 'M15',
        trend_context: 'up_trend_ema_stack',
        liquidity_zone_type: 'prior_day_low',
        liquidity_zone_price: 1.233,
        liquidity_event: 'sweep',
        mm_behavior_hypothesis: 'stop_hunt_then_reversal',
        structure_notes:
          'Price swept PDL, wicked below then closed back above; 20/50 EMA still stacked up.',
        emotional_state: 'calm_focused',
        cognitive_state: 'following_plan',
      },
      now,
    );
    if (!open1.ok) {
      console.error('open failed', open1.violations);
      process.exit(1);
    }
    console.log(
      `[open] ${open1.event.instrument} ${open1.event.side} size=${open1.event.position_size.toFixed(2)} ` +
        `risk=$${open1.event.account_risk_amount.toFixed(2)} (${open1.event.risk_per_trade_pct * 100}%)`,
    );

    const paperIntent = {
      intentId: randomUUID(),
      principalId: pid,
      domain: 'trading' as const,
      action: 'paper_execute' as const,
      tool: 'paper_execute',
      raisedAt: now + 1,
      claimedMandate: mandate,
    };
    const g = gate.gate(paperIntent, now + 1);
    console.log(`[gate] paper_execute → ${g.status}`);

    const close1 = journal.closeOpenTrade(
      {
        exit_price: 1.248,
        exit_reason: 'target_hit',
        logoc_note:
          'TheoTechnoCosmoLogic: tested discipline vs stop-hunt FOMO under Dark-Triad thrill pressure.',
        lesson: 'Waited for sweep + retest at EMA confluence; did not chase the wick.',
      },
      now + 2,
    );
    if (!close1.ok || !close1.event || !close1.pl || !close1.mandate) {
      console.error('close failed', close1.violations);
      process.exit(1);
    }
    console.log(
      `[close] R=${close1.event.realized_R} pnl=$${close1.event.realized_pnl_synthetic} ` +
        `PL=${close1.pl.score} tier=${close1.mandate.tier}`,
    );

    const open2 = journal.openTrade(
      {
        tier: close1.mandate.tier,
        mode: 'paper',
        instrument: 'MON/USDC',
        side: 'sell',
        entry_price: 1.26,
        stop_price: 1.265,
        target_price: 1.245,
        risk_per_trade_pct: 0.01,
        setup_tag: 'liq_sweep_ema_reversal',
        entry_thesis:
          'PDH swept with wick; retest of zone under EMA stack for short continuation fade.',
        emotional_state: 'calm',
        cognitive_state: 'following_plan',
        trend_context: 'down_trend_ema_stack',
        liquidity_zone_type: 'prior_day_high',
        liquidity_zone_price: 1.2595,
        liquidity_event: 'sweep',
        mm_behavior_hypothesis: 'stop_hunt_then_reversal',
        structure_notes: 'Sweep of PDH then close back below; 20/50 EMA stacked down.',
      },
      now + 10,
    );
    if (!open2.ok) {
      console.error('open2 failed', open2.violations);
      process.exit(1);
    }
    const close2 = journal.closeOpenTrade(
      {
        exit_price: 1.25,
        exit_reason: 'partial_stop_path',
        logoc_note: 'TheoTechnoCosmoLogic: tested patience vs cutting winners early.',
        lesson: 'Held to plan; size stayed at 1% risk after prior win.',
      },
      now + 11,
    );
    if (!close2.pl || !close2.mandate) {
      console.error('close2 failed', close2);
      process.exit(1);
    }
    console.log(
      `[close2] R=${close2.event?.realized_R} PL=${close2.pl.score} tier=${close2.mandate.tier}`,
    );

    for (let i = 0; i < 6; i++) {
      const isLong = i % 2 === 0;
      const zone = isLong ? 1.2 + i * 0.01 : 1.21 + i * 0.01;
      const o = journal.openTrade(
        {
          tier: Math.max(1, close2.mandate.tier),
          mode: 'paper',
          instrument: 'MON/USDC',
          side: isLong ? 'buy' : 'sell',
          entry_price: zone,
          stop_price: isLong ? zone - 0.005 : zone + 0.005,
          target_price: isLong ? zone + 0.012 : zone - 0.012,
          risk_per_trade_pct: 0.01,
          setup_tag: 'session_liquidity_zone_fade',
          entry_thesis: `Session ${isLong ? 'low' : 'high'} sweep then retest with EMA bias (${i + 1}).`,
          emotional_state: 'neutral',
          cognitive_state: 'following_plan',
          trend_context: isLong ? 'up_trend_ema_stack' : 'down_trend_ema_stack',
          liquidity_zone_type: isLong ? 'session_low' : 'session_high',
          liquidity_zone_price: zone,
          liquidity_event: 'sweep',
          mm_behavior_hypothesis: 'stop_hunt_then_reversal',
          structure_notes: `Session ${isLong ? 'low' : 'high'} swept then reclaimed; EMA stack confirms bias.`,
        },
        now + 100 + i * 10,
      );
      if (!o.ok) {
        console.error(`open ${i} failed`, o.violations);
        process.exit(1);
      }
      const exitPx =
        i % 2 === 0 ? o.event.entry_price + 0.015 : o.event.entry_price - 0.01;
      const c = journal.closeOpenTrade(
        {
          exit_price: exitPx,
          exit_reason: 'plan_exit',
          logoc_note: `TheoTechnoCosmoLogic: session trade ${i + 1} tested plan adherence.`,
          lesson: `Micro-lesson ${i + 1}: keep risk fixed at 1% regardless of prior R.`,
        },
        now + 101 + i * 10,
      );
      if (!c.pl || !c.mandate) {
        console.error(`close ${i} failed`, c.violations);
        process.exit(1);
      }
      pl = c.pl;
      mandate = c.mandate;
      console.log(`  trade#${i + 3} PL=${pl.score} tier=${mandate.tier}`);
    }

    const review = journal.dailyReview(
      {
        review_date: new Date().toISOString().slice(0, 10),
        behavioral_pattern:
          'Tendency to enter early after strong impulses without waiting for consolidation.',
        micro_rule_upgrade:
          'No entries unless price consolidates at least 3 candles after impulse before setup.',
        notes: 'Paper session toward tier 2 live-limited unlock.',
      },
      now + 1000,
    );
    console.log(
      `\n[daily review] trades=${review.review.trade_count} win_rate=${(review.review.win_rate * 100).toFixed(0)}% ` +
        `avg_R=${review.review.avg_R} maxDD_R=${review.review.max_drawdown_R}`,
    );
    console.log(
      `[daily review] PL=${review.pl.score} tier=${review.mandate.tier} mode=${review.mandate.mode}`,
    );

    if (review.mandate.tier >= 2) {
      console.log(
        '\n★ Tier 2 threshold reached — live-limited capital would unlock (mandate mode=live, $500 ceiling).',
      );
    } else {
      console.log(
        `\n→ Need PL ≥ ${TIER_THRESHOLDS.tier2} for tier 2 (currently ${review.pl.score}). Keep journaling process-valid trades.`,
      );
    }

    const liveStats = journal.getLiveDailyStats(new Date().toISOString().slice(0, 10));
    console.log(
      `[live envelope] capital≤$${review.mandate.capitalCeilingUSD} ` +
        `risk≤0.5%/trade daily_loss≤$${liveStats.daily_loss_limit_usd} ` +
        `max_trades=${liveStats.max_trades_per_day} ` +
        `today: pnl=${liveStats.live_pnl_today} trades=${liveStats.live_trades_today} limit_hit=${liveStats.limit_hit}`,
    );

    const live = gate.gate(
      {
        intentId: randomUUID(),
        principalId: pid,
        domain: 'trading',
        action: 'live_execute',
        tool: 'live_execute',
        capitalUSD: 100,
        perTradeRiskUSD: 2.5,
        liveDailyStats: {
          live_pnl_today: liveStats.live_pnl_today,
          live_trades_today: liveStats.live_trades_today,
        },
        raisedAt: now + 2000,
        claimedMandate: review.mandate,
      },
      now + 2000,
    );
    console.log(
      `[live check] tier=${review.mandate.tier} → ${live.status}` +
        (live.status === 'rejected' ? ` (${live.event.reasons.slice(0, 3).join(',')})` : ''),
    );

    // Fail-closed: bare live_execute without envelope fields must reject at tier 2
    if (review.mandate.tier >= 2 && review.mandate.mode === 'live') {
      const bare = gate.gate(
        {
          intentId: randomUUID(),
          principalId: pid,
          domain: 'trading',
          action: 'live_execute',
          tool: 'live_execute',
          capitalUSD: 100,
          raisedAt: now + 2001,
          claimedMandate: review.mandate,
        },
        now + 2001,
      );
      console.log(
        `[live fail-closed] bare intent → ${bare.status}` +
          (bare.status === 'rejected'
            ? ` (${bare.event.reasons.filter((r) => r.includes('live_envelope')).join(',')})`
            : ''),
      );

      const blocked = gate.gate(
        {
          intentId: randomUUID(),
          principalId: pid,
          domain: 'trading',
          action: 'live_execute',
          tool: 'live_execute',
          capitalUSD: 100,
          perTradeRiskUSD: 2.5,
          liveDailyStats: { live_pnl_today: -7.5, live_trades_today: 3 },
          raisedAt: now + 2002,
          claimedMandate: review.mandate,
        },
        now + 2002,
      );
      console.log(
        `[live blocked] daily loss limit → ${blocked.status}` +
          (blocked.status === 'rejected'
            ? ` (${blocked.event.reasons.filter((r) => r.includes('daily') || r.includes('max_')).join(',')})`
            : ''),
      );
    }

    console.log('\nPaper protocol demo complete. Journal:', journal.journalPath);
    return;
  }

  console.log('Usage: pnpm paper:demo | pnpm paper:session | pnpm paper:interactive');
  process.exit(2);
}

main();
