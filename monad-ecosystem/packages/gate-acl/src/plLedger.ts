/**
 * PL ledger — append-only events; score always re-derived with exponential decay.
 * Rejects any event where verifiedBy === 'client'.
 */

import type {
  GateEvent,
  OverrideEvent,
  PLDomain,
  PLEvent,
  PLState,
  TaskEvent,
} from './types.js';

/** Half-life for PL component contribution (ms). Default 30 days. */
export const PL_HALF_LIFE_MS = 30 * 24 * 60 * 60 * 1000;

/** Points per verified component kind (before decay). */
const POINTS = {
  comprehension_gate_pass: 15,
  valid_override: 12,
  domain_task_pass: 10,
} as const;

/** Placeholder tier thresholds (not calibrated to production competence). */
export const TIER_THRESHOLDS = {
  tier1: 25,
  tier2: 55,
  tier3: 80,
} as const;

function decayWeight(at: number, now: number, halfLifeMs: number): number {
  if (now <= at) return 1;
  const age = now - at;
  return Math.pow(0.5, age / halfLifeMs);
}

export class PLLedger {
  private readonly events = new Map<string, PLEvent[]>();
  private readonly halfLifeMs: number;

  constructor(opts?: { halfLifeMs?: number }) {
    this.halfLifeMs = opts?.halfLifeMs ?? PL_HALF_LIFE_MS;
  }

  private key(principalId: string, domain: PLDomain): string {
    return `${principalId}::${domain}`;
  }

  /**
   * Append a server-verified PL event. Client-emitted events throw.
   */
  append(event: PLEvent, now: number = Date.now()): PLState {
    if (event.verifiedBy === 'client') {
      throw new Error(
        `PLLedger: rejected event ${event.eventId} — verifiedBy=client is never trusted`,
      );
    }
    const k = this.key(event.principalId, event.domain);
    const list = this.events.get(k) ?? [];
    if (list.some((e) => e.eventId === event.eventId)) {
      // idempotent: return current state without double-count
      return this.compute(event.principalId, event.domain, now);
    }
    list.push(event);
    this.events.set(k, list);
    return this.compute(event.principalId, event.domain, now);
  }

  /** Always recompute from the append-only list — never trust a cached score field. */
  compute(principalId: string, domain: PLDomain, now: number = Date.now()): PLState {
    const list = this.events.get(this.key(principalId, domain)) ?? [];
    const comprehensionGates: GateEvent[] = [];
    const validOverrides: OverrideEvent[] = [];
    const domainTasksCompleted: TaskEvent[] = [];

    let raw = 0;
    for (const e of list) {
      const w = decayWeight(e.at, now, this.halfLifeMs);
      if (e.kind === 'comprehension_gate') {
        comprehensionGates.push(e);
        if (e.passed) raw += POINTS.comprehension_gate_pass * w;
      } else if (e.kind === 'valid_override') {
        if (e.validated) {
          validOverrides.push(e);
          raw += POINTS.valid_override * w;
        }
      } else if (e.kind === 'domain_task') {
        if (e.outcome === 'passed') {
          domainTasksCompleted.push(e);
          raw += POINTS.domain_task_pass * w;
        }
      }
    }

    const score = Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
    return {
      principalId,
      domain,
      score,
      lastUpdated: now,
      components: {
        comprehensionGates,
        validOverrides,
        domainTasksCompleted,
      },
    };
  }

  allEvents(principalId: string, domain: PLDomain): readonly PLEvent[] {
    return this.events.get(this.key(principalId, domain)) ?? [];
  }
}

export function scoreToTier(score: number): 0 | 1 | 2 | 3 {
  if (score >= TIER_THRESHOLDS.tier3) return 3;
  if (score >= TIER_THRESHOLDS.tier2) return 2;
  if (score >= TIER_THRESHOLDS.tier1) return 1;
  return 0;
}
