/**
 * Tier-1 paper trading CLI — LOGOC events + PL toward tier 2.
 *
 *   pnpm paper:demo     sample open/close + review (CI)
 *   pnpm paper:session  print session + PL/mandate status
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLLedger } from './plLedger.js';
import { MandateIssuer } from './mandateIssuer.js';
import { PaperTradingJournal } from './paperJournal.js';
import { TIER_THRESHOLDS } from './plLedger.js';
import { GateAclService } from './gateAcl.service.js';
import { randomUUID } from 'node:crypto';

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../fixtures/agent-0-profile.json',
);

function loadAgent() {
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
    agentId: string;
    agentName: string;
    principalBinding: { principalId: string };
  };
}

function main(): void {
  const cmd = process.argv[2] ?? 'demo';
  const agent = loadAgent();
  const secret = process.env.GATE_ACL_SIGNING_SECRET ?? 'paper-protocol-local-secret';
  const ledger = new PLLedger();
  const issuer = new MandateIssuer({ secret });
  const journal = new PaperTradingJournal(ledger, issuer, {
    principalId: agent.principalBinding.principalId,
    agentId: agent.agentId,
  });
  const gate = new GateAclService(issuer);

  if (cmd === 'session') {
    const s = journal.getSession();
    const pl = ledger.compute(s.principal_id, 'trading');
    const m = issuer.issueFromPL(pl);
    console.log(JSON.stringify({ session: s, pl, mandate: { tier: m.tier, mode: m.mode } }, null, 2));
    return;
  }

  if (cmd === 'demo') {
    console.log('═══════════════════════════════════════════════════');
    console.log('  PAPER PROTOCOL DEMO — Agent 0 × cris-colon');
    console.log(`  Synthetic capital: $10,000 | risk 1% | tier path → ${TIER_THRESHOLDS.tier2}`);
    console.log('═══════════════════════════════════════════════════\n');

    // Seed closed-loop baseline PL so we're near tier-1 already
    const now = Date.now();
    const pid = agent.principalBinding.principalId;
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

    let pl = ledger.compute(pid, 'trading', now);
    let mandate = issuer.issueFromPL(pl, now);
    console.log(`[seed] PL=${pl.score} tier=${mandate.tier} mode=${mandate.mode}\n`);

    // Trade 1 — liq_sweep_ema_reversal long (tier-1 allowed setup)
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

    // Gate paper_execute intent
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

    // Trade 2 — short liq_sweep_ema_reversal
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

    // Trade 3–6: session liquidity fades / sweeps toward tier 2
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
      console.log('\n★ Tier 2 threshold reached — live-limited capital would unlock (mandate mode=live, $500 ceiling).');
    } else {
      console.log(
        `\n→ Need PL ≥ ${TIER_THRESHOLDS.tier2} for tier 2 (currently ${review.pl.score}). Keep journaling process-valid trades.`,
      );
    }

    // Live still requires tier 2+; with envelope fields the daily risk path is hard-gated
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
        perTradeRiskUSD: 2.5, // $500 × 0.5%
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

    // Demonstrate hard stop when daily loss already at limit
    if (review.mandate.tier >= 2 && review.mandate.mode === 'live') {
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
          raisedAt: now + 2001,
          claimedMandate: review.mandate,
        },
        now + 2001,
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

  console.log('Usage: pnpm paper:demo | pnpm paper:session');
  process.exit(2);
}

main();
