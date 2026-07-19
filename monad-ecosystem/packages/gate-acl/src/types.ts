/**
 * PL → ACL hard gate types (Shaliah load-bearing architecture).
 *
 * PL = derived, server-computed, domain-scoped competence — never self-report.
 * ACL = signed mandate object — not a model-size knob.
 * Gate lives on the bus (intent.raised → approved/rejected), same spirit as gateTtc.
 */

// ── Domains ──────────────────────────────────────────────────────────────────

export type PLDomain = 'trading' | 'defi_execution' | 'agent_ops' | (string & {});

// ── PL event components (append-only; only verifying services may emit) ─────

export type VerifiedBy =
  | 'comprehension-gate'
  | 'override-verifier'
  | 'task-verifier'
  | 'client'; // rejected by ledger — never trusted

export interface GateEvent {
  kind: 'comprehension_gate';
  eventId: string;
  principalId: string;
  domain: PLDomain;
  passed: boolean;
  /** Explain-back / quiz identifier */
  gateId: string;
  verifiedBy: VerifiedBy;
  at: number; // unix ms
}

export interface OverrideEvent {
  kind: 'valid_override';
  eventId: string;
  principalId: string;
  domain: PLDomain;
  /** Human caught a real agent error */
  agentErrorId: string;
  validated: boolean;
  verifiedBy: VerifiedBy;
  at: number;
}

export interface TaskEvent {
  kind: 'domain_task';
  eventId: string;
  principalId: string;
  domain: PLDomain;
  taskId: string;
  outcome: 'passed' | 'failed';
  verifiedBy: VerifiedBy;
  at: number;
}

/** Closed LOGOC paper trade (process-valid) — small PL credit toward tier 2. */
export interface LogocPaperTradePLEvent {
  kind: 'logoc_paper_trade';
  eventId: string;
  principalId: string;
  domain: PLDomain;
  tradeEventId: string;
  /** Points before decay (default 3.0) */
  points: number;
  /** Process quality 0–1 (win rate not required) */
  processScore: number;
  verifiedBy: VerifiedBy;
  at: number;
}

/** Daily review ritual completed with structured output. */
export interface DailyReviewPLEvent {
  kind: 'daily_review';
  eventId: string;
  principalId: string;
  domain: PLDomain;
  reviewDate: string;
  tradeCount: number;
  points: number;
  verifiedBy: VerifiedBy;
  at: number;
}

export type PLEvent =
  | GateEvent
  | OverrideEvent
  | TaskEvent
  | LogocPaperTradePLEvent
  | DailyReviewPLEvent;

export interface PLState {
  principalId: string;
  domain: PLDomain;
  /** 0–100, always re-derived from the event list + decay — never trusted as input */
  score: number;
  lastUpdated: number;
  components: {
    comprehensionGates: GateEvent[];
    validOverrides: OverrideEvent[];
    domainTasksCompleted: TaskEvent[];
    logocPaperTrades: LogocPaperTradePLEvent[];
    dailyReviews: DailyReviewPLEvent[];
  };
}

// ── ACL mandate ──────────────────────────────────────────────────────────────

export type ACLTier = 0 | 1 | 2 | 3;
export type ACLMode = 'observe' | 'paper' | 'live';

export interface RiskEnvelope {
  maxDrawdownPct: number;
  maxConcurrentActions: number;
}

export interface ACLMandate {
  principalId: string;
  domain: PLDomain;
  tier: ACLTier;
  domains: string[];
  capitalCeilingUSD: number;
  gasCeilingPerTx: number;
  toolsAllowlist: string[];
  riskEnvelope: RiskEnvelope;
  mode: ACLMode;
  issuedAt: number;
  expiresAt: number;
  /** HMAC of canonical mandate body (excludes signature field) */
  signature: string;
}

// ── Bus events ───────────────────────────────────────────────────────────────

export type IntentAction =
  | 'observe'
  | 'paper_execute'
  | 'live_execute'
  | 'compile_constraints'
  | 'attach_tool'
  | 'deploy_capital';

export interface IntentRaised {
  intentId: string;
  principalId: string;
  domain: PLDomain;
  action: IntentAction;
  tool?: string;
  capitalUSD?: number;
  raisedAt: number;
  /** Mandate the agent claims to be operating under */
  claimedMandate: ACLMandate;
}

export interface ExecutionApproved {
  intentId: string;
  principalId: string;
  domain: PLDomain;
  action: IntentAction;
  mandate: ACLMandate;
  approvedAt: number;
  gateReason: string;
}

export interface ExecutionRejected {
  intentId: string;
  principalId: string;
  domain: PLDomain;
  action: IntentAction;
  rejectedAt: number;
  reasons: string[];
  quarantine: true;
}

export type GateResult =
  | { status: 'approved'; event: ExecutionApproved }
  | { status: 'rejected'; event: ExecutionRejected };

// ── Topics (Kafka names; in-memory bus uses the same strings) ────────────────

export const TOPICS = {
  PL_EVENTS: 'pl.events',
  PL_STATE_UPDATED: 'pl.state.updated',
  INTENT_RAISED: 'intent.raised',
  EXECUTION_APPROVED: 'execution.approved',
  EXECUTION_REJECTED: 'execution.rejected',
  MANDATE_REISSUED: 'mandate.reissued',
} as const;

export type TopicName = (typeof TOPICS)[keyof typeof TOPICS];
