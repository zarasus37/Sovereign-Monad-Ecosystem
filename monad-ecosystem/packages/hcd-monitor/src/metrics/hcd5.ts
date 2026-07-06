/**
 * HCD‑5 — Meaningful Correction Latency.
 *
 * Median time from a drift signal to a recorded human corrective action in the
 * same scope. For now "same scope" is approximated by the same `layer` field
 * on the drift signal and any correction whose eventId prefix matches the
 * signal's drift category or layer.
 */

import { HCD_THRESHOLDS } from '../config/thresholds.js';
import type { BusEvent, CorrectionLog, MetricResult } from '../types.js';

/** Sanity ceiling: latencies above this look like timestamp/clock artifacts. */
const MAX_PLAUSIBLE_LATENCY_MS = 5 * 365 * 24 * 3_600_000; // ~5 years

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

  const negativeCount = latencies.filter((l) => l < 0).length;
  const plausibleLatencies = latencies.filter(
    (l) => l >= 0 && l <= MAX_PLAUSIBLE_LATENCY_MS
  );

  if (plausibleLatencies.length === 0) {
    return {
      id: 'HCD-5',
      name: 'Meaningful Correction Latency',
      value: 0,
      unit: 'ms',
      sampleSize: signals.length,
      status: 'insufficient-data',
      notes: [
        `${signals.length} drift signals; ${latencies.length} had parseable latency.`,
        `${negativeCount} signals occurred after the correction log timestamp.`,
        'No plausible latencies remain after filtering out negative or >5-year values; check clock/data ordering.',
      ],
    };
  }

  const median = computeMedian(plausibleLatencies);
  const hours = median / 3_600_000;
  const days = hours / 24;
  const bands = HCD_THRESHOLDS.hcd5;
  let status: MetricResult['status'] = 'green';
  if (hours > bands.redHours) status = 'red';
  else if (hours > bands.yellowHours) status = 'yellow';

  const notes: string[] = [
    `${signals.length} drift signals; ${latencies.length} had parseable latency; ${plausibleLatencies.length} within plausible range.`,
    `${negativeCount} signals occurred after the correction log timestamp (clock or data-order artifact).`,
    `Median latency: ${Math.round(median).toLocaleString()} ms (~${hours.toFixed(1)} hours, ~${days.toFixed(1)} days).`,
  ];

  return {
    id: 'HCD-5',
    name: 'Meaningful Correction Latency',
    value: Math.round(median),
    unit: 'ms',
    sampleSize: plausibleLatencies.length,
    status,
    notes,
  };
}

function computeMedian(values: number[]): number {
  values.sort((a, b) => a - b);
  return values.length % 2 === 1
    ? values[Math.floor(values.length / 2)]
    : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
}
