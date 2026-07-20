/**
 * Phase 2 Communication Quarantine types.
 * Mirrors @sovereign/types onboarding shadow-market contract.
 */

export type TradeStatus =
  | "EXECUTED"
  | "SYSTEM_REFUSED"
  | "AGENT_PROPOSED"
  | "USER_HALTED"
  | "GENUINELY_BAD";

export type RefusalReason =
  | "T-REFUSAL-BUDGET"
  | "T-SOVEREIGNTY-DEBT"
  | "X-AUDITABILITY"
  | "X-CONSTRAINT-DENSITY"
  | "C-DENSITY-FLOOR"
  | "NONE";

export interface ShadowTrade {
  id: string;
  pool: string;
  yield: number;
  riskScore: number;
  status: TradeStatus;
  refusalReason?: RefusalReason;
  defectReason?: string;
  timestamp: number;
  /** UI: green row vs red row (GENUINELY_BAD displays green until halted). */
  display: "green" | "red";
}

export type QuarantineUserAction =
  | "HALT_EXECUTED"
  | "HALT_REFUSED"
  | "HALT_GENUINE_BAD"
  | "OBSERVE"
  | "NAME_REFUSAL";

export interface QuarantineTelemetry {
  tradeId: string;
  userAction: QuarantineUserAction;
  isCorrect: boolean;
  hcd1Delta: number;
  hcd2Delta: number;
  timestamp: number;
  meta?: Record<string, unknown>;
}

export interface Phase2Completion {
  comprehensionScore: number;
  hcd1Burden: number;
  hcd2Fidelity: number;
  telemetry: QuarantineTelemetry[];
  refuseNamed: boolean;
  correctGreenHalts: number;
  spuriousRedHalts: number;
}

/** Correct literacy signals needed to lift quarantine. */
export const PHASE2_PASS_THRESHOLD = 3;
