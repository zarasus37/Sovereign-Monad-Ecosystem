import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEntryEvent,
  closeTrade,
  computePositionSizing,
  stampProtocol,
  validatePaperProtocol,
  validateTier2LiveRisk,
  gateLiveExecute,
  computeLiveDailyStats,
  buildLiveRiskEnvelope,
  tier2MaxPerTradeRiskUSD,
  tier2DailyLossLimitUSD,
  TIER2_LIVE_MAX_CAPITAL_USD,
  TIER2_LIVE_MAX_RISK_PCT_PER_TRADE,
  TIER2_LIVE_MAX_TRADES_PER_DAY,
  SYNTHETIC_ACCOUNT_DEFAULT,
  type LOGOCTradeEvent,
} from './logocTrade.js';
import { PLLedger } from './plLedger.js';
import { MandateIssuer } from './mandateIssuer.js';
import { GateAclService } from './gateAcl.service.js';
import { PaperTradingJournal } from './paperJournal.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

describe('LOGOC paper risk math', () => {
  it('sizes position so stop loss = 1% of $10k', () => {
    // long entry 100, stop 99 → $1 risk per unit → 100 units for $100 risk
    const s = computePositionSizing('buy', 100, 99, 10_000, 0.01);
    assert.equal(s.account_risk_amount, 100);
    assert.equal(s.position_size, 100);
    assert.equal(s.position_notional, 10_000);
  });

  it('rejects risk above 2%', () => {
    assert.throws(() => computePositionSizing('buy', 100, 99, 10_000, 0.03));
  });

  it('validates protocol rules on a clean liq_sweep_ema_reversal long', () => {
    const e = buildEntryEvent({
      principal_id: 'principal:cris-colon',
      agent_id: '0xagent',
      tier: 1,
      mode: 'paper',
      instrument: 'MON/USDC',
      side: 'buy',
      entry_price: 1.2345,
      stop_price: 1.228,
      target_price: 1.25,
      risk_per_trade_pct: 0.01,
      setup_tag: 'liq_sweep_ema_reversal',
      entry_thesis: 'Price swept PDL then retested zone with EMA stack still up.',
      trend_context: 'up_trend_ema_stack',
      liquidity_zone_type: 'prior_day_low',
      liquidity_zone_price: 1.233,
      liquidity_event: 'sweep',
      mm_behavior_hypothesis: 'stop_hunt_then_reversal',
      structure_notes: 'Wick through PDL, close back above; 20/50 EMA up.',
    });
    const v = validatePaperProtocol(e);
    assert.deepEqual(v, []);
    const stamped = stampProtocol(e);
    assert.equal(stamped.protocol_valid, true);
  });

  it('rejects disallowed setup_tag at tier 1', () => {
    const e = buildEntryEvent({
      principal_id: 'p',
      agent_id: 'a',
      tier: 1,
      mode: 'paper',
      instrument: 'X',
      side: 'buy',
      entry_price: 100,
      stop_price: 99,
      target_price: 103,
      risk_per_trade_pct: 0.01,
      setup_tag: 'random_impulse_chase',
      entry_thesis: 'Chasing a green candle without liquidity context defined well.',
      trend_context: 'up_trend_ema_stack',
    });
    const v = validatePaperProtocol(e);
    assert.ok(v.some((x) => x.startsWith('setup_tag_not_allowed_at_tier1')));
  });

  it('rejects long sweep without retest near zone', () => {
    const e = buildEntryEvent({
      principal_id: 'p',
      agent_id: 'a',
      tier: 1,
      mode: 'paper',
      instrument: 'X',
      side: 'buy',
      entry_price: 1.3,
      stop_price: 1.2,
      target_price: 1.4,
      risk_per_trade_pct: 0.01,
      setup_tag: 'liq_sweep_ema_reversal',
      entry_thesis: 'Far from zone chase after sweep without waiting for retest entry.',
      trend_context: 'up_trend_ema_stack',
      liquidity_zone_type: 'prior_day_low',
      liquidity_zone_price: 1.0,
      liquidity_event: 'sweep',
    });
    const v = validatePaperProtocol(e);
    assert.ok(v.includes('entry_not_retest_near_zone'));
  });

  it('flags missing setup and revenge size', () => {
    const e = buildEntryEvent({
      principal_id: 'p',
      agent_id: 'a',
      tier: 1,
      instrument: 'X',
      side: 'buy',
      entry_price: 10,
      stop_price: 9,
      target_price: 12,
      setup_tag: '',
      entry_thesis: 'too short',
    });
    e.setup_tag = '';
    e.entry_thesis = 'short';
    const v = validatePaperProtocol(e, {
      lastLossAt: Date.now() - 1000,
      lastLossSize: e.position_size * 0.5,
      now: Date.now(),
    });
    assert.ok(v.some((x) => x.startsWith('rule1') || x.startsWith('rule3')));
  });

  it('journal close credits PL and can approach tier 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'paper-'));
    const ledger = new PLLedger();
    const issuer = new MandateIssuer({ secret: 't' });
    const j = new PaperTradingJournal(ledger, issuer, {
      journalPath: join(dir, 'j.jsonl'),
      sessionPath: join(dir, 's.json'),
      principalId: 'principal:cris-colon',
      agentId: '0xagent',
    });
    // seed tier-1 PL (15+12+10 = 37)
    const now = Date.now();
    ledger.append(
      {
        kind: 'comprehension_gate',
        eventId: 'seed-c',
        principalId: 'principal:cris-colon',
        domain: 'trading',
        passed: true,
        gateId: 'g',
        verifiedBy: 'comprehension-gate',
        at: now - 3,
      },
      now,
    );
    ledger.append(
      {
        kind: 'valid_override',
        eventId: 'seed-o',
        principalId: 'principal:cris-colon',
        domain: 'trading',
        agentErrorId: 'a',
        validated: true,
        verifiedBy: 'override-verifier',
        at: now - 2,
      },
      now,
    );
    ledger.append(
      {
        kind: 'domain_task',
        eventId: 'seed-t',
        principalId: 'principal:cris-colon',
        domain: 'trading',
        taskId: 't',
        outcome: 'passed',
        verifiedBy: 'task-verifier',
        at: now - 1,
      },
      now,
    );

    const open = j.openTrade({
      tier: 1,
      mode: 'paper',
      instrument: 'MON/USDC',
      side: 'buy',
      entry_price: 100,
      stop_price: 99,
      target_price: 103,
      risk_per_trade_pct: 0.01,
      setup_tag: 'liq_sweep_ema_reversal',
      entry_thesis: 'Defined structural setup with volume confirmation after hold.',
      trend_context: 'up_trend_ema_stack',
      liquidity_zone_type: 'prior_day_low',
      liquidity_zone_price: 99.9,
      liquidity_event: 'sweep',
      mm_behavior_hypothesis: 'stop_hunt_then_reversal',
      structure_notes: 'Sweep of PDL then retest.',
    });
    assert.equal(open.ok, true);
    const closed = j.closeOpenTrade({
      exit_price: 102,
      exit_reason: 'target_path',
      logoc_note: 'TheoTechnoCosmoLogic: tested discipline vs FOMO.',
      lesson: 'Kept 1% risk and pre-set stop without revenge sizing.',
    });
    assert.equal(closed.ok, true);
    assert.ok((closed.pl?.score ?? 0) > 37 - 1); // at least seed + trade credit
    assert.ok(closed.event?.realized_R != null);
  });
});

describe('Tier-2 live risk envelope', () => {
  it('computes $2.50 max risk and $7.50 daily loss on $500', () => {
    assert.equal(tier2MaxPerTradeRiskUSD(), 2.5);
    assert.equal(tier2DailyLossLimitUSD(), 7.5);
    const env = buildLiveRiskEnvelope(2, 'live');
    assert.equal(env.live_capital_ceiling_usd, 500);
    assert.equal(env.max_risk_pct_per_trade, 0.005);
    assert.equal(env.daily_loss_limit_usd, 7.5);
    assert.equal(env.max_trades_per_day, 5);
  });

  it('rejects oversize per-trade risk and daily loss / trade caps', () => {
    const ok = validateTier2LiveRisk(
      { capitalUSD: 100, perTradeRiskUSD: 2.5 },
      { live_pnl_today: 0, live_trades_today: 0 },
    );
    assert.equal(ok.ok, true);

    const riskHi = validateTier2LiveRisk(
      { capitalUSD: 100, perTradeRiskUSD: 5 },
      { live_pnl_today: 0, live_trades_today: 0 },
    );
    assert.equal(riskHi.ok, false);
    assert.ok(riskHi.reasons.includes('per_trade_risk_exceeded'));

    const daily = validateTier2LiveRisk(
      { capitalUSD: 100, perTradeRiskUSD: 2.5 },
      { live_pnl_today: -7.5, live_trades_today: 2 },
    );
    assert.equal(daily.ok, false);
    assert.ok(daily.reasons.includes('daily_loss_limit_reached'));

    const trades = validateTier2LiveRisk(
      { capitalUSD: 100, perTradeRiskUSD: 2.5 },
      { live_pnl_today: 0, live_trades_today: TIER2_LIVE_MAX_TRADES_PER_DAY },
    );
    assert.equal(trades.ok, false);
    assert.ok(trades.reasons.includes('max_trades_per_day_reached'));
  });

  it('builds valid live LOGOC event at 0.5% of $500', () => {
    const e = buildEntryEvent({
      principal_id: 'principal:cris-colon',
      agent_id: '0xagent',
      tier: 2,
      mode: 'live',
      instrument: 'MON/USDC',
      side: 'buy',
      entry_price: 1.2345,
      stop_price: 1.228,
      target_price: 1.25,
      risk_per_trade_pct: TIER2_LIVE_MAX_RISK_PCT_PER_TRADE,
      synthetic_account_size: TIER2_LIVE_MAX_CAPITAL_USD,
      setup_tag: 'liq_sweep_ema_reversal',
      entry_thesis: 'Live: PDL swept then retested at EMA stack with plan adherence.',
      trend_context: 'up_trend_ema_stack',
      liquidity_zone_type: 'prior_day_low',
      liquidity_zone_price: 1.233,
      liquidity_event: 'sweep',
      mm_behavior_hypothesis: 'stop_hunt_then_reversal',
      structure_notes: 'Sweep reclaim; stop beyond sweep low.',
    });
    assert.ok(e.risk_envelope != null);
    assert.equal(e.account_risk_amount, 2.5);
    const v = validatePaperProtocol(e);
    assert.deepEqual(v, [], `unexpected violations: ${v.join(',')}`);
  });

  it('derives live daily stats from journal-shaped closes', () => {
    const day = '2026-07-19';
    const base = buildEntryEvent({
      principal_id: 'p',
      agent_id: 'a',
      tier: 2,
      mode: 'live',
      instrument: 'X',
      side: 'buy',
      entry_price: 100,
      stop_price: 99,
      target_price: 103,
      risk_per_trade_pct: 0.005,
      synthetic_account_size: 500,
      setup_tag: 'liq_sweep_ema_reversal',
      entry_thesis: 'Live retest after sweep of prior day low for long bias.',
      trend_context: 'up_trend_ema_stack',
      liquidity_zone_type: 'prior_day_low',
      liquidity_zone_price: 99.9,
      liquidity_event: 'sweep',
    });
    const closed: LOGOCTradeEvent = {
      ...closeTrade(base, {
        exit_price: 98.5,
        exit_reason: 'stop',
        logoc_note: 'TheoTechnoCosmoLogic: stop honored under pressure.',
        lesson: 'Respected envelope; no size up after loss.',
      }),
      timestamp: `${day}T12:00:00.000Z`,
    };
    // force live pnl
    closed.realized_pnl_live = -2.5;
    closed.mode = 'live';
    const stats = computeLiveDailyStats([closed], day);
    assert.equal(stats.live_trades_today, 1);
    assert.equal(stats.live_pnl_today, -2.5);
    assert.equal(stats.limit_hit, false);
  });

  it('gates live_execute via GateAclService with envelope fields', () => {
    const now = Date.now();
    const ledger = new PLLedger();
    const issuer = new MandateIssuer({ secret: 'tier2-live' });
    const gate = new GateAclService(issuer);
    // Seed enough PL for tier 2 (55): 15+12+10 + several paper credits
    const pid = 'principal:cris-colon';
    ledger.append(
      {
        kind: 'comprehension_gate',
        eventId: 'c',
        principalId: pid,
        domain: 'trading',
        passed: true,
        gateId: 'g',
        verifiedBy: 'comprehension-gate',
        at: now - 10,
      },
      now,
    );
    ledger.append(
      {
        kind: 'valid_override',
        eventId: 'o',
        principalId: pid,
        domain: 'trading',
        agentErrorId: 'e',
        validated: true,
        verifiedBy: 'override-verifier',
        at: now - 9,
      },
      now,
    );
    ledger.append(
      {
        kind: 'domain_task',
        eventId: 't',
        principalId: pid,
        domain: 'trading',
        taskId: 'task',
        outcome: 'passed',
        verifiedBy: 'task-verifier',
        at: now - 8,
      },
      now,
    );
    for (let i = 0; i < 8; i++) {
      ledger.append(
        {
          kind: 'logoc_paper_trade',
          eventId: `tr-${i}`,
          principalId: pid,
          domain: 'trading',
          tradeEventId: `te-${i}`,
          points: 3,
          processScore: 1,
          verifiedBy: 'task-verifier',
          at: now - i,
        },
        now,
      );
    }
    const pl = ledger.compute(pid, 'trading', now);
    assert.ok(pl.score >= 55, `PL=${pl.score}`);
    const mandate = issuer.issueFromPL(pl, now);
    assert.equal(mandate.tier, 2);
    assert.equal(mandate.mode, 'live');
    assert.equal(mandate.capitalCeilingUSD, 500);

    const tradeEvent = buildEntryEvent({
      principal_id: pid,
      agent_id: '0x',
      tier: 2,
      mode: 'live',
      instrument: 'MON/USDC',
      side: 'buy',
      entry_price: 1.2345,
      stop_price: 1.228,
      target_price: 1.25,
      risk_per_trade_pct: 0.005,
      synthetic_account_size: 500,
      setup_tag: 'liq_sweep_ema_reversal',
      entry_thesis: 'Live sweep retest with EMA stack and fixed envelope risk.',
      trend_context: 'up_trend_ema_stack',
      liquidity_zone_type: 'prior_day_low',
      liquidity_zone_price: 1.233,
      liquidity_event: 'sweep',
    });

    const approved = gate.gate(
      {
        intentId: randomUUID(),
        principalId: pid,
        domain: 'trading',
        action: 'live_execute',
        tool: 'live_execute',
        capitalUSD: 100,
        perTradeRiskUSD: tradeEvent.account_risk_amount,
        liveDailyStats: { live_pnl_today: 0, live_trades_today: 0 },
        tradeEvent,
        raisedAt: now,
        claimedMandate: mandate,
      },
      now,
    );
    assert.equal(approved.status, 'approved', JSON.stringify(approved));

    const rejectedLoss = gate.gate(
      {
        intentId: randomUUID(),
        principalId: pid,
        domain: 'trading',
        action: 'live_execute',
        tool: 'live_execute',
        capitalUSD: 100,
        perTradeRiskUSD: 2.5,
        liveDailyStats: { live_pnl_today: -8, live_trades_today: 1 },
        raisedAt: now,
        claimedMandate: mandate,
      },
      now,
    );
    assert.equal(rejectedLoss.status, 'rejected');
    if (rejectedLoss.status === 'rejected') {
      assert.ok(rejectedLoss.event.reasons.includes('daily_loss_limit_reached'));
    }

    const gl = gateLiveExecute(
      { capitalUSD: 100, perTradeRiskUSD: 2.5 },
      mandate,
      { live_pnl_today: 0, live_trades_today: 5 },
    );
    assert.equal(gl.status, 'rejected');
    assert.ok(gl.reasons.includes('max_trades_per_day_reached'));

    // Fail-closed: missing envelope fields must reject (no bare capital-only live)
    const bare = gate.gate(
      {
        intentId: randomUUID(),
        principalId: pid,
        domain: 'trading',
        action: 'live_execute',
        tool: 'live_execute',
        capitalUSD: 100,
        raisedAt: now,
        claimedMandate: mandate,
      },
      now,
    );
    assert.equal(bare.status, 'rejected');
    if (bare.status === 'rejected') {
      assert.ok(bare.event.reasons.includes('live_envelope_per_trade_risk_required'));
      assert.ok(bare.event.reasons.includes('live_envelope_daily_stats_required'));
    }
  });
});
