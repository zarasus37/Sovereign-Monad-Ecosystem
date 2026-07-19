import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildEntryEvent,
  closeTrade,
  computePositionSizing,
  stampProtocol,
  validatePaperProtocol,
  SYNTHETIC_ACCOUNT_DEFAULT,
} from './logocTrade.js';
import { PLLedger } from './plLedger.js';
import { MandateIssuer } from './mandateIssuer.js';
import { PaperTradingJournal } from './paperJournal.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
