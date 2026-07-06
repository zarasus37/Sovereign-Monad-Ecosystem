/**
 * HCD‑2 — Override Fidelity Index.
 *
 * Fraction of human reclassifications (overrides) in the correction log that
 * were retained in the final corpus. Because the correction log already
 * represents applied corrections, every `corrections[]` entry is treated as
 * validated correct. Kept-as-is decisions are included in the denominator as
 * human judgments but are not overrides.
 */

import type { CorrectionLog, MetricResult } from '../types.js';

export function computeHcd2(log: CorrectionLog): MetricResult {
  const overrides = log.corrections.length;
  const totalHumanDecisions =
    log.corrections.length + log.keptAsIs.length + log.removed.length;

  const value = totalHumanDecisions === 0 ? 0 : overrides / totalHumanDecisions;

  const notes: string[] = [];
  notes.push(
    `${overrides} reclassifications, ${log.keptAsIs.length} kept-as-is, ${log.removed.length} removed.`
  );
  if (totalHumanDecisions > 0) {
    notes.push(
      'Low value means most human decisions did not result in reclassification; this may indicate weak discernment or a well-calibrated ML boundary.'
    );
  }

  let status: MetricResult['status'] = 'insufficient-data';
  if (totalHumanDecisions > 0) {
    status = 'green';
    if (value < 0.6) status = 'red';
    else if (value < 0.8) status = 'yellow';
  }

  return {
    id: 'HCD-2',
    name: 'Override Fidelity Index',
    value,
    unit: 'ratio',
    sampleSize: totalHumanDecisions,
    window: log.appliedAt,
    status,
    notes,
  };
}
