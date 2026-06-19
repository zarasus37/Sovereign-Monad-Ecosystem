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
  SignalEvent,
  PayloadOf,
} from './types/signal.js';

// ── Agent & Personality ──────────────────────────────────────────────────────
export type {
  BigFiveVector,
  HexacoHonestyHumility,
  HoganRiskProfile,
  AgentRole,
  ValidationTier,
  RiskEnvelope,
  AgentProfile,
  AgentBehavioralClaim,
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
