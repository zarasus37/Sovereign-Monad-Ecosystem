/**
 * Aggregate the five HCD metrics into a single DriftReport.
 */

import type {
  BusEvent,
  CorrectionLog,
  DriftReport,
  HumanReviewQueue,
  MetricResult,
} from './types.js';
import { computeHcd1 } from './metrics/hcd1.js';
import { computeHcd2 } from './metrics/hcd2.js';
import { computeHcd3 } from './metrics/hcd3.js';
import { computeHcd4 } from './metrics/hcd4.js';
import { computeHcd5 } from './metrics/hcd5.js';

export interface ReportInputs {
  queue?: HumanReviewQueue;
  correctionLog?: CorrectionLog;
  busEvents?: BusEvent[];
  queuePath?: string;
  correctionLogPath?: string;
  busLogPath?: string;
}

export function buildReport(inputs: ReportInputs): DriftReport {
  const metrics: MetricResult[] = [];
  const warnings: string[] = [];

  if (inputs.queue) {
    metrics.push(computeHcd1(inputs.queue));
  } else {
    warnings.push('No human-review queue provided; HCD‑1 skipped.');
  }

  if (inputs.correctionLog) {
    metrics.push(computeHcd2(inputs.correctionLog));
  } else {
    warnings.push('No correction log provided; HCD‑2 skipped.');
  }

  const busEvents = inputs.busEvents ?? [];
  const hcd3 = computeHcd3(busEvents);
  metrics.push(hcd3);
  if (hcd3.sampleSize === 0 && busEvents.length > 0) {
    warnings.push(
      'HCD‑3: no human-originated events found in the provided bus window; query diversity cannot be computed from this data.'
    );
  }

  const hcd4 = computeHcd4(busEvents);
  metrics.push(hcd4);
  if (hcd4.sampleSize > 0 && hcd4.value === 0) {
    warnings.push(
      'HCD‑4: all trace-required events in the window lack valid traces. This likely means the window predates traceability enforcement rather than indicating a live CHARTER §4 violation.'
    );
  }

  if (inputs.correctionLog) {
    const hcd5 = computeHcd5(busEvents, inputs.correctionLog);
    metrics.push(hcd5);
    if (hcd5.status === 'insufficient-data' && hcd5.sampleSize > 0) {
      warnings.push(
        'HCD‑5: median correction latency could not be computed from a plausible sample; review signal/correction timestamps for clock or data-order issues.'
      );
    }
  } else {
    warnings.push('No correction log provided; HCD‑5 skipped.');
  }

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    inputs: {
      queuePath: inputs.queuePath,
      correctionLogPath: inputs.correctionLogPath,
      busLogPath: inputs.busLogPath,
    },
    warnings,
  };
}

/**
 * Serialize a report to a stable JSON string.
 */
export function reportToJson(report: DriftReport): string {
  return JSON.stringify(report, null, 2);
}
