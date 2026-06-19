/**
 * DoveSignal — the canonical output of the Dove Protocol conscience layer.
 *
 * The Dove observes all ecosystem layers for moral and structural drift.
 * It NEVER halts execution directly. It signals. Tier 1 is informational.
 * Tier 2 generates a governance proposal. Tier 3 triggers an emergency.
 *
 * Reference: MOF Section — Layer 11, Dove Per-Layer Observation Matrix
 */

import type { SignalLayer } from './signal.js';

/** The three Dove signal tiers — ordered by severity. */
export type DoveTier = 1 | 2 | 3;

/**
 * The canonical drift categories the Dove monitors.
 * Each maps to a specific observable in the per-layer observation matrix.
 */
export type DriftCategory =
  // Funnel / Narrative drift
  | 'experiential.drift'
  | 'founder.centering'
  | 'ego.capture'
  // Capital / Engine drift
  | 'layer.self.optimization'
  | 'capital.concentration'
  | 'extraction.pattern'
  // Governance drift
  | 'monoculture.formation'
  | 'dogma.detection'
  | 'participation.diversity.low'
  // Intelligence / Agent drift
  | 'macro.micro.divergence'
  | 'agent.hollow.convergence'
  // Data / Oracle drift
  | 'knowledge.weaponized'
  | 'licensing.misalignment'
  | 'data.revenue.misrouted'
  // Keys / Platform drift
  | 'key.consolidation'
  | 'archonic.construct'
  | 'access.exclusion'
  // Founder sink drift
  | 'founder.draw.excessive'
  // System
  | 'axiom.contradiction'
  | 'boundary.stress.detected';

/**
 * A single Dove signal emission.
 *
 * The Dove emits this whenever a monitored observable crosses a threshold.
 * All signals are recorded. Tier 2 additionally generates a governance
 * proposal. Tier 3 additionally pages the multisig.
 */
export interface DoveSignal {
  /** Unique signal identifier. */
  readonly signalId: string;

  /** ISO-8601 timestamp of emission. */
  readonly timestamp: string;

  /** Signal tier — 1 = info, 2 = governance trigger, 3 = emergency. */
  readonly tier: DoveTier;

  /** The ecosystem layer in which drift was observed. */
  readonly layer: SignalLayer;

  /** The specific drift category observed. */
  readonly driftCategory: DriftCategory;

  /**
   * Observable value that triggered the signal.
   * Serialized as a string for cross-system portability.
   */
  readonly observedValue: string;

  /**
   * Threshold that was crossed.
   * Serialized as a string for cross-system portability.
   */
  readonly threshold: string;

  /** Human-readable description of the drift observation. */
  readonly description: string;

  /**
   * Whether a governance proposal has been auto-generated.
   * Always false for Tier 1. May be true for Tier 2 and Tier 3.
   */
  readonly governanceProposalGenerated: boolean;

  /**
   * Reference ID of the generated governance proposal, if any.
   * Links to dao-core proposal record.
   */
  readonly governanceProposalId?: string;

  /**
   * Whether this signal is still active (drift still observed)
   * or resolved (drift corrected).
   */
  readonly resolved: boolean;

  /** ISO-8601 timestamp of resolution, if resolved. */
  readonly resolvedAt?: string;
}

/**
 * Dove system health report — aggregated view of all active signals.
 * Produced on demand by the Dove observation surface.
 */
export interface DoveHealthReport {
  /** ISO-8601 timestamp of report generation. */
  readonly generatedAt: string;

  /** Count of active Tier 1 signals. */
  readonly activeTier1Count: number;

  /** Count of active Tier 2 signals (governance proposals pending). */
  readonly activeTier2Count: number;

  /** Count of active Tier 3 signals (emergency). */
  readonly activeTier3Count: number;

  /** Layers with at least one active signal. */
  readonly affectedLayers: readonly SignalLayer[];

  /** All currently active (unresolved) signals. */
  readonly activeSignals: readonly DoveSignal[];

  /**
   * Overall system alignment state.
   * 'aligned' = no active signals.
   * 'monitoring' = Tier 1 signals only.
   * 'governance-required' = Tier 2 signal(s) active.
   * 'emergency' = Tier 3 signal active.
   */
  readonly alignmentState: 'aligned' | 'monitoring' | 'governance-required' | 'emergency';
}
