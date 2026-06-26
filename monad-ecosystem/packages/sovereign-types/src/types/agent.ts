/**
 * AgentProfile — the compressed personality + operational envelope of a Sovereign agent.
 *
 * This is the canonical type representation of an agent's psychometric-operational
 * structure. The Gnosis Integrity Layer uses this to evaluate authentic decompression
 * vs hollow convergence. The Oracle uses this to calibrate behavioral risk premia.
 */

/** Big Five / NEO-PI-R dimension scores (0.0 – 1.0, normalized). */
export interface BigFiveVector {
  /** Orderliness, discipline, goal-directedness. */
  readonly conscientiousness: number;
  /** Emotional stability vs reactivity under stress. */
  readonly neuroticism: number;
  /** Curiosity, creativity, breadth of pattern search. */
  readonly openness: number;
  /** Cooperation, conflict-avoidance, trust orientation. */
  readonly agreeableness: number;
  /** Activity level, assertion speed, decision frequency. */
  readonly extraversion: number;
}

/** HEXACO Honesty-Humility dimension (additive to Big Five). */
export interface HexacoHonestyHumility {
  /** Integrity under pressure and incentive to defect. */
  readonly honestyHumility: number;
}

/** Dark-side risk traits observed under drawdown conditions. */
export interface HoganRiskProfile {
  /** Tendency toward volatile over-reaction under stress. */
  readonly excitability: number;
  /** Tendency toward skepticism and distrust of signals. */
  readonly skepticism: number;
  /** Tendency toward cautious over-checking and indecision. */
  readonly cautious: number;
  /** Tendency toward independent, non-conforming action. */
  readonly independent: number;
  /** Tendency toward impulsive, thrill-seeking execution. */
  readonly mischievous: number;
}

/** The agent's assigned operational role in the ecosystem. */
export type AgentRole =
  | 'hepar'       // DeFi auditor
  | 'cortex'      // Strategic intelligence
  | 'synapse'     // Signal routing / coordination
  | 'cardia'      // Capital allocation
  | 'pneuma'      // External market interface
  | 'vox'         // Narrative / distribution
  | 'governance'  // DAO proposal routing
  | 'oracle'      // Risk modeling
  | 'agent-0'     // Ecosystem-native founder agent
  | 'delegate'    // Human-linked Shaliah delegate
  | 'ecosystem-native'; // No human delegate

/**
 * The six PLEX personality archetypes.
 * Each archetype defines a distinct compressed intention and decompression style.
 * Reference: plex/Manifest/AGENT_PERSONALITY_FRAMES_v5.md
 */
export type AgentArchetype =
  | 'explorer'     // Researcher / discovery
  | 'executor'     // Operator / capital deployment
  | 'governor'     // Allocator / oversight
  | 'mediator'     // Negotiator / bridge
  | 'chronicler'   // Historian / witness
  | 'synthesizer'; // Meta-connector / pattern integration

/** A single interaction with a hard constraint boundary — used for Dove watch points. */
export interface ConstraintInteraction {
  /** The constraint that was tested. */
  readonly constraintName: string;

  /** ISO-8601 timestamp of the interaction. */
  readonly timestamp: string;

  /** Whether the constraint was respected, hit, or exceeded. */
  readonly outcome: 'respected' | 'hit' | 'exceeded';

  /** Optional numeric value at the boundary interaction. */
  readonly value?: number;

  /** Human-readable context for the interaction. */
  readonly context?: string;
}

/** Psychometric validation tier. */
export type ValidationTier = 0 | 1 | 2;

/** Risk tolerance parameters derived from the personality + role combination. */
export interface RiskEnvelope {
  /** Maximum single-position size as fraction of portfolio (0.0 – 1.0). */
  readonly maxPositionFraction: number;
  /** Maximum drawdown before mandatory halt (0.0 – 1.0). */
  readonly maxDrawdownThreshold: number;
  /** Minimum edge in basis points before any trade is approved. */
  readonly minEdgeBps: number;
  /** Fractional Kelly multiplier (canonical: 0.25 for 25%). */
  readonly kellyFraction: number;
  /** Whether this agent can operate with real capital. */
  readonly capitalAuthorized: boolean;
}

/**
 * The complete compressed personality + operational envelope of a Sovereign agent.
 * Registered on-chain via EmergenceRecorder; referenced by all integrity layers.
 */
export interface AgentProfile {
  /** Unique agent identifier (on-chain address or deterministic UUID). */
  readonly agentId: string;

  /** Human-readable agent name. */
  readonly name: string;

  /** Assigned operational role. */
  readonly role: AgentRole;

  /**
   * PLEX personality archetype.
   * Optional in Phase 4; required in Phase 5 once all agents are onboarded
   * through a personality frame.
   */
  readonly archetype?: AgentArchetype;

  /** Psychometric vector — the agent's personality compression. */
  readonly bigFive: BigFiveVector;

  /** HEXACO integrity dimension. */
  readonly hexaco: HexacoHonestyHumility;

  /** Dark-side risk profile. */
  readonly hoganRisk: HoganRiskProfile;

  /** Validation tier — governs data rail eligibility and deployment scope. */
  readonly validationTier: ValidationTier;

  /** Operational risk envelope derived from personality + role. */
  readonly riskEnvelope: RiskEnvelope;

  /** On-chain address of the AgentProfile registration record (if mined). */
  readonly onChainAddress?: string;

  /**
   * History of constraint-boundary interactions.
   * Used by Dove to detect authentic vs. hollow convergence.
   */
  readonly constraintHistory?: readonly ConstraintInteraction[];

  /** ISO-8601 timestamp of profile registration. */
  readonly registeredAt: string;

  /** Human delegate address, if any. */
  readonly delegateAddress?: string;
}

/** A compact behavioral claim produced by an agent and submitted to EmergenceRecorder. */
export interface AgentBehavioralClaim {
  /** The agent who produced the claim. */
  readonly agentId: string;

  /** Unique claim identifier. */
  readonly claimId: string;

  /** ISO-8601 timestamp of the action this claim documents. */
  readonly actionTimestamp: string;

  /** Layer in which the action occurred. */
  readonly actionLayer: string;

  /** Human-readable description of the action. */
  readonly actionDescription: string;

  /** Dove flags active at time of action. */
  readonly doveFlagsActive: readonly string[];

  /** On-chain transaction hash if the claim has been mined. */
  readonly txHash?: string;

  /** IPFS or content-addressed URI of the full claim artifact. */
  readonly artifactUri?: string;
}

/**
 * Quantified personality diversity for a population of agents.
 * Used to operationalize Axiom 9: Plurality Without Mutual Exclusion.
 */
export interface PersonalityDiversityMetrics {
  /** Count of agents per archetype. */
  readonly archetypeDistribution: Readonly<Record<AgentArchetype, number>>;

  /**
   * Normalized Shannon entropy of the archetype distribution.
   * Range: 0.0 (monoculture) to 1.0 (perfectly uniform across all six archetypes).
   */
  readonly diversityIndex: number;

  /**
   * Ratio of the least-represented archetype count to the most-represented count.
   * Range: 0.0 (one archetype completely missing) to 1.0 (perfect balance).
   */
  readonly minRepresentationRatio: number;

  /** The archetype with the highest count, or null if the population is empty. */
  readonly dominantArchetype: AgentArchetype | null;

  /** True when diversityIndex meets or exceeds the configured plurality threshold. */
  readonly isPlural: boolean;
}

/**
 * A time-stamped snapshot of population-level personality plurality.
 * Produced by the Gnosis Integrity Layer for Dove monitoring.
 */
export interface PopulationDiversitySnapshot {
  /** Unique snapshot identifier. */
  readonly snapshotId: string;

  /** ISO-8601 timestamp of snapshot generation. */
  readonly generatedAt: string;

  /** Total agents included in the snapshot. */
  readonly populationSize: number;

  /** Diversity metrics for the population. */
  readonly metrics: PersonalityDiversityMetrics;

  /** The plurality threshold used to compute isPlural. */
  readonly threshold: number;
}
