/**
 * ACL mandate issuer — short-TTL, HMAC-signed grants re-derived from live PL.
 * There is no permanent tier; every mandate must be reissued.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { scoreToTier, TIER_THRESHOLDS } from './plLedger.js';
import type {
  ACLMandate,
  ACLMode,
  ACLTier,
  PLDomain,
  PLState,
  RiskEnvelope,
} from './types.js';

/** Default mandate TTL: 15 minutes — forces re-derivation from live PL. */
export const MANDATE_TTL_MS = 15 * 60 * 1000;

const DEV_FALLBACK_SECRET = 'gate-acl-dev-only-not-for-production';

export function resolveSigningSecret(explicit?: string): string {
  const fromEnv = process.env.GATE_ACL_SIGNING_SECRET;
  const secret = explicit ?? fromEnv ?? DEV_FALLBACK_SECRET;
  if (!explicit && !fromEnv) {
    // Demo-only fallback — never silent in production configs
    console.warn(
      '[gate-acl] GATE_ACL_SIGNING_SECRET unset; using DEV fallback (not safe for real mandates)',
    );
  }
  return secret;
}

export interface TierSpec {
  tier: ACLTier;
  mode: ACLMode;
  capitalCeilingUSD: number;
  gasCeilingPerTx: number;
  toolsAllowlist: string[];
  riskEnvelope: RiskEnvelope;
}

/** Placeholder ceilings — calibrate before live capital. */
export const TIER_SPECS: Record<ACLTier, TierSpec> = {
  0: {
    tier: 0,
    mode: 'observe',
    capitalCeilingUSD: 0,
    gasCeilingPerTx: 0,
    toolsAllowlist: ['read_only_rpc'],
    riskEnvelope: { maxDrawdownPct: 0, maxConcurrentActions: 0 },
  },
  1: {
    tier: 1,
    mode: 'paper',
    capitalCeilingUSD: 0,
    gasCeilingPerTx: 0,
    toolsAllowlist: ['read_only_rpc', 'paper_execute'],
    riskEnvelope: { maxDrawdownPct: 100, maxConcurrentActions: 3 },
  },
  2: {
    tier: 2,
    mode: 'live',
    capitalCeilingUSD: 500,
    gasCeilingPerTx: 50,
    toolsAllowlist: ['read_only_rpc', 'paper_execute', 'live_execute'],
    // Daily loss ≈ 1.5% of $500 ($7.50 = 3 × 0.5% per-trade); max 5 live trades/day
    riskEnvelope: {
      maxDrawdownPct: 1.5,
      maxConcurrentActions: 2,
      maxRiskPctPerTrade: 0.005,
      dailyLossMultiplier: 3,
      maxTradesPerDay: 5,
      liveCapitalCeilingUSD: 500,
    },
  },
  3: {
    tier: 3,
    mode: 'live',
    capitalCeilingUSD: 50_000,
    gasCeilingPerTx: 500,
    toolsAllowlist: [
      'read_only_rpc',
      'paper_execute',
      'live_execute',
      'compile_constraints',
      'attach_tool',
    ],
    riskEnvelope: { maxDrawdownPct: 20, maxConcurrentActions: 8 },
  },
};

function canonicalBody(m: Omit<ACLMandate, 'signature'>): string {
  // Stable key order for signing
  return JSON.stringify({
    principalId: m.principalId,
    domain: m.domain,
    tier: m.tier,
    domains: m.domains,
    capitalCeilingUSD: m.capitalCeilingUSD,
    gasCeilingPerTx: m.gasCeilingPerTx,
    toolsAllowlist: m.toolsAllowlist,
    riskEnvelope: m.riskEnvelope,
    mode: m.mode,
    issuedAt: m.issuedAt,
    expiresAt: m.expiresAt,
  });
}

export function signMandate(
  body: Omit<ACLMandate, 'signature'>,
  secret: string,
): string {
  return createHmac('sha256', secret).update(canonicalBody(body)).digest('hex');
}

export function verifyMandateSignature(mandate: ACLMandate, secret: string): boolean {
  const expected = signMandate(
    {
      principalId: mandate.principalId,
      domain: mandate.domain,
      tier: mandate.tier,
      domains: mandate.domains,
      capitalCeilingUSD: mandate.capitalCeilingUSD,
      gasCeilingPerTx: mandate.gasCeilingPerTx,
      toolsAllowlist: mandate.toolsAllowlist,
      riskEnvelope: mandate.riskEnvelope,
      mode: mandate.mode,
      issuedAt: mandate.issuedAt,
      expiresAt: mandate.expiresAt,
    },
    secret,
  );
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(mandate.signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export class MandateIssuer {
  private readonly secret: string;
  private readonly ttlMs: number;

  constructor(opts?: { secret?: string; ttlMs?: number }) {
    this.secret = resolveSigningSecret(opts?.secret);
    this.ttlMs = opts?.ttlMs ?? MANDATE_TTL_MS;
  }

  /** Issue a fresh signed mandate from live PL (never reuse a permanent grant). */
  issueFromPL(state: PLState, now: number = Date.now()): ACLMandate {
    const tier = scoreToTier(state.score);
    const spec = TIER_SPECS[tier];
    const body: Omit<ACLMandate, 'signature'> = {
      principalId: state.principalId,
      domain: state.domain,
      tier,
      domains: [state.domain],
      capitalCeilingUSD: spec.capitalCeilingUSD,
      gasCeilingPerTx: spec.gasCeilingPerTx,
      toolsAllowlist: [...spec.toolsAllowlist],
      riskEnvelope: { ...spec.riskEnvelope },
      mode: spec.mode,
      issuedAt: now,
      expiresAt: now + this.ttlMs,
    };
    return {
      ...body,
      signature: signMandate(body, this.secret),
    };
  }

  /**
   * Provisional multi-domain issuance: max tier across states, union of domains,
   * max capital/gas ceilings, union of tools, widest risk envelope.
   *
   * TODO: replace with an explicit cross-domain policy (e.g. gate live capital
   * on the *weakest* domain, or require separate mandates per domain only).
   * Do not treat this as final product law.
   */
  issueUnionFromPLs(states: PLState[], now: number = Date.now()): ACLMandate {
    if (states.length === 0) {
      throw new Error('issueUnionFromPLs: empty states');
    }
    const principalId = states[0]!.principalId;
    for (const s of states) {
      if (s.principalId !== principalId) {
        throw new Error('issueUnionFromPLs: mixed principalIds');
      }
    }
    const tiers = states.map((s) => scoreToTier(s.score));
    const tier = Math.max(...tiers) as ACLTier;
    const spec = TIER_SPECS[tier];
    const domains = [...new Set(states.map((s) => s.domain))];
    // Primary domain = highest-scoring domain (stable sort by score desc)
    const primary = [...states].sort((a, b) => b.score - a.score)[0]!;
    const body: Omit<ACLMandate, 'signature'> = {
      principalId,
      domain: primary.domain,
      tier,
      domains,
      capitalCeilingUSD: spec.capitalCeilingUSD,
      gasCeilingPerTx: spec.gasCeilingPerTx,
      toolsAllowlist: [...spec.toolsAllowlist],
      riskEnvelope: { ...spec.riskEnvelope },
      mode: spec.mode,
      issuedAt: now,
      expiresAt: now + this.ttlMs,
    };
    return {
      ...body,
      signature: signMandate(body, this.secret),
    };
  }

  verify(mandate: ACLMandate, now: number = Date.now()): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];
    if (!verifyMandateSignature(mandate, this.secret)) {
      reasons.push('invalid_signature');
    }
    if (now > mandate.expiresAt) {
      reasons.push('mandate_expired');
    }
    if (now < mandate.issuedAt) {
      reasons.push('mandate_not_yet_valid');
    }
    return { ok: reasons.length === 0, reasons };
  }

  get thresholds(): typeof TIER_THRESHOLDS {
    return TIER_THRESHOLDS;
  }
}

export function domainFor(domain: PLDomain): PLDomain {
  return domain;
}
