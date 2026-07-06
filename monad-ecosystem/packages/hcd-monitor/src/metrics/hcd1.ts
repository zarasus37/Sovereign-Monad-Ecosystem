/**
 * HCD‑1 — Human Review Queue Burden Rate.
 *
 * Ratio of events flagged for human review to total events processed.
 */

import type { HumanReviewQueue, MetricResult } from '../types.js';

export function computeHcd1(queue: HumanReviewQueue): MetricResult {
  const value =
    queue.totalEvents === 0 ? 0 : queue.humanReviewCount / queue.totalEvents;

  const notes: string[] = [];
  if (queue.totalEvents === 0) {
    notes.push('Queue reports zero total events; burden rate set to 0.');
  }
  if (queue.autoAcceptRate !== undefined) {
    notes.push(`Auto-accept rate in source: ${(queue.autoAcceptRate * 100).toFixed(1)}%`);
  }

  // Yellow: burden rate > 15% or auto-accept below 85%.
  // Red: burden rate > 25%.
  let status: MetricResult['status'] = 'green';
  if (value > 0.25) status = 'red';
  else if (value > 0.15 || (queue.autoAcceptRate !== undefined && queue.autoAcceptRate < 0.85))
    status = 'yellow';

  return {
    id: 'HCD-1',
    name: 'Human Review Queue Burden Rate',
    value,
    unit: 'ratio',
    sampleSize: queue.totalEvents,
    window: queue.date,
    status,
    notes,
  };
}
