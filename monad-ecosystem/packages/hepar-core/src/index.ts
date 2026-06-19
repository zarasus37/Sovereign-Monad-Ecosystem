import { runDefiAudit, type AuditOptions } from '@sovereign/hepar-defi-auditor';
import type { HeparAuditResult, SignalEvent } from '@sovereign/types';

export class HeparOrchestrator {
  /**
   * Run the full Stage A-D audit pipeline on a target contract.
   * Leverages hepar-defi-auditor for the underlying implementation.
   */
  static async runFullAudit(
    targetContract: string,
    chain = 'monad-mainnet',
    options?: AuditOptions
  ): Promise<SignalEvent<HeparAuditResult>> {
    console.log(`[HeparCore] Starting orchestrator for ${targetContract} on ${chain}`);
    
    // The runDefiAudit function internally emits 'hepar.audit.started' 
    // and 'hepar.audit.completed' on the sovereign-bus.
    const result = await runDefiAudit(targetContract, chain, options);
    
    console.log(`[HeparCore] Orchestrator completed for ${targetContract}. Result TVL Tier: ${result.payload.score.tvlTier}`);
    return result;
  }
}

export * from '@sovereign/hepar-defi-auditor';
