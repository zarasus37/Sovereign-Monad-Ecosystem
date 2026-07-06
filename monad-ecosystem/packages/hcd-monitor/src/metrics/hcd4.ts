/**
 * HCD‑4 — Reasoning Exposure Ratio.
 *
 * Fraction of consequential (trace-required) events that carry a complete
 * EventTrace. This is a proxy for how often humans and systems are forced to
 * expose reasoning before action.
 */

import { TRACE_REQUIRED_EVENT_TYPES } from '@sovereign/bus';
import type { BusEvent, MetricResult } from '../types.js';

export function computeHcd4(events: BusEvent[]): MetricResult {
  const requiredEvents = events.filter((e) =>
    TRACE_REQUIRED_EVENT_TYPES.has(e.type)
  );

  if (requiredEvents.length === 0) {
    return {
      id: 'HCD-4',
      name: 'Reasoning Exposure Ratio',
      value: 0,
      unit: 'ratio',
      sampleSize: 0,
      status: 'insufficient-data',
      notes: ['No trace-required event types observed in the bus window.'],
    };
  }

  const withTrace = requiredEvents.filter(
    (e) => e.trace && isValidTrace(e.trace)
  ).length;
  const value = withTrace / requiredEvents.length;

  const byType = new Map<string, { total: number; withTrace: number }>();
  for (const event of requiredEvents) {
    const bucket = byType.get(event.type) ?? { total: 0, withTrace: 0 };
    bucket.total++;
    if (event.trace && isValidTrace(event.trace)) bucket.withTrace++;
    byType.set(event.type, bucket);
  }

  const notes: string[] = [
    `${requiredEvents.length} trace-required events observed; ${withTrace} carry a valid trace.`,
  ];
  for (const [type, { total, withTrace: wt }] of byType) {
    notes.push(`  ${type}: ${wt}/${total} traced`);
  }

  let status: MetricResult['status'] = 'green';
  if (value < 0.3) status = 'red';
  else if (value < 0.8) status = 'yellow';

  return {
    id: 'HCD-4',
    name: 'Reasoning Exposure Ratio',
    value,
    unit: 'ratio',
    sampleSize: requiredEvents.length,
    status,
    notes,
  };
}

function isValidTrace(trace: NonNullable<BusEvent['trace']>): boolean {
  return (
    typeof trace.intentionId === 'string' &&
    trace.intentionId.length > 0 &&
    typeof trace.source === 'string' &&
    trace.source.length > 0
  );
}
