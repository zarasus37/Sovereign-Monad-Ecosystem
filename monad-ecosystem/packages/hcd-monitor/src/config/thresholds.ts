/**
 * Threshold configuration for the five Human Capability Drift metrics.
 *
 * These targets translate CHARTER.md §2.1 into concrete green/yellow/red
 * boundaries. They are versioned in source so that any change to what
 * "healthy" drift looks like must go through review.
 *
 * Targets are intentionally conservative: a metric must degrade meaningfully
 * before it turns yellow, and must cross a charter-relevant threshold before
 * it turns red.
 */

export interface ThresholdBands {
  /** Status when the metric is below this value (higher-is-better). */
  yellow: number;
  /** Status when the metric is below this value (higher-is-better). */
  red: number;
}

export interface InverseThresholdBands {
  /** Status when the metric is above this value (lower-is-better). */
  yellow: number;
  /** Status when the metric is above this value (lower-is-better). */
  red: number;
}

export interface LatencyThresholdBands {
  /** Yellow if median latency exceeds this many hours. */
  yellowHours: number;
  /** Red if median latency exceeds this many hours. */
  redHours: number;
}

export const HCD_THRESHOLDS = {
  /** HCD‑1 — Human Review Queue Burden Rate.
   *
   * Lower is better. Green: burden is low and stable.
   * Yellow: burden rises to the point where humans may become a bottleneck.
   * Red: humans are handling more than one quarter of the corpus.
   */
  hcd1: { yellow: 0.15, red: 0.25 } as InverseThresholdBands,

  /** HCD‑2 — Override Fidelity Index.
   *
   * Higher is better. Green: most human reclassifications are retained in the
   * authoritative corpus, i.e. human discernment is adding real value.
   * Yellow: humans are unsure or second-guessing a strong ML boundary.
   * Red: human overrides are mostly not retained.
   */
  hcd2: { yellow: 0.6, red: 0.4 } as ThresholdBands,

  /** HCD‑3 — Human-Initiated Query Diversity.
   *
   * Higher is better. Green: human-initiated activity is diverse.
   * Yellow: activity is concentrating.
   * Red: activity is concentrated AND the top three templates dominate.
   */
  hcd3: { yellow: 0.5, red: 0.4, top3Red: 0.6 } as ThresholdBands & {
    /** Red threshold also requires top-3 share to exceed this fraction. */
    top3Red: number;
  },

  /** HCD‑4 — Reasoning Exposure Ratio.
   *
   * Higher is better. Green: most consequential events carry an intention
   * trace before action. Yellow: trace coverage is incomplete.
   * Red: humans/agents are acting without required reasoning exposure.
   */
  hcd4: { yellow: 0.8, red: 0.3 } as ThresholdBands,

  /** HCD‑5 — Meaningful Correction Latency.
   *
   * Lower is better. Green: drift signals are corrected within a business day.
   * Yellow: correction takes longer than a day.
   * Red: correction takes longer than three days without documented deferral.
   */
  hcd5: { yellowHours: 24, redHours: 72 } as LatencyThresholdBands,
} as const;

/** Compute status for a metric where higher values are better. */
export function ratioStatus(
  value: number,
  bands: ThresholdBands
): 'green' | 'yellow' | 'red' {
  if (value < bands.red) return 'red';
  if (value < bands.yellow) return 'yellow';
  return 'green';
}

/** Compute status for a metric where lower values are better. */
export function inverseRatioStatus(
  value: number,
  bands: InverseThresholdBands
): 'green' | 'yellow' | 'red' {
  if (value > bands.red) return 'red';
  if (value > bands.yellow) return 'yellow';
  return 'green';
}
