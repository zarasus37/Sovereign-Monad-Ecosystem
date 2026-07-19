/**
 * Executor — TOCTOU close: re-verify signature + TTL at *consume* time,
 * not decision time. A mandate that expired between approval and execution is refused.
 */

import { MandateIssuer } from './mandateIssuer.js';
import type { ExecutionApproved } from './types.js';

export type ExecuteResult =
  | { status: 'executed'; intentId: string; at: number }
  | { status: 'refused'; intentId: string; reasons: string[]; at: number };

export class Executor {
  constructor(private readonly issuer: MandateIssuer = new MandateIssuer()) {}

  /**
   * Consume an execution.approved event. Never trusts gate decision time alone.
   */
  execute(approved: ExecutionApproved, now: number = Date.now()): ExecuteResult {
    const v = this.issuer.verify(approved.mandate, now);
    if (!v.ok) {
      return {
        status: 'refused',
        intentId: approved.intentId,
        reasons: v.reasons.map((r) => `consume_time_${r}`),
        at: now,
      };
    }

    // Capital re-check at consume (mandate may still be valid but intent over ceiling)
    // Intent capital is not re-carried on approved event beyond mandate; enforce ceiling on action class
    if (
      (approved.action === 'live_execute' || approved.action === 'deploy_capital') &&
      approved.mandate.capitalCeilingUSD <= 0
    ) {
      return {
        status: 'refused',
        intentId: approved.intentId,
        reasons: ['consume_time_capital_ceiling_zero'],
        at: now,
      };
    }

    // Side effect would happen here (RPC, trade, etc.)
    return {
      status: 'executed',
      intentId: approved.intentId,
      at: now,
    };
  }
}
