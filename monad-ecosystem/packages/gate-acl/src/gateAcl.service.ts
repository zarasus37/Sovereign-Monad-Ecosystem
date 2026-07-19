/**
 * Gate ACL service — hard enforcement on the bus path.
 *
 * Checks: signature, TTL, tier, domain, mode, capital ceiling, tool allowlist.
 * compile_constraints (self-modification) requires tier 3 — agent cannot self-upgrade ACL.
 */

import { MandateIssuer } from './mandateIssuer.js';
import type {
  ExecutionApproved,
  ExecutionRejected,
  GateResult,
  IntentAction,
  IntentRaised,
} from './types.js';

const MODE_ALLOWS: Record<string, IntentAction[]> = {
  observe: ['observe'],
  paper: ['observe', 'paper_execute'],
  live: ['observe', 'paper_execute', 'live_execute', 'deploy_capital', 'attach_tool'],
};

export class GateAclService {
  constructor(private readonly issuer: MandateIssuer = new MandateIssuer()) {}

  /**
   * Gate an intent. Same failure mode as invalid Hepar audit: reject with no side effects.
   */
  gate(intent: IntentRaised, now: number = Date.now()): GateResult {
    const reasons: string[] = [];
    const m = intent.claimedMandate;

    // 1. Signature + TTL
    const v = this.issuer.verify(m, now);
    if (!v.ok) reasons.push(...v.reasons);

    // 2. Principal / domain bind
    if (m.principalId !== intent.principalId) {
      reasons.push('principal_mismatch');
    }
    if (m.domain !== intent.domain && !m.domains.includes(intent.domain)) {
      reasons.push('domain_not_in_mandate');
    }

    // 3. Action vs mode
    const allowedActions = MODE_ALLOWS[m.mode] ?? [];
    if (intent.action === 'compile_constraints') {
      // Literal rule: self-upgrade of constraint envelope requires tier 3
      if (m.tier < 3) {
        reasons.push('tier_insufficient_for_compile_constraints');
      }
    } else if (intent.action === 'live_execute' || intent.action === 'deploy_capital') {
      if (m.tier < 2 || m.mode !== 'live') {
        reasons.push('tier_insufficient');
      }
      if (!allowedActions.includes(intent.action) && intent.action === 'live_execute') {
        if (m.mode !== 'live') reasons.push('mode_forbids_live');
      }
    } else if (intent.action === 'paper_execute') {
      if (m.tier < 1 || (m.mode !== 'paper' && m.mode !== 'live')) {
        reasons.push('tier_insufficient');
      }
    } else if (intent.action === 'observe') {
      // always ok if mandate valid
    } else if (intent.action === 'attach_tool') {
      if (m.tier < 2) reasons.push('tier_insufficient');
    }

    // 4. Tool allowlist (when tool specified)
    if (intent.tool) {
      if (!m.toolsAllowlist.includes(intent.tool)) {
        reasons.push('tool_not_allowlisted');
      }
    } else if (intent.action === 'paper_execute' && !m.toolsAllowlist.includes('paper_execute')) {
      reasons.push('tool_not_allowlisted');
    } else if (intent.action === 'live_execute' && !m.toolsAllowlist.includes('live_execute')) {
      reasons.push('tool_not_allowlisted');
    }

    // 5. Capital ceiling at gate time (executor re-checks at consume)
    if (intent.capitalUSD != null && intent.capitalUSD > m.capitalCeilingUSD) {
      reasons.push('capital_ceiling_exceeded');
    }
    if (
      (intent.action === 'live_execute' || intent.action === 'deploy_capital') &&
      m.capitalCeilingUSD <= 0
    ) {
      reasons.push('capital_ceiling_zero');
    }

    if (reasons.length > 0) {
      const event: ExecutionRejected = {
        intentId: intent.intentId,
        principalId: intent.principalId,
        domain: intent.domain,
        action: intent.action,
        rejectedAt: now,
        reasons,
        quarantine: true,
      };
      return { status: 'rejected', event };
    }

    const event: ExecutionApproved = {
      intentId: intent.intentId,
      principalId: intent.principalId,
      domain: intent.domain,
      action: intent.action,
      mandate: m,
      approvedAt: now,
      gateReason: `tier=${m.tier} mode=${m.mode} tools=${m.toolsAllowlist.join(',')}`,
    };
    return { status: 'approved', event };
  }
}
