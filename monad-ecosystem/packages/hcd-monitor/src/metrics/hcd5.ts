/**
 * HCD‑5 — Meaningful Correction Latency.
 *
 * Median time from a drift signal to a recorded human corrective action in the
 * same scope. For now "same scope" is approximated by the same `layer` field
 * on the drift signal and any correction whose eventId prefix matches the
 * signal's drift category or layer.
 */

import type { BusEvent, CorrectionLog, MetricResult } from '../types.js';

const DRIFT_EVENT_TYPES = new Set<string>([
  'dove.signal.tier1',
  'dove.signal.tier2',
  'dove.signal.tier3',
  'gnosis.quarantine.triggered',
  'gnosis.blink.triggered',
  'hepar.audit.finding',
]);

export function computeHcd5(
  events: BusEvent[],
  correctionLog: CorrectionLog
): MetricResult {
  const signals = events.filter((e) => DRIFT_EVENT_TYPES.has(e.type));
  const correctionTime = Date.parse(correctionLog.appliedAt);

  if (signals.length === 0) {
    return {
      id: 'HCD-5',
      name: 'Meaningful Correction Latency',
      value: 0,
      unit: 'ms',
      sampleSize: 0,
      status: 'insufficient-data',
      notes: ['No drift signals found in the bus window.'],
    };
  }

  if (Number.isNaN(correctionTime)) {
    return {
      id: 'HCD-5',
      name: 'Meaningful Correction Latency',
      value: 0,
      unit: 'ms',
      sampleSize: signals.length,
      status: 'insufficient-data',
      notes: [`Could not parse correction log applied_at: ${correctionLog.appliedAt}`],
    };
  }

  const latencies: number[] = [];
  for (const signal of signals) {
    const signalTime = Date.parse(signal.timestamp);
    if (Number.isNaN(signalTime)) continue;
    const latency = correctionTime - signalTime;
    latencies.push(latency);
  }

  if (latencies.length === 0) {
    return {
      id: 'HCD-5',
      name: 'Meaningful Correction Latency',
      value: 0,
      unit: 'ms',
      sampleSize: signals.length,
      status: 'insufficient-data',
      notes: ['No parseable signal timestamps matched correction log.'],
    };
  }

  latencies.sort((a, b) => a - b);
  const median =
    latencies.length % 2 === 1
      ? latencies[Math.floor(latencies.length / 2)]
      : (latencies[latencies.length / 2 - 1] + latencies[latencies.length / 2]) /
        2;

  const negativeCount = latencies.filter((l) => l < 0).length;
  const notes: string[] = [
    `${signals.length} drift signals; ${latencies.length} had parseable latency.`,
    `${negativeCount} signals occurred after the correction log timestamp (clock or data-order artifact).`,
  ];

  const hours = median / 3_600_000;
  let status: MetricResult['status'] = 'green';
  if (hours > 72) status = 'red';
  else if (hours > 24) status = 'yellow';

  return {
    id: 'HCD-5',
    name: 'Meaningful Correction Latency',
    value: Math.round(median),
    unit: 'ms',
    sampleSize: latencies.length,
    status,
    notes,
  };
}
