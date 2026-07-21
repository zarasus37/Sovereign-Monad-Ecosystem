// ─── Stage B: Symbolic Proving ────────────────────────────────────────────────
//
// Attempts to prove invariant violations from Stage A findings.
// STUB mode: deterministic constraint solving based on finding severity.
// LIVE mode: hook in Mythril / Halmos / custom SMT solver here.

import type { StageBConfig, StageBResult, InvariantViolation, StageAResult } from './types/hepar.types';

const INVARIANT_MAP: Record<string, string> = {
  PROXY_ADMIN:        'admin_slot_integrity ∧ ¬upgrade_without_authority',
  LP_UNLOCK:          'liquidity_locked ∨ timelocked_withdrawal',
  WALLET_TAINT:       'address_reputation ≥ threshold',
  ADVERSARIAL_SIGNAL: 'call_graph_acyclicity ∧ ¬reentrancy_vector',
  BYTECODE_ANOMALY:   'bytecode_size ≤ threshold ∧ no_selfdestruct',
};

export class StageB {
  private readonly cfg: Required<StageBConfig>;

  constructor(cfg: StageBConfig = {}) {
    this.cfg = {
      timeoutPerInvariant: cfg.timeoutPerInvariant ?? 5000,
      allowStubMode: cfg.allowStubMode !== false,
    };
  }

  async prove(protocolId: string, stageAResult: StageAResult): Promise<StageBResult> {
    const t0 = Date.now();
    const violations: InvariantViolation[] = [];

    for (const finding of stageAResult.findings) {
      const invariant = INVARIANT_MAP[finding.pattern] ?? `unknown_invariant(${finding.pattern})`;

      // In STUB mode, high confidence + HIGH/CRITICAL findings are "proved" violated
      const proved =
        this.cfg.allowStubMode &&
        finding.confidence > 0.6 &&
        (finding.severity === 'HIGH' || finding.severity === 'CRITICAL');

      violations.push({
        findingId: finding.id,
        invariant,
        proved,
        confidence: proved ? finding.confidence * 0.9 : finding.confidence * 0.3,
        proofTerm: proved
          ? `STUB:refutation_trace(${finding.id})`
          : `STUB:inconclusive(${finding.id})`,
        severity: finding.severity,
      });
    }

    return {
      protocolId,
      violations,
      executionStatus: 'STUB',
      durationMs: Date.now() - t0,
    };
  }
}
