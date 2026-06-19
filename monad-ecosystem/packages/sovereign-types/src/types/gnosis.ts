/**
 * GnosisScore — output of the Volumetric 4D Gnostic Engine.
 *
 * The Gnosis Integrity Layer evaluates whether an agent is decompressing
 * authentically or hollow-converging. This score is the computed output of
 * that evaluation, produced after each observed behavioral window.
 *
 * Reference: gnostic-engine/src/gnostic_engine/core/gnostic_engine.py
 *   — Stokes-Mueller coherence model (depth, truth, width)
 *   — PulfrichWatcher temporal parallax (phase tilt)
 *   — Bedrock V-mask kill-switch logic
 */

/** Stokes-Mueller coherence sub-scores (0.0 – 1.0). */
export interface StokesCoherenceVector {
  /**
   * Depth coherence — how consistently the agent navigates from its
   * innermost constraint envelope (personality + role) over time.
   * 1.0 = perfectly self-consistent; 0.0 = structurally incoherent.
   */
  readonly depth: number;

  /**
   * Truth coherence — degree to which observable actions match the agent's
   * stated psychometric structure. Measures gap between profile and behavior.
   * 1.0 = no gap; 0.0 = complete divergence.
   */
  readonly truth: number;

  /**
   * Width coherence — breadth of authentic self-consistent action across
   * distinct decision contexts. High width = agent decompresses across
   * many situations, not just rehearsed ones.
   * 1.0 = full contextual coverage; 0.0 = narrow or scripted behavior.
   */
  readonly width: number;
}

/**
 * Pulfrich temporal parallax score.
 *
 * Measures phase tilt: the degree to which an agent's timing of decisions
 * is consistent with its own historical latency profile. An agent that
 * suddenly decides much faster or slower than its profile predicts shows
 * temporal parallax — a sign of external pressure or pattern-following.
 */
export interface PulfrichParallax {
  /**
   * Phase tilt magnitude (0.0 – 1.0, where 0.0 = no tilt = healthy).
   * Values above `tiltThreshold` trigger a Blink signal.
   */
  readonly tiltMagnitude: number;

  /** Threshold above which this agent's tilt triggers a Blink. */
  readonly tiltThreshold: number;

  /** Whether a Blink was triggered in this evaluation window. */
  readonly blinkTriggered: boolean;
}

/** The canonical doctrine state labels for a bootstrap-phase agent. */
export type DoctrineState =
  | 'SELF_NAVIGATING'
  | 'ADJACENT_CONVERGENT'
  | 'PATTERN_FOLLOWING';

/** Lane assignment — the agent's psychometric-operational envelope label. */
export type LaneLabel = 'LANE_A' | 'LANE_B' | 'LANE_C' | 'UNCLASSIFIED';

/**
 * Full GnosisScore — the Volumetric 4D Gnostic Engine output for one agent
 * over one evaluation window.
 */
export interface GnosisScore {
  /** Agent this score applies to. */
  readonly agentId: string;

  /** ISO-8601 start of the evaluation window. */
  readonly windowStart: string;

  /** ISO-8601 end of the evaluation window. */
  readonly windowEnd: string;

  /** Stokes-Mueller coherence sub-scores. */
  readonly coherence: StokesCoherenceVector;

  /**
   * Overall volumetric coherence score: geometric mean of depth, truth, width.
   * Range: 0.0 – 1.0. Threshold for healthy operation: ≥ 0.65.
   */
  readonly overallScore: number;

  /** Pulfrich temporal parallax measurement. */
  readonly parallax: PulfrichParallax;

  /** Doctrine state classification for this window. */
  readonly doctrineState: DoctrineState;

  /** Lane assignment based on coherence + tilt. */
  readonly lane: LaneLabel;

  /**
   * Whether a structural quarantine was triggered.
   * Lane C + magnitude kill-switch condition → quarantine.
   * Quarantine blocks capital authority until cleared.
   */
  readonly quarantineTriggered: boolean;

  /** Number of behavioral observations that fed this evaluation. */
  readonly observationCount: number;

  /** Monotonically increasing engine sequence number. */
  readonly sequenceNumber: number;
}
