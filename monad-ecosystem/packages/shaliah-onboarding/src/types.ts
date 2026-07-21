/**
 * Onboarding arc domain types — Vector 1 / SHALIAH_AGENTS §6.2.
 * See docs/SHALIAH_ONBOARDING_ARC.md.
 */

export type OnboardingPhase = 'phase1_circuit' | 'phase2_shadow' | 'phase3_archon' | 'graduated';

export type TtcDomain = 'theological' | 'technological' | 'cosmological';

/** Observed routing bias from Phase 1 — seeds Cognitive Twin, not self-report. */
export interface CognitiveTwinSeed {
  readonly principalId: string;
  readonly theoShare: number;
  readonly technoShare: number;
  readonly cosmoShare: number;
  /** Normalized entropy of tool/path templates (HCD-3 proxy). */
  readonly methodDiversity: number;
  /** Fraction of wire acts preceded by inspecting a constraint label (HCD-4 proxy). */
  readonly reasoningExposure: number;
  readonly overloadCount: number;
  readonly starveCount: number;
  readonly stabilizedAt?: number;
}

export type OnboardingEventKind =
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
  | 'phase3.pass'
  | 'arc.graduate';

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
  events: OnboardingEvent[];
  phase2RefusalNamed: boolean;
  phase3Passed: boolean;
  graduatedAt?: number;
}

/** Structured Phase 3 refusal — free-text alone never graduates. */
export interface ArchonRefusal {
  readonly constraint_envelope_version: string;
  readonly audit_trace: string[];
  readonly failing_rule: string;
  readonly narrative?: string;
}

export interface GraduationResult {
  readonly graduated: boolean;
  readonly phase: OnboardingPhase;
  readonly missing: string[];
  readonly twin?: CognitiveTwinSeed;
}
