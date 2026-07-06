/**
 * HCD‑1 — Human Review Queue Burden Rate.
 *
 * Ratio of events flagged for human review to total events processed.
 */

import { HCD_THRESHOLDS, inverseRatioStatus } from '../config/thresholds.js';
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

  let status = inverseRatioStatus(value, HCD_THRESHOLDS.hcd1);
  if (queue.autoAcceptRate !== undefined && queue.autoAcceptRate < 0.85 && status === 'green') {
    status = 'yellow';
  }

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
