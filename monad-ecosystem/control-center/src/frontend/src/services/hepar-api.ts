/**
 * hepar-api.ts
 *
 * Typed client for Hepar DeFi Auditor results consumed from the
 * gnostic-engine relay endpoint at /api/v1/hepar/latest.
 *
 * The gnostic-engine proxies Hepar audit results received via the
 * sovereign-bus event stream (Hepar → Bus → SSE).
 *
 * All types align with the @sovereign/types HeparAuditResult interface.
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const GNOSTIC_BASE_URL: string =
  import.meta.env.VITE_GNOSTIC_API_URL ?? "http://localhost:8001";

// ── Domain types ───────────────────────────────────────────────────────────────

/** A single audit finding entry within a HeparAuditResult stage. */
export interface AuditFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "informational";
  title: string;
  description: string;
  affected_contract?: string;
  line_reference?: string;
  remediation?: string;
}

/**
 * One stage result within a Hepar audit.
 * Maps to Stage A–D in the hepar-defi-auditor package.
 */
export interface AuditStageResult {
  /** A | B | C | D */
  stage: "A" | "B" | "C" | "D";
  stage_name: string;
  passed: boolean;
  score: number;
  findings: AuditFinding[];
  completed_at: string;
}

/**
 * HeparAuditResult — complete output for one audit session.
 * Aligned with @sovereign/types HeparAuditResult.
 */
export interface HeparAuditResult {
  audit_id: string;
  contract_address: string;
  chain_id: number;
  /** ADVISORY | ACTIVE | QUARANTINE | CLEARED */
  tier: "ADVISORY" | "ACTIVE" | "QUARANTINE" | "CLEARED";
  /** PENDING | IN_PROGRESS | COMPLETED | FAILED */
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  aggregate_risk: number;
  adversarial_risk: number;
  critical_findings_count: number;
  stages: AuditStageResult[];
  started_at: string;
  completed_at?: string;
  gnosis_verdict?: string;
  gnosis_structural_read?: number;
}

export interface LatestHeparResponse {
  audits: HeparAuditResult[];
  count: number;
  generated_at: string;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

class HeparApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HeparApiError";
  }
}

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${GNOSTIC_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new HeparApiError(res.status, `GET ${path} → ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Fetch the most recent Hepar audit results proxied through the gnostic-engine.
 * Returns an empty audits array when no results are available yet.
 */
export async function fetchLatestHeparAudits(
  limit = 10,
  signal?: AbortSignal,
): Promise<LatestHeparResponse> {
  return getJson<LatestHeparResponse>(`/api/v1/hepar/latest?limit=${limit}`, signal);
}
