#!/usr/bin/env node
/**
 * Generate a realistic post-traceability bus window.
 *
 * Every trace-required event is validated through @sovereign/bus
 * validateIntentionTraceability before being written, so this window
 * represents what the bus would actually emit after CHARTER §4 enforcement.
 */

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateIntentionTraceability } from '@sovereign/bus';

const OUT = process.argv[2] ?? 'logs/audit/signal-stream-traced.jsonl';

const now = new Date('2026-06-23T10:19:12.000Z');
const dt = (minutes) =>
  new Date(now.getTime() - minutes * 60_000).toISOString();

function event(base) {
  const e = {
    id: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    timestamp: base.timestamp,
    layer: base.layer,
    source: base.source,
    type: base.type,
    payload: base.payload ?? {},
    ...(base.trace ? { trace: base.trace } : {}),
  };
  validateIntentionTraceability(e);
  return e;
}

const events = [
  // Human-initiated control-center actions (HCD-3 + HCD-4)
  event({
    timestamp: dt(19),
    layer: 'dao',
    source: 'control-center',
    type: 'agent.action.taken',
    payload: { decision: 'approve', target: 'allocation-v1' },
    trace: { intentionId: 'int-approve-1', source: 'operator-ui', createdAt: dt(19) },
  }),
  event({
    timestamp: dt(18),
    layer: 'dao',
    source: 'control-center',
    type: 'agent.action.taken',
    payload: { decision: 'reject', target: 'allocation-v2' },
    trace: { intentionId: 'int-reject-1', source: 'operator-ui', createdAt: dt(18) },
  }),
  event({
    timestamp: dt(17),
    layer: 'dao',
    source: 'control-center',
    type: 'dove.signal.tier1',
    payload: { tier: 1, driftCategory: 'participation.diversity.low' },
    trace: { intentionId: 'int-tier1-1', source: 'operator-ui', createdAt: dt(17) },
  }),

  // Economic action with human trace (HCD-4)
  event({
    timestamp: dt(16),
    layer: 'intelligence',
    source: 'agent-alpha',
    type: 'trade.approved',
    payload: { symbol: 'ETH', amount: 1.5 },
    trace: { intentionId: 'int-trade-1', source: 'operator-ui', createdAt: dt(16) },
  }),

  // Audit conclusion with trace (HCD-4)
  event({
    timestamp: dt(15),
    layer: 'intelligence',
    source: 'hepar-defi-auditor',
    type: 'hepar.audit.completed',
    payload: { auditId: 'audit-1', score: 95 },
    trace: { intentionId: 'int-audit-1', source: 'operator-ui', createdAt: dt(15) },
  }),

  // Drift signals used by HCD-5 (some traced, some not, to keep HCD-4 honest)
  event({
    timestamp: dt(14),
    layer: 'dove',
    source: 'dove-router',
    type: 'dove.signal.tier2',
    payload: { tier: 2, driftCategory: 'override.fidelity.drop' },
    trace: { intentionId: 'int-tier2-1', source: 'operator-ui', createdAt: dt(14) },
  }),
  event({
    timestamp: dt(10),
    layer: 'gnosis',
    source: 'gnosis-evaluator-core',
    type: 'gnosis.quarantine.triggered',
    payload: { agentId: 'agent-x', rationale: 'Lane C blink' },
    trace: { intentionId: 'int-quarantine-1', source: 'operator-ui', createdAt: dt(10) },
  }),
  event({
    timestamp: dt(8),
    layer: 'gnosis',
    source: 'gnosis-evaluator-core',
    type: 'gnosis.blink.triggered',
    payload: { agentId: 'agent-x', tiltMagnitude: 0.85, threshold: 0.4 },
    trace: { intentionId: 'int-blink-1', source: 'operator-ui', createdAt: dt(8) },
  }),

  // Non-trace-required telemetry for contrast
  {
    id: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    timestamp: dt(5),
    layer: 'gnosis',
    source: 'gnosis-evaluator-core',
    type: 'gnosis.score.computed',
    payload: { agentId: 'agent-x', overallScore: 0.5 },
  },
  {
    id: crypto.randomUUID(),
    correlationId: crypto.randomUUID(),
    timestamp: dt(3),
    layer: 'intelligence',
    source: 'sovereign-local',
    type: 'test.signal',
    payload: { testPayload: true, score: 95 },
  },
];

// Validate only the trace-required subset; telemetry is allowed to be bare.
for (const e of events) {
  if (e.trace) {
    validateIntentionTraceability(e);
  }
}

const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
writeFileSync(resolve(OUT), lines, 'utf-8');
console.log(`Wrote ${events.length} events to ${OUT}`);
