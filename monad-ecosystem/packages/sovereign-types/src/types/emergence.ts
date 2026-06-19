/**
 * EmergencePattern — canonical type for the Emergent Protocol System.
 *
 * The Emergence layer observes behavioral windows across agents and protocols,
 * identifies statistically significant recurring patterns, and generates
 * bounded pattern claims submitted to EmergenceRecorder on-chain.
 *
 * Reference: MOF Section — Layer 15, Emergent Protocol System
 * Repo: monad-ecosystem/packages/emergent-protocol-core
 *       monad-ecosystem/packages/emergence-claim-core
 *       monad-ecosystem/packages/emergence-history-core
 */

/** Observation window spanning a time range and agent set. */
export interface EmergenceObservationWindow {
  /** Unique window identifier. */
  readonly windowId: string;

  /** ISO-8601 start of the observation window. */
  readonly start: string;

  /** ISO-8601 end of the observation window. */
  readonly end: string;

  /** Agents observed during this window. */
  readonly agentIds: readonly string[];

  /** Number of behavioral observations captured. */
  readonly observationCount: number;

  /** Layers that contributed signal to this window. */
  readonly contributingLayers: readonly string[];
}

/** Statistical evidence supporting a pattern candidate. */
export interface PatternEvidence {
  /** Number of independent occurrences observed. */
  readonly occurrenceCount: number;

  /** Fraction of eligible windows in which the pattern appeared (0.0–1.0). */
  readonly frequency: number;

  /**
   * Statistical confidence (0.0–1.0).
   * Below 0.75 → candidate only. Above 0.90 → reviewable claim.
   */
  readonly confidence: number;

  /** Whether the pattern was observed consistently across different agents. */
  readonly crossAgentConsistent: boolean;

  /** Whether the pattern was observed consistently across different regimes. */
  readonly crossRegimeConsistent: boolean;

  /** Window IDs that contain evidence for this pattern. */
  readonly evidenceWindowIds: readonly string[];
}

/** Lifecycle status of a pattern from observation to on-chain claim. */
export type PatternStatus =
  | 'candidate'      // Under observation; evidence accumulating
  | 'review-ready'   // Evidence threshold met; awaiting operator review
  | 'claimed'        // Submitted to EmergenceRecorder on-chain
  | 'rejected'       // Reviewed and rejected by operator
  | 'superseded';    // Replaced by a more refined pattern claim

/**
 * An emergence pattern candidate or validated claim.
 * Emitted as `emergence.pattern.candidate` or `emergence.claim.submitted` signal.
 */
export interface EmergencePattern {
  /** Unique pattern identifier. */
  readonly patternId: string;

  /** ISO-8601 timestamp when pattern was first identified. */
  readonly firstObservedAt: string;

  /** ISO-8601 timestamp of most recent update. */
  readonly updatedAt: string;

  /** Human-readable title for the pattern. */
  readonly title: string;

  /** Detailed description of the observed pattern. */
  readonly description: string;

  /**
   * Category of the pattern.
   * Patterns that recur across agents suggest protocol-level properties.
   * Patterns unique to one agent feed back into Gnosis integrity evaluation.
   */
  readonly category:
    | 'cross-agent-behavioral'     // Observed across ≥2 independent agents
    | 'agent-specific-behavioral'  // Unique to one agent's decompression style
    | 'market-structural'          // Related to market microstructure
    | 'governance-behavioral'      // Observed in governance participation
    | 'capital-flow-structural'    // Related to treasury / routing behavior
    | 'alignment-drift'            // Dove-correlated alignment behavior
    | 'emergence-recursive';       // Pattern in how patterns emerge

  /** Current lifecycle status. */
  readonly status: PatternStatus;

  /** Statistical evidence base. */
  readonly evidence: PatternEvidence;

  /** Observation windows contributing to this pattern. */
  readonly observationWindows: readonly EmergenceObservationWindow[];

  /**
   * On-chain transaction hash if a claim has been submitted to EmergenceRecorder.
   * Null until status is 'claimed'.
   */
  readonly claimTxHash: string | null;

  /**
   * Downstream path — how this pattern could inform protocol evolution.
   * Populated during operator review.
   */
  readonly downstreamPath?: string;

  /**
   * Whether this pattern has been incorporated into the Gnosis baseline.
   * Gnosis baseline patterns are used to evaluate future agent coherence.
   */
  readonly incorporatedIntoGnosisBaseline: boolean;
}

/** Emergence accumulator state — running count of windows and readiness. */
export interface EmergenceAccumulatorState {
  /** Total windows observed since accumulator started. */
  readonly totalWindowsObserved: number;

  /** Windows needed before first claim becomes eligible (canonical: 5). */
  readonly minimumWindowsRequired: number;

  /** Whether the baseline is established (totalWindowsObserved ≥ minimum). */
  readonly baselineEstablished: boolean;

  /** Current review-ready pattern count. */
  readonly reviewReadyCount: number;

  /** Current claimed pattern count. */
  readonly claimedCount: number;

  /** ISO-8601 timestamp of last accumulator update. */
  readonly lastUpdatedAt: string;
}
