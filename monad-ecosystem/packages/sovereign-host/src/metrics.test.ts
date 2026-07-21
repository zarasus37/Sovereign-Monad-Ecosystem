import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import {
  recordCapacityEvent,
  recordFundingEvent,
  recordLoopEvent,
  recordShadowVerdict,
  renderPrometheusText,
  resetAllMetricsForTests,
  fundingEventsTotal,
  heparAuditsTotal,
  shadowGateTotal,
  yieldGrossUsdTotal,
} from './metrics.js';
import { ingestKafkaPayload } from './metricsKafka.js';
import {
  CARDIA_FUNDING_TOPIC,
  CAPACITY_CEILING_TOPIC,
  SOVEREIGN_LOOP_TOPIC,
} from '@sovereign/types';

describe('observability metrics', () => {
  beforeEach(() => {
    resetAllMetricsForTests();
  });

  it('tracks funding status and hepar from auditTrace', () => {
    recordFundingEvent({
      mandateId: 'm1',
      status: 'AUDIT_PASSED',
      timestamp: new Date(Date.now() - 2000).toISOString(),
      auditTrace: ['hepar:audit:PASS'],
    });
    recordFundingEvent({
      mandateId: 'm1',
      status: 'TX_SYNTHESIZED',
      timestamp: new Date().toISOString(),
    });
    assert.equal(fundingEventsTotal.get({ status: 'AUDIT_PASSED' }), 1);
    assert.equal(fundingEventsTotal.get({ status: 'TX_SYNTHESIZED' }), 1);
    assert.equal(heparAuditsTotal.get({ verdict: 'PASS' }), 1);

    const text = renderPrometheusText();
    assert.match(text, /sovereign_funding_events_total/);
    assert.match(text, /sovereign_funding_latency_seconds_bucket/);
    assert.match(text, /sovereign_hepar_audits_total\{verdict="PASS"\} 1/);
  });

  it('tracks capacity throttle and remaining gauge', () => {
    recordCapacityEvent({
      kind: 'THROTTLE_ACTIVE',
      remainingAllocationUsd: 12_000,
    });
    const text = renderPrometheusText();
    assert.match(text, /THROTTLE_ACTIVE/);
    assert.match(text, /sovereign_capacity_remaining_usd 12000/);
  });

  it('tracks Router B yield splits', () => {
    recordLoopEvent({
      kind: 'YIELD_ROUTED',
      grossYield: 100,
      distribution: {
        splits: { principal: 50, shaliahTreasury: 40, ecosystemVault: 10 },
      },
    });
    assert.equal(yieldGrossUsdTotal.get(), 100);
    const text = renderPrometheusText();
    assert.match(text, /sink="principal"/);
    assert.match(text, /sink="shaliah"/);
    assert.match(text, /sink="vault"/);
  });

  it('tracks shadow abort rate', () => {
    recordShadowVerdict('PASS');
    recordShadowVerdict('ABORT');
    recordLoopEvent({
      kind: 'TRADE_FAILED',
      reason: 'SHADOW_FAIL_ABORTED',
      auditTrace: ['shadow:gate:FAIL_ADVERSE_SELECTION'],
    });
    assert.equal(shadowGateTotal.get({ verdict: 'PASS' }), 1);
    assert.ok((shadowGateTotal.get({ verdict: 'ABORT' }) ?? 0) >= 2);
  });

  it('ingestKafkaPayload routes topics', () => {
    ingestKafkaPayload(CARDIA_FUNDING_TOPIC, {
      mandateId: 'x',
      status: 'AUDIT_FAILED',
      auditTrace: ['hepar:audit:fail'],
      timestamp: new Date().toISOString(),
    });
    ingestKafkaPayload(CAPACITY_CEILING_TOPIC, {
      kind: 'CAPACITY_EXHAUSTED',
      remainingAllocationUsd: 100,
    });
    ingestKafkaPayload(SOVEREIGN_LOOP_TOPIC, {
      kind: 'MANDATE_VERIFIED',
      reason: 'ok',
      auditTrace: [],
    });
    assert.equal(heparAuditsTotal.get({ verdict: 'FAIL' }), 1);
    const text = renderPrometheusText();
    assert.match(text, /CAPACITY_EXHAUSTED/);
    assert.match(text, /MANDATE_VERIFIED/);
  });
});
