/**
 * Gate ACL service — hard enforcement on the bus path.
 *
 * Checks: signature, TTL, tier, domain, mode, capital ceiling, tool allowlist.
 * Tier-2 live_execute also enforces risk envelope (per-trade, daily loss, trade count)
 * and optional EMA/liquidity setup on tradeEvent.
 * compile_constraints (self-modification) requires tier 3 — agent cannot self-upgrade ACL.
 */

import { MandateIssuer } from './mandateIssuer.js';
import {
  TIER2_LIVE_MAX_CAPITAL_USD,
  gateLiveExecute,
  type LOGOCTradeEvent,
} from './logocTrade.js';
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

    // 6. Tier-2 live risk envelope — FAIL CLOSED (missing fields = reject)
    if (intent.action === 'live_execute' && m.tier >= 2 && m.mode === 'live') {
      if (intent.perTradeRiskUSD == null || !(intent.perTradeRiskUSD > 0)) {
        reasons.push('live_envelope_per_trade_risk_required');
      }
      if (intent.liveDailyStats == null) {
        reasons.push('live_envelope_daily_stats_required');
      }
      // tradeEvent optional but if absent we still gate risk numbers; setup not checked
      const capitalUSD = intent.capitalUSD ?? m.capitalCeilingUSD;
      const perTradeFromEvent =
        intent.tradeEvent &&
        typeof intent.tradeEvent === 'object' &&
        intent.tradeEvent !== null &&
        'account_risk_amount' in intent.tradeEvent
          ? Number((intent.tradeEvent as LOGOCTradeEvent).account_risk_amount)
          : undefined;
      const perTrade = intent.perTradeRiskUSD ?? perTradeFromEvent ?? -1;
      const daily = intent.liveDailyStats ?? {
        live_pnl_today: 0,
        live_trades_today: 0,
      };
      const liveGate = gateLiveExecute(
        {
          capitalUSD,
          perTradeRiskUSD: perTrade,
          tradeEvent: (intent.tradeEvent as LOGOCTradeEvent | undefined) ?? null,
        },
        {
          tier: m.tier,
          mode: m.mode,
          capitalCeilingUSD: Math.min(
            m.capitalCeilingUSD,
            m.riskEnvelope.liveCapitalCeilingUSD ?? TIER2_LIVE_MAX_CAPITAL_USD,
          ),
        },
        daily,
      );
      if (liveGate.status === 'rejected') {
        for (const r of liveGate.reasons) {
          if (r === 'capital_ceiling_exceeded' && reasons.includes(r)) continue;
          if (r === 'tier_or_mode_invalid' && reasons.includes('tier_insufficient')) continue;
          if (r === 'per_trade_risk_required' && reasons.includes('live_envelope_per_trade_risk_required')) {
            continue;
          }
          reasons.push(r);
        }
      }
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
