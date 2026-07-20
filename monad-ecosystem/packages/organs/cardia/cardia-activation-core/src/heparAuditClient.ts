/**
 * Hepar forensic gate client for Cardia funding (UMS Vector 4.4).
 *
 * Fail-Closed Doctrine: if Hepar is offline, times out, or returns non-OK,
 * funding is denied. Capital never enters an unverified dark space.
 *
 * Modes:
 *   HEPAR_AUDIT_MODE=http  (or HEPAR_API_URL set) → POST remote forensic API
 *   HEPAR_AUDIT_MODE=local (default when URL unset) → process-local rules
 *     (fail list / dead|beef / force fail) — honest staging without ML pipeline
 */

import type {
  HeparAuditRequest,
  HeparAuditResponse,
  HeparAuditVerdict,
} from '@sovereign/types';
import { isHeparPass } from '@sovereign/types';

const DEFAULT_HEPAR_URL = 'http://localhost:3002/api/v1/hepar';
const DEFAULT_TIMEOUT_MS = 5_000;

/** Legacy-shaped result used by older injectors; prefer HeparAuditResponse. */
export interface HeparAddressAuditResult {
  passed: boolean;
  reason: string;
  riskScore?: number;
  auditId: string;
  verdict?: HeparAuditVerdict;
  flags?: string[];
}

/** Injected auditor for tests — full forensic response. */
export type HeparFundingAuditFn = (
  req: HeparAuditRequest,
) => Promise<HeparAuditResponse>;

/**
 * @deprecated Prefer HeparFundingAuditFn. Still accepted by executeFunding via adapter.
 */
export type HeparAuditFn = (
  walletAddress: string,
) => Promise<HeparAddressAuditResult>;

function heparBaseUrl(): string {
  return (process.env.HEPAR_API_URL || DEFAULT_HEPAR_URL).replace(/\/$/, '');
}

function useHttpMode(): boolean {
  const mode = (process.env.HEPAR_AUDIT_MODE || '').toLowerCase();
  if (mode === 'local') return false;
  if (mode === 'http') return true;
  // Explicit URL → remote; otherwise local stub (tests/CI without mock server)
  return Boolean(process.env.HEPAR_API_URL);
}

function timeoutMs(): number {
  const n = Number(process.env.HEPAR_AUDIT_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
}

function failList(): Set<string> {
  const raw = process.env.HEPAR_AUDIT_FAIL_ADDRESSES || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

function serviceUnavailable(
  reason: string,
  flags: string[] = ['hepar_unavailable', 'fail_closed'],
): HeparAuditResponse {
  return {
    verdict: 'ERROR_SERVICE_UNAVAILABLE',
    riskScore: 1.0,
    flags,
    auditId: 'error-no-audit',
    reason,
  };
}

/**
 * Local forensic stub — same shape as remote, no network.
 * Fails on env deny-list, force-fail, invalid address, dead/beef hex markers.
 */
export function localHeparAudit(req: HeparAuditRequest): HeparAuditResponse {
  const addr = (req.targetAddress || '').toLowerCase();
  const auditId = `hepar-local-${Date.now().toString(36)}`;

  if (process.env.HEPAR_AUDIT_FORCE_FAIL === 'true') {
    return {
      verdict: 'FAIL_HIGH_RISK',
      riskScore: 1,
      flags: ['HEPAR_AUDIT_FORCE_FAIL', 'local_stub'],
      auditId,
      reason: 'HEPAR_AUDIT_FORCE_FAIL',
    };
  }

  if (!/^0x[a-f0-9]{40}$/.test(addr)) {
    return {
      verdict: 'FAIL_HIGH_RISK',
      riskScore: 1,
      flags: ['invalid_evm_address', 'local_stub'],
      auditId,
      reason: 'invalid_evm_address',
    };
  }

  if (failList().has(addr)) {
    return {
      verdict: 'FAIL_SANCTIONED',
      riskScore: 0.95,
      flags: ['address_on_fail_list', 'local_stub'],
      auditId,
      reason: 'address_on_fail_list',
    };
  }

  // Mock Hepar convention: dead/beef markers = malicious contract signature
  if (addr.includes('dead') || addr.includes('beef')) {
    return {
      verdict: 'FAIL_MALICIOUS_CONTRACT',
      riskScore: 0.95,
      flags: ['mock_malicious_signature', 'local_stub'],
      auditId,
      reason: 'mock_malicious_signature',
    };
  }

  return {
    verdict: 'PASS',
    riskScore: 0.05,
    flags: ['local_stub'],
    auditId,
    reason: 'local_pass_clean_target',
  };
}

/**
 * HTTP call to Hepar organ. Fail-closed on any transport / non-OK / parse error.
 */
export async function remoteHeparAudit(
  req: HeparAuditRequest,
): Promise<HeparAuditResponse> {
  const url = `${heparBaseUrl()}/audit-address`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const key = process.env.HEPAR_API_KEY;
    if (key) {
      headers.Authorization = `Bearer ${key}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        targetAddress: req.targetAddress,
        context: req.context,
        auditTrace: req.auditTrace ?? [],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error(
        `[Hepar Client] API returned ${response.status} for ${req.targetAddress}`,
      );
      return serviceUnavailable(`hepar_http_${response.status}`, [
        'hepar_http_error',
        'fail_closed',
        `status_${response.status}`,
      ]);
    }

    const data = (await response.json()) as Partial<HeparAuditResponse>;
    if (!data.verdict || typeof data.riskScore !== 'number' || !data.auditId) {
      return serviceUnavailable('hepar_malformed_response', [
        'hepar_malformed_response',
        'fail_closed',
      ]);
    }

    return {
      verdict: data.verdict,
      riskScore: data.riskScore,
      flags: Array.isArray(data.flags) ? data.flags : [],
      auditId: data.auditId,
      reason: data.reason,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[Hepar Client] Audit failed for ${req.targetAddress}:`,
      message,
    );
    const isAbort =
      (error instanceof Error && error.name === 'AbortError') ||
      /abort/i.test(message);
    return serviceUnavailable(message, [
      isAbort ? 'hepar_timeout' : 'hepar_fetch_error',
      'fail_closed',
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Primary entry: forensic audit of a funding target.
 * FAILS CLOSED when remote mode is selected and Hepar is unavailable.
 */
export async function auditAddressForFunding(
  req: HeparAuditRequest,
): Promise<HeparAuditResponse> {
  if (useHttpMode()) {
    return remoteHeparAudit(req);
  }
  return localHeparAudit(req);
}

/**
 * Convenience: audit wallet string (builds TIER_1_FUNDING request).
 * Maps to legacy HeparAddressAuditResult for older call sites.
 */
export async function auditAddress(
  walletAddress: string,
): Promise<HeparAddressAuditResult> {
  const response = await auditAddressForFunding({
    targetAddress: walletAddress,
    context: 'TIER_1_FUNDING',
  });
  return toLegacyResult(response);
}

export function toLegacyResult(
  response: HeparAuditResponse,
): HeparAddressAuditResult {
  return {
    passed: isHeparPass(response.verdict),
    reason: response.reason ?? response.verdict,
    riskScore: response.riskScore,
    auditId: response.auditId,
    verdict: response.verdict,
    flags: response.flags,
  };
}

export const heparAuditClient = {
  auditAddress,
  auditAddressForFunding,
  localHeparAudit,
  remoteHeparAudit,
};
