/**
 * Shaliah onboarding arc types (Vector 1 / SHALIAH_AGENTS §6.2).
 * UI + telemetry contract for Broken Genesis, Shadow Market, Archon gate.
 */

export type OnboardingDomainType = 'THEO' | 'TECHNO' | 'COSMO';

export interface CircuitNode {
  id: OnboardingDomainType;
  label: string;
  /** Current energy (0–100 UI scale). */
  energy: number;
  /** Capacity limit — exceed → C-ANTI-DILUTION (overload). */
  capacity: number;
  /** Floor — below → T-SOVEREIGNTY-DEBT (starvation). */
  floor: number;
}

export interface WireConnection {
  id: string;
  from: 'SOURCE' | OnboardingDomainType;
  to: 'SOURCE' | OnboardingDomainType;
  throughput: number;
}

export type BehavioralTelemetryAction =
  | 'SELECT'
  | 'DESELECT'
  | 'ROUTE'
  | 'INSPECT'
  | 'OVERLOAD'
  | 'STARVE'
  | 'STABILIZE';

export interface BehavioralTelemetry {
  nodeId: OnboardingDomainType | 'SOURCE';
  action: BehavioralTelemetryAction;
  timestamp: number;
  /** ms since previous action — HCD-5-style processing latency. */
  decisionLatency: number;
  meta?: Record<string, unknown>;
}

/** Energy-distribution profile compiled at Phase 1 complete (UMS). */
export interface Phase1ProfileWeights {
  theoWeight: number;
  technoWeight: number;
  cosmoWeight: number;
}

/** Cognitive Twin seed from observed routing (not self-report). */
export interface CognitiveTwinSeed {
  principalId: string;
  theoShare: number;
  technoShare: number;
  cosmoShare: number;
  /** HCD-3 proxy. */
  methodDiversity: number;
  /** HCD-4 proxy. */
  reasoningExposure: number;
  overloadCount: number;
  starveCount: number;
  meanDecisionLatencyMs: number;
  routeCounts: Record<OnboardingDomainType, number>;
  stabilizedAt: number;
  /** First envelope the principal "compiled" by stabilizing the circuit. */
  constraintEnvelopeVersion: string;
  profileWeights: Phase1ProfileWeights;
}

export interface Phase1CompletionPayload {
  twin: CognitiveTwinSeed;
  telemetry: BehavioralTelemetry[];
  nodes: CircuitNode[];
  profileWeights: Phase1ProfileWeights;
}

/** Local PL write after verified broken-genesis task (mirrors gate-acl TaskEvent). */
export interface GenesisPlRecord {
  kind: 'domain_task';
  eventId: string;
  principalId: string;
  domain: string;
  taskId: 'broken-genesis-repair';
  outcome: 'passed' | 'failed';
  /** Must be task-verifier after local structural verify — never 'client'. */
  verifiedBy: 'task-verifier' | 'client';
  at: number;
  constraintEnvelopeVersion: string;
  profileWeights: Phase1ProfileWeights;
}

// ── Phase 2: Communication Quarantine / Hepar Shadow Market ─────────────────

export type ShadowTradeStatus =
  | 'EXECUTED'
  | 'SYSTEM_REFUSED'
  | 'AGENT_PROPOSED'
  | 'USER_HALTED'
  | 'GENUINELY_BAD';

export type ShadowRefusalReason =
  | 'T-REFUSAL-BUDGET'
  | 'T-SOVEREIGNTY-DEBT'
  | 'X-AUDITABILITY'
  | 'X-CONSTRAINT-DENSITY'
  | 'C-DENSITY-FLOOR'
  | 'NONE';

export interface ShadowTradeUi {
  id: string;
  pool: string;
  yield: number;
  riskScore: number;
  status: ShadowTradeStatus;
  /** Constraint the system used to refuse (if SYSTEM_REFUSED). */
  refusalReason?: ShadowRefusalReason;
  /** Hidden defect for agent-missed bad trades (GENUINELY_BAD). */
  defectReason?: string;
  timestamp: number;
}

export type QuarantineUserAction =
  | 'HALT_EXECUTED'
  | 'HALT_REFUSED'
  | 'HALT_GENUINE_BAD'
  | 'OBSERVE'
  | 'NAME_REFUSAL';

export interface QuarantineTelemetry {
  tradeId: string;
  userAction: QuarantineUserAction;
  isCorrect: boolean;
  /** Δ HCD-1 Review Queue Burden (higher = noisier human). */
  hcd1Delta: number;
  /** Δ HCD-2 Override Fidelity (higher = better overrides). */
  hcd2Delta: number;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface Phase2CompletionPayload {
  comprehensionScore: number;
  hcd1Burden: number;
  hcd2Fidelity: number;
  telemetry: QuarantineTelemetry[];
  refuseNamed: boolean;
  correctGreenHalts: number;
  spuriousRedHalts: number;
}

// ── Phase 3: Archon Interrogation (Live Capital comprehension gate) ─────────

export type ConstraintAxis = 'T' | 'X' | 'C';

export interface ConstraintBlock {
  id: string;
  label: string;
  axis: ConstraintAxis;
  /** Semantic value injected into the audit_trace. */
  value: string;
}

export interface ArchonAttack {
  id: string;
  prompt: string;
  /** Exact sequence of constraint block IDs required to defeat this attack. */
  requiredSequence: string[];
  hint: string;
}

export interface InterrogationTelemetry {
  attackId: string;
  attemptedSequence: string[];
  passed: boolean;
  /** True if user tried free-text instead of semiotic blocks. */
  usedFreeText: boolean;
  timestamp: number;
}

export interface Phase3CompletionPayload {
  status: 'MESHALEACH_VERIFIED' | string;
  gatesPassed: number;
  telemetry: InterrogationTelemetry[];
  constraintEnvelopeVersion: string;
}
