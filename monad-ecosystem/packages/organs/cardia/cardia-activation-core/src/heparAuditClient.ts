/**
 * Hepar address audit client — hard gate before Cardia moves capital (Axiom 6).
 *
 * Mock-pass by default for tests/local. Wire real Hepar organ / sanctions API later.
 * Set HEPAR_AUDIT_FAIL_ADDRESSES=0xabc,0xdef for explicit fail list.
 */

export interface HeparAddressAuditResult {
  passed: boolean;
  reason: string;
  riskScore?: number;
  auditId: string;
}

export type HeparAuditFn = (
  walletAddress: string,
) => Promise<HeparAddressAuditResult>;

function failList(): Set<string> {
  const raw = process.env.HEPAR_AUDIT_FAIL_ADDRESSES || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Default mock auditor: pass unless address is on HEPAR_AUDIT_FAIL_ADDRESSES
 * or HEPAR_AUDIT_FORCE_FAIL=true.
 */
export async function auditAddress(
  walletAddress: string,
): Promise<HeparAddressAuditResult> {
  const addr = walletAddress.toLowerCase();
  const auditId = `hepar-audit-${Date.now().toString(36)}`;

  if (process.env.HEPAR_AUDIT_FORCE_FAIL === 'true') {
    return {
      passed: false,
      reason: 'HEPAR_AUDIT_FORCE_FAIL',
      riskScore: 1,
      auditId,
    };
  }

  if (failList().has(addr)) {
    return {
      passed: false,
      reason: 'address_on_fail_list',
      riskScore: 0.95,
      auditId,
    };
  }

  // Minimal shape check
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return {
      passed: false,
      reason: 'invalid_evm_address',
      riskScore: 1,
      auditId,
    };
  }

  return {
    passed: true,
    reason: 'mock_pass_clean_target',
    riskScore: 0.12,
    auditId,
  };
}

export const heparAuditClient = {
  auditAddress,
};
