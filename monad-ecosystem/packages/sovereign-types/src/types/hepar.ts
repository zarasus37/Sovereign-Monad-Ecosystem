/**
 * HeparAuditResult — canonical output of the Hepar DeFi auditing organ.
 *
 * Hepar runs a 4-stage (A–D) zero-day protocol audit on DeFi contracts.
 * Stage A: privilege & access control analysis
 * Stage B: arithmetic & overflow analysis
 * Stage C: reentrancy & call-chain analysis
 * Stage D: economic & incentive integrity analysis
 *
 * Reference: monad-ecosystem/agents/monad-mev/README.md
 *            HEPAR_CORE_STATUS.md, SIX_ORGAN_UPGRADE_COMPLETION_SUMMARY
 */

import type { EventTrace } from './signal.js';

/** Severity classification for a single audit finding. */
export type FindingSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/** Audit stage identifiers. */
export type HeparStage = 'A' | 'B' | 'C' | 'D';

/** A single finding produced during one audit stage. */
export interface HeparFinding {
  /** Unique finding identifier within this audit. */
  readonly findingId: string;

  /** Stage in which this finding was produced. */
  readonly stage: HeparStage;

  /** Severity of the finding. */
  readonly severity: FindingSeverity;

  /** Category of vulnerability or concern. */
  readonly category:
    | 'privilege'
    | 'access-control'
    | 'arithmetic'
    | 'overflow'
    | 'reentrancy'
    | 'call-chain'
    | 'economic'
    | 'incentive'
    | 'governance'
    | 'state-consistency'
    | 'oracle-dependency'
    | 'liquidity-risk'
    | 'informational';

  /** Human-readable title of the finding. */
  readonly title: string;

  /** Detailed description of the vulnerability or concern. */
  readonly description: string;

  /** Contract address where the issue was identified (if determinable). */
  readonly contractAddress?: string;

  /** Function selector or name where the issue originates. */
  readonly functionName?: string;

  /** Recommended remediation action. */
  readonly recommendation: string;

  /** Evidence fragments (e.g. bytecode excerpts, call traces). */
  readonly evidence: readonly string[];
}

/** Per-stage audit summary. */
export interface HeparStageSummary {
  /** The stage that was run. */
  readonly stage: HeparStage;

  /** Whether this stage completed successfully. */
  readonly completed: boolean;

  /** Elapsed time for this stage in milliseconds. */
  readonly elapsedMs: number;

  /** Count of findings by severity in this stage. */
  readonly findingCounts: Record<FindingSeverity, number>;

  /** All findings produced in this stage. */
  readonly findings: readonly HeparFinding[];
}

/**
 * Hepar audit scoring — the composite institutional-grade score.
 * Used by Cardia allocation engine for dynamic allocation band decisions.
 */
export interface HeparAuditScore {
  /**
   * Overall audit score (0–100).
   * ≥ 85: Advisable for monitored allocation
   * 70–84: Elevated caution tier
   * < 70: Do not allocate
   */
  readonly overall: number;

  /** Stage-level scores (0–100 each). */
  readonly stageScores: Record<HeparStage, number>;

  /**
   * TVL tier of the audited protocol.
   * Feeds into Cardia's Dynamic Allocation Cap calculation.
   */
  readonly tvlTier: 'micro' | 'small' | 'mid' | 'large' | 'institutional';

  /**
   * Governance quality score (0–100).
   * Assessed during Stage D economic analysis.
   */
  readonly governanceScore: number;

  /**
   * Heuristic confidence multiplier (0.0–1.0).
   * Reflects completeness of available audit surface.
   */
  readonly heuristicConfidence: number;
}

/**
 * The full result of one Hepar audit run against a single protocol or contract set.
 * Emitted as a `hepar.audit.completed` SignalEvent payload.
 */
export interface HeparAuditResult {
  /** Unique audit run identifier. */
  readonly auditId: string;

  /** ISO-8601 timestamp when the audit was initiated. */
  readonly startedAt: string;

  /** ISO-8601 timestamp when the audit completed. */
  readonly completedAt: string;

  /** Primary contract address or protocol identifier being audited. */
  readonly target: string;

  /** Protocol name, if determinable. */
  readonly protocolName?: string;

  /** Chain identifier (e.g. 'monad-mainnet', 'ethereum-mainnet'). */
  readonly chain: string;

  /** Per-stage results, in order A → D. */
  readonly stages: readonly HeparStageSummary[];

  /** All findings aggregated across all stages. */
  readonly allFindings: readonly HeparFinding[];

  /** Composite scoring for Cardia allocation decisions. */
  readonly score: HeparAuditScore;

  /**
   * Allocation recommendation.
   * Derived from score.overall and the Cardia Dynamic Allocation Cap formula.
   */
  readonly allocationRecommendation: 'advisable' | 'caution' | 'do-not-allocate';

  /**
   * Suggested allocation cap for Cardia (in USD).
   * Range: $15,000 – $100,000 per MOF canonical parameters.
   * Null if allocationRecommendation is 'do-not-allocate'.
   */
  readonly suggestedAllocationCapUsd: number | null;

  /**
   * LightVerify certification status.
   * Pending until LightVerify signing is completed.
   */
  readonly lightVerifyCertification: 'pending' | 'certified' | 'failed';

  /** Whether a forensic report has been generated for this audit. */
  readonly forensicReportGenerated: boolean;

  /** URI to the forensic report artifact (if generated). */
  readonly forensicReportUri?: string;

  /**
   * Intention traceability metadata. Required by the bus when this result is the
   * payload of `hepar.audit.completed` / `hepar.audit.finding` events.
   * See docs/CHARTER.md §4.
   */
  readonly trace?: EventTrace;
}
