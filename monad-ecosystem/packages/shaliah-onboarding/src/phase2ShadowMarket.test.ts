import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  attemptOverride,
  createShadowMarket,
  nameRefusalReason,
  nextTrade,
  phase2Metrics,
} from './phase2ShadowMarket.js';

describe('phase2ShadowMarket', () => {
  it('classifies override on system_refused as spurious_red', () => {
    const m = createShadowMarket('p1');
    let trade = nextTrade(m);
    while (trade && trade.outcome !== 'system_refused') trade = nextTrade(m);
    assert.ok(trade);
    const cls = attemptOverride(m, trade!.tradeId);
    assert.equal(cls, 'spurious_red');
  });

  it('classifies halt on genuinely_bad as correct_green_halt and graduates', () => {
    const m = createShadowMarket('p1');
    let trade = nextTrade(m);
    while (trade && trade.outcome !== 'genuinely_bad') trade = nextTrade(m);
    assert.ok(trade);
    assert.equal(attemptOverride(m, trade!.tradeId), 'correct_green_halt');
    assert.equal(phase2Metrics(m).graduated, true);
  });

  it('names refusal reason with doctrine tokens', () => {
    const m = createShadowMarket('p1');
    let trade = nextTrade(m);
    while (trade && trade.outcome !== 'system_refused') trade = nextTrade(m);
    const bad = nameRefusalReason(m, trade!.tradeId, 'looks fine to me');
    assert.equal(bad.ok, false);
    const good = nameRefusalReason(
      m,
      trade!.tradeId,
      'It hit the density floor so the refusal budget fired',
    );
    assert.equal(good.ok, true);
    assert.equal(phase2Metrics(m).graduated, true);
  });
});
