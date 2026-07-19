import {
  runDefiAudit,
  runDefiAuditGated,
  type AuditOptions,
  type HeparAuditOutcome,
} from '@sovereign/hepar-defi-auditor';
import type { HeparAuditResult, SignalEvent } from '@sovereign/types';

export class HeparOrchestrator {
  /**
   * Run the full Stage A-D audit pipeline on a target contract.
   *
   * TTC hard gate runs inside `runDefiAudit` *before* any bus emit.
   * On gate failure this throws `TtcGateError` (no side effects).
   */
  static async runFullAudit(
    targetContract: string,
    chain = 'monad-mainnet',
    options?: AuditOptions,
  ): Promise<SignalEvent<HeparAuditResult>> {
    console.log(`[HeparCore] Starting orchestrator for ${targetContract} on ${chain}`);

    // Side-effect boundary is inside hepar-defi-auditor (gateTtc → then bus).
    const result = await runDefiAudit(targetContract, chain, options);

    console.log(
      `[HeparCore] Orchestrator completed for ${targetContract}. Result TVL Tier: ${result.payload.score.tvlTier}`,
    );
    return result;
  }

  /**
   * Non-throwing variant — returns `{ status: 'rejected', ttc }` when TTC fails.
   */
  static async runFullAuditGated(
    targetContract: string,
    chain = 'monad-mainnet',
    options?: AuditOptions,
  ): Promise<HeparAuditOutcome> {
    return runDefiAuditGated(targetContract, chain, options);
  }
}

export * from '@sovereign/hepar-defi-auditor';
