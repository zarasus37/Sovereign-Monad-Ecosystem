/**
 * Types for the Human Capability Drift monitor.
 *
 * These shapes describe the parsed inputs and computed metric outputs.
 * They are intentionally decoupled from @sovereign/types so the monitor
 * can run against offline logs without a live bus connection.
 */

/** A parsed human-review queue summary. */
export interface HumanReviewQueue {
  /** Date stated at the top of the queue document (ISO-8601 if parseable). */
  readonly date?: string;
  /** Total events processed in the window. */
  readonly totalEvents: number;
  /** Events flagged for human review. */
  readonly humanReviewCount: number;
  /** Auto-accepted events, if stated. */
  readonly autoAcceptCount?: number;
  /** Auto-accept rate as a fraction (0–1), if stated. */
  readonly autoAcceptRate?: number;
  /** Individual queue entries. */
  readonly entries: HumanReviewQueueEntry[];
}

/** One entry in the human-review queue. */
export interface HumanReviewQueueEntry {
  readonly eventId: string;
  readonly actualClass?: number;
  readonly rubricClass?: number | null;
  readonly mlClass?: number;
  readonly mlConfidence?: number;
}

/** A correction-log payload (subset of logs/audit/correction_log_v*.json). */
export interface CorrectionLog {
  readonly version: string;
  readonly appliedAt: string;
  readonly sourceCorpus: string;
  readonly targetCorpus: string;
  readonly phase: string;
  readonly corrections: CorrectionEntry[];
  readonly removed: RemovedEntry[];
  readonly keptAsIs: KeptAsIsEntry[];
}

export interface CorrectionEntry {
  readonly eventId: string;
  readonly action: 'reclassify';
  readonly oldClass: number;
  readonly newClass: number;
  readonly rationale?: string;
}

export interface RemovedEntry {
  readonly eventId: string;
}

export interface KeptAsIsEntry {
  readonly eventId: string;
  readonly oldClass: number;
  readonly rationale?: string;
}

/** A generic bus event parsed from JSONL logs. */
export interface BusEvent {
  readonly id: string;
  readonly correlationId: string;
  readonly timestamp: string;
  readonly layer: string;
  readonly source: string;
  readonly type: string;
  readonly payload?: unknown;
  readonly severity?: string;
  readonly trace?: {
    readonly intentionId: string;
    readonly source: string;
    readonly parentEventId?: string;
    readonly constraintEnvelopeId?: string;
    readonly narrativePurposeId?: string;
    readonly createdAt?: string;
  };
}

/** Sources that are considered human-originated for HCD‑3. */
export const DEFAULT_HUMAN_SOURCES = new Set<string>([
  'control-center',
  'operator-ui',
  'human-review',
  'manual-override',
  'steward-council',
  'founder',
]);

/** One computed metric value plus diagnostic notes. */
export interface MetricResult {
  /** Metric identifier, e.g. HCD‑1. */
  readonly id: string;
  /** Human-readable name. */
  readonly name: string;
  /** Numeric value (0–1 for ratios, milliseconds for latency, etc.). */
  readonly value: number;
  /** Unit: ratio, count, ms, etc. */
  readonly unit: string;
  /** Number of observations used. */
  readonly sampleSize: number;
  /** Window or scope the metric covers. */
  readonly window?: string;
  /** Yellow / red / green assessment against thresholds, if applicable. */
  readonly status?: 'green' | 'yellow' | 'red' | 'insufficient-data';
  /** Free-form notes about data quality or interpretation. */
  readonly notes?: string[];
}

/** Aggregate drift report. */
export interface DriftReport {
  readonly generatedAt: string;
  readonly metrics: MetricResult[];
  readonly inputs: {
    readonly queuePath?: string;
    readonly correctionLogPath?: string;
    readonly busLogPath?: string;
  };
  readonly warnings: string[];
}
