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

// ── Peirce Manifold + semiotic primitives (Layer 3 — relocated from @sovereign/logoc) ──
// The 66-class Peirce manifold is the shared essence both TTCL (triadic unifying
// practice) and LOGOC (classifier) derive from, so it lives here in the contracts
// package. Codegen-fed: the class table is generated from
// shared/peirce-spec/peirce_sign_classes.json by gen-sign-types.mjs (no runtime
// fs/path). Drift-guarded by scripts/check-sign-types-drift.mjs.
export type { PragmatismBand, CoarseMode, PeirceSignature } from './peirce/models.js';
export { PeirceManifold, getManifold } from './peirce/manifold.js';
export type { PeirceSignClass } from './peirce/manifold.js';

// ── Canonical Numerics (Layer 3 codegen — single source of truth for thresholds) ──
// Generated from shared/schemas/ttcl-numerics.json by gen-sign-types.mjs;
// drift-guarded by scripts/check-sign-types-drift.mjs; semantic invariants held
// by monad-ecosystem/tests/integration/numerics-semantic.test.ts.
export type {
  OwnerRuntime,
  NumericEntry,
  NumericSection,
  TTCLNumerics,
} from './generated/numerics.js';
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
} from './generated/numerics.js';

// ── Sign-Event validators (Layer 3 codegen — Phase B) ───────────────────────
// Generated from shared/ttcl-specs/sign-events.json + shared/schemas/*.json by
// gen-ttcl-artifacts.mjs; drift-guarded by scripts/check-ttcl-artifacts-drift.mjs;
// positive + negative cases held by monad-ecosystem/tests/integration/schema-validators.test.ts.
// Build/test-only — NOT imported by runtime code (the bus keeps its hand-rolled
// validateIntentionTraceability; zero-runtime-deps invariant preserved).
export {
  validateTtclObservation,
  validateSignalEvent,
  validateGnosisScore,
  validateDoveSignal,
  validateHeparAuditResult,
} from './generated/sign-event-validators.js';

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

// ── Shaliah onboarding (Vector 1) ────────────────────────────────────────────
export type {
  OnboardingDomainType,
  CircuitNode,
  WireConnection,
  BehavioralTelemetryAction,
  BehavioralTelemetry,
  Phase1ProfileWeights,
  CognitiveTwinSeed,
  Phase1CompletionPayload,
  GenesisPlRecord,
  ShadowTradeStatus,
  ShadowRefusalReason,
  ShadowTradeUi,
  QuarantineUserAction,
  QuarantineTelemetry,
  Phase2CompletionPayload,
  ConstraintAxis,
  ConstraintBlock,
  ArchonAttack,
  InterrogationTelemetry,
  Phase3CompletionPayload,
} from './types/onboarding.js';

// ── PL ledger Kafka bridge (Vector 3) ────────────────────────────────────────
export type {
  PlOnboardingTaskId,
  PlPointsAwarded,
  PlVerifiedBy,
  PlLedgerKafkaEvent,
  PlPromoteClaim,
  PlTaskPayload,
  BrokenGenesisTaskPayload,
  QuarantineTaskPayload,
  ArchonTaskPayload,
  PlPromoteResult,
} from './types/pl-ledger.js';

// ── Wallet bind (Vector 3.2) ─────────────────────────────────────────────────
export type {
  WalletBindRequest,
  WalletBindKafkaPayload,
  WalletBindResult,
} from './types/wallet-bind.js';
export { WALLET_BIND_MESSAGE_PREFIX } from './types/wallet-bind.js';

// ── Cardia funding (Vector 3.3) ──────────────────────────────────────────────
export type {
  FundingStatus,
  FundingTier,
  FundingMandate,
  CardiaFundingKafkaEvent,
} from './types/cardia-funding.js';
export {
  CARDIA_FUNDING_TOPIC,
  TIER_1_FUNDING_USD,
} from './types/cardia-funding.js';
