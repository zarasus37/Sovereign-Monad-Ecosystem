/**
 * @sovereign/types — Canonical type contract for the Sovereign Monad Ecosystem.
 *
 * This is the single source of truth for all cross-layer data shapes.
 * Import from this package in any TypeScript package in the monorepo.
 *
 * @example
 * ```typescript
 * import type { SignalEvent, GnosisScore, DoveSignal } from '@sovereign/types';
 * ```
 */

// ── Signal Bus ──────────────────────────────────────────────────────────────
export type {
  SignalLayer,
  SignalEventType,
  EventSeverity,
  EventTrace,
  SignalEvent,
  PayloadOf,
} from './types/signal.js';

// ── Agent & Personality ──────────────────────────────────────────────────────
export type {
  BigFiveVector,
  HexacoHonestyHumility,
  HoganRiskProfile,
  AgentRole,
  AgentArchetype,
  ValidationTier,
  RiskEnvelope,
  ConstraintInteraction,
  AgentProfile,
  AgentBehavioralClaim,
  PersonalityDiversityMetrics,
  PopulationDiversitySnapshot,
} from './types/agent.js';

// ── Gnosis Integrity Layer ───────────────────────────────────────────────────
export type {
  StokesCoherenceVector,
  PulfrichParallax,
  DoctrineState,
  LaneLabel,
  GnosisScore,
} from './types/gnosis.js';

// ── Dove Conscience Protocol ─────────────────────────────────────────────────
export type {
  DoveTier,
  DriftCategory,
  DoveSignal,
  DoveHealthReport,
} from './types/dove.js';

// ── Hepar DeFi Auditor ───────────────────────────────────────────────────────
export type {
  FindingSeverity,
  HeparStage,
  HeparFinding,
  HeparStageSummary,
  HeparAuditScore,
  HeparAuditResult,
} from './types/hepar.js';

// ── Durable Event Log (Layer 5 audit trail) ─────────────────────────────────
export type {
  StoredEvent,
  DecisionChain,
  ReplayResult,
} from './types/event.js';

// ── Canonical Numerics (Layer 4a — single source of truth for thresholds) ──
// Typed mirror of shared/schemas/ttcl-numerics.json; parity-tested against it.
export type {
  OwnerRuntime,
  NumericEntry,
  NumericSection,
  TTCLNumerics,
} from './numerics.js';
export {
  TTCL_NUMERICS,
  // gnostic_engine
  FOCAL_LOCK_THRESHOLD,
  BOUNDARY_THRESHOLD,
  LANE_B_BLEND_RAW_WEIGHT,
  LANE_B_BLEND_VMASK_WEIGHT,
  LANE_C_KILL_RHCP_SPIN,
  LANE_C_KILL_HOST_RATIO,
  LANE_C_KILL_USER_RATIO,
  SPIN_EXPANDING_GATE,
  MAX_BLINKS,
  MAX_TVL_REFERENCE,
  // logoc_manifold
  MANIFOLD_WEIGHT_RING,
  MANIFOLD_WEIGHT_ANGLE,
  MANIFOLD_WEIGHT_HAMMING,
  MANIFOLD_MAX_DISTANCE,
  // ttcl_constitution
  CONSTITUTION_C1_TRIPARTITE_WEIGHT,
  CONSTITUTION_C2_LOGIC_COMPRESSION_WEIGHT,
  CONSTITUTION_C3_SOURCE_ALIGNED_WEIGHT,
  CONSTITUTION_C4_EPISTEMIC_HUMILITY_WEIGHT,
  CONSTITUTION_C5_NO_RLHF_SIGNAL_WEIGHT,
  CONSTITUTION_PASS_THRESHOLD,
  // ttcl_logoc_tier (Layer 7 — manifold-derived tier; TS mirrors for parity)
  LOGOC_TIER_NEIGHBOR_RADIUS,
  LOGOC_TIER_COHERENT_DENSITY_THRESHOLD,
  LOGOC_TIER_EMERGENT_DENSITY_THRESHOLD,
  LOGOC_TIER_COHERENT_LANE_B_WEIGHT,
  LOGOC_TIER_EMERGENT_LANE_B_WEIGHT,
  LOGOC_TIER_DIVERGENT_LANE_B_WEIGHT,
  // ttcl_pps
  PPS_STATIC_BAND,
  PPS_HEAP_BAND,
  PPS_VOLATILE_BAND,
  // gnosis_plurality
  PLURALITY_THRESHOLD,
  MIN_REPRESENTATION_GUARDRAIL,
  DOMINANT_MAJORITY_GUARDRAIL,
  HEALTHY_MIN_REPRESENTATION,
} from './numerics.js';

// ── Oracle / Risk Gnosis Engine ──────────────────────────────────────────────
export type {
  RegimeClass,
  OraclePosture,
  PriceFeedSnapshot,
  SpreadAnalysis,
  KellySizing,
  MonteCarloSummary,
  OracleRegime,
} from './types/oracle.js';

// ── Revenue Router ───────────────────────────────────────────────────────────
export type {
  RevenueSource,
  RevenueDestination,
  RevenueToken,
  RevenueEvent,
  RevenueDistribution,
  TreasurySnapshot,
} from './types/revenue.js';

// ── Emergence Protocol System ────────────────────────────────────────────────
export type {
  EmergenceObservationWindow,
  PatternEvidence,
  PatternStatus,
  EmergencePattern,
  EmergenceAccumulatorState,
} from './types/emergence.js';
