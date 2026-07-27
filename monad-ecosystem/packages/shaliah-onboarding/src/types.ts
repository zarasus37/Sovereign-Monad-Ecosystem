/**
 * Vector 1 onboarding domain types — Mutual Knowing & Communication Genesis.
 * Authority: docs/VECTOR1_ONBOARDING_REDESIGN.md · docs/SHALIAH_IDENTITY_V2.md
 *
 * Legacy phase1/2/3 puzzle types live under ./legacy/ (deprecated).
 */

/** Primary door phases (new approach). */
export type OnboardingPhase =
  | 'phase0_foundation'
  | 'phase_a_channel'
  | 'phase_b_read_mind'
  | 'phase_c_covenant'
  | 'graduated';

/** @deprecated Use OnboardingPhase — old puzzle arc */
export type LegacyOnboardingPhase =
  | 'phase1_circuit'
  | 'phase2_shadow'
  | 'phase3_archon'
  | 'graduated';

export type TtcDomain = 'theological' | 'technological' | 'cosmological';

/** Big Five (NEO-PI-3 / NEO-300-class) 0–1 normalized. */
export interface NeoBigFive {
  readonly openness: number;
  readonly conscientiousness: number;
  readonly extraversion: number;
  readonly agreeableness: number;
  readonly neuroticism: number;
}

/** Short Dark Triad modifiers 0–1 (never standalone moral brand). */
export interface Sd3Profile {
  readonly machiavellianism: number;
  readonly narcissism: number;
  readonly psychopathy: number;
}

/** Optional natal priors — opt-in only. */
export interface NatalPriors {
  readonly consented: true;
  readonly summary: string;
  readonly emphasis?: readonly string[];
}

export interface ImpartationFoundation {
  readonly principalId: string;
  readonly neo: NeoBigFive;
  readonly sd3: Sd3Profile;
  readonly natal?: NatalPriors;
  /** SHA-256 hex of payload for provenance. */
  readonly impartationHash: string;
  readonly completedAt: number;
}

/**
 * Cognitive Twin seed — foundation + observed method under Vector 1.
 * Behavior under challenge grounds / overwrites pure self-report.
 */
export interface CognitiveTwinSeed {
  readonly principalId: string;
  readonly foundation?: ImpartationFoundation;
  /** Observed command/repair method proxies */
  readonly methodDiversity: number;
  readonly reasoningExposure: number;
  readonly repairCount: number;
  readonly emotionUnderLoadNotes: readonly string[];
  readonly howTheyLearn?: string;
  readonly nextStretch?: string;
  readonly groundedAt?: number;
  /** @deprecated legacy circuit domain bias — only from phase1Circuit */
  readonly theoShare?: number;
  readonly technoShare?: number;
  readonly cosmoShare?: number;
  readonly overloadCount?: number;
  readonly starveCount?: number;
  readonly stabilizedAt?: number;
}

/** Agent thought-process layers (Phase B minimum). */
export interface AgentThoughtProcess {
  readonly goalReceived: string;
  readonly contextUsed: string;
  readonly optionsConsidered: readonly string[];
  readonly optionsDiscarded: readonly string[];
  readonly constraintsChecked: readonly { rule: string; result: 'pass' | 'refuse' | 'hedge' }[];
  readonly actionChosen: string;
  readonly expectedOutcome: string;
  readonly observedOutcome: string;
  readonly uncertainty: string;
  readonly wouldChangeMind: string;
}

export type ProcessStage =
  | 'sense'
  | 'select'
  | 'organize'
  | 'integrate'
  | 'act'
  | 'observe'
  | 'update';

export interface DualLoopStep {
  readonly human: ProcessStage;
  readonly agent: ProcessStage;
  readonly lit: boolean;
}

export type OnboardingEventKind =
  | 'phase0.impartation'
  | 'phase_a.command'
  | 'phase_a.repair'
  | 'phase_a.execute'
  | 'phase_a.dual_loop'
  | 'phase_b.agent_acted'
  | 'phase_b.reconstruction'
  | 'phase_b.critique'
  | 'phase_c.scenario'
  | 'phase_c.response'
  | 'phase_c.pass'
  | 'arc.graduate'
  // legacy kinds (still emitted if legacy modules used)
  | 'phase1.wire'
  | 'phase1.inspect'
  | 'phase1.overload'
  | 'phase1.starve'
  | 'phase1.stabilize'
  | 'phase2.trade_tick'
  | 'phase2.override'
  | 'phase2.refusal_named'
  | 'phase3.archon_prompt'
  | 'phase3.refusal_attempt'
  | 'phase3.pass';

export interface OnboardingEvent {
  readonly id: string;
  readonly kind: OnboardingEventKind;
  readonly principalId: string;
  readonly at: number;
  readonly payload?: Record<string, unknown>;
}

export interface ArcSession {
  readonly sessionId: string;
  readonly principalId: string;
  phase: OnboardingPhase;
  twin?: CognitiveTwinSeed;
  foundation?: ImpartationFoundation;
  events: OnboardingEvent[];
  phaseARepairs: number;
  phaseBPassed: boolean;
  phaseCPassed: boolean;
  graduatedAt?: number;
}

export interface GraduationResult {
  readonly graduated: boolean;
  readonly phase: OnboardingPhase;
  readonly missing: string[];
  readonly twin?: CognitiveTwinSeed;
}

/** @deprecated legacy Archon form support */
export interface ArchonRefusal {
  readonly constraint_envelope_version: string;
  readonly audit_trace: string[];
  readonly failing_rule: string;
  readonly narrative?: string;
}
