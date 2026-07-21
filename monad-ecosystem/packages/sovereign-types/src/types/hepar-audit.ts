/**
 * Synchronous address forensic gate for Cardia funding (UMS Vector 4.4).
 *
 * Distinct from the full Stage A–D HeparAuditResult (hepar.ts) used by the
 * DeFi auditor organ — this is the lightweight PASS/FAIL verdict Cardia needs
 * before signing a Tier-1 transfer.
 */

/** Outcome of a funding-target address audit. */
export type HeparAuditVerdict =
  | 'PASS'
  | 'FAIL_SANCTIONED'
  | 'FAIL_MALICIOUS_CONTRACT'
  | 'FAIL_HIGH_RISK'
  | 'ERROR_SERVICE_UNAVAILABLE';

/** Context selects Hepar rulesets (e.g. Tier-1 capital deployment). */
export type HeparAuditContext = 'TIER_1_FUNDING';

export interface HeparAuditRequest {
  targetAddress: string;
  context: HeparAuditContext;
  /** Prior Cardia auditTrace for correlated forensics. */
  auditTrace?: string[];
}

export interface HeparAuditResponse {
  verdict: HeparAuditVerdict;
  /** 0.0 (clean) → 1.0 (maximum risk / fail-closed). */
  riskScore: number;
  /** e.g. ['contract_has_fallback', 'chainalysis_blacklist', 'hepar_timeout'] */
  flags: string[];
  /** Traceable audit id for Dove dispute trails. */
  auditId: string;
  /** Optional human reason (local stub / errors). */
  reason?: string;
}

export function isHeparPass(verdict: HeparAuditVerdict): boolean {
  return verdict === 'PASS';
}
