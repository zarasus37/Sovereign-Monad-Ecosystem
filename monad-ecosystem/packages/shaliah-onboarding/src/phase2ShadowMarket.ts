/**
 * Phase 2 — Communication Quarantine / Hepar Shadow Market.
 *
 * Sandbox trades: green = executed, red = system-refused (refusal budget).
 * User override panel. Spurious red overrides hurt HCD-1; correct green halt
 * raises HCD-2; naming the refuse reason graduates the phase.
 */

import { randomUUID } from 'node:crypto';
import type { OnboardingEvent } from './types.js';

export type TradeOutcome = 'executed' | 'system_refused' | 'genuinely_bad';

export interface ShadowTrade {
  readonly tradeId: string;
  readonly setupTag: string;
  readonly outcome: TradeOutcome;
  /** Why system refused (only for system_refused). */
  readonly refuseReason?: string;
  /** Why trade is actually bad (only for genuinely_bad). */
  readonly defectReason?: string;
}

export interface OverrideAttempt {
  readonly tradeId: string;
  readonly at: number;
}

export type OverrideClass =
  | 'spurious_red' // tried to "stop" already-refused
  | 'correct_green_halt' // halted genuinely_bad
  | 'false_green_halt' // halted healthy executed
  | 'unknown';

export interface ShadowMarketState {
  readonly principalId: string;
  trades: ShadowTrade[];
  overrides: OverrideAttempt[];
  classifications: OverrideClass[];
  refuseNamed: boolean;
  namedReason?: string;
  events: OnboardingEvent[];
  /** Index of next trade to reveal. */
  cursor: number;
}

/** Fixed didactic deck — not random (byte-reproducible demos). */
export const SHADOW_DECK: readonly Omit<ShadowTrade, 'tradeId'>[] = [
  {
    setupTag: 'liq_sweep_ema_reversal',
    outcome: 'executed',
  },
  {
    setupTag: 'failed_break_trendline_fade',
    outcome: 'system_refused',
    refuseReason: 'T-SOVEREIGNTY-DEBT: refusal budget floor after audit burst',
  },
  {
    setupTag: 'session_liquidity_zone_fade',
    outcome: 'executed',
  },
  {
    setupTag: 'liq_sweep_ema_reversal',
    outcome: 'system_refused',
    refuseReason: 'C-DENSITY-FLOOR: output_density 0.22 < 0.40',
  },
  {
    setupTag: 'unlisted_revenge_size',
    outcome: 'genuinely_bad',
    defectReason: 'revenge size + no pre-set stop; agent missed tilt pattern',
  },
  {
    setupTag: 'failed_break_trendline_fade',
    outcome: 'system_refused',
    refuseReason: 'X-CONSTRAINT-DENSITY: active constraints below floor',
  },
];

export function createShadowMarket(principalId: string): ShadowMarketState {
  return {
    principalId,
    trades: [],
    overrides: [],
    classifications: [],
    refuseNamed: false,
    events: [],
    cursor: 0,
  };
}

function push(
  state: ShadowMarketState,
  kind: OnboardingEvent['kind'],
  payload?: Record<string, unknown>,
  at = Date.now(),
): void {
  state.events.push({
    id: randomUUID(),
    kind,
    principalId: state.principalId,
    at,
    payload,
  });
}

/** Reveal next trade tick (agent "acts" silently). */
export function nextTrade(state: ShadowMarketState, now = Date.now()): ShadowTrade | null {
  if (state.cursor >= SHADOW_DECK.length) return null;
  const base = SHADOW_DECK[state.cursor]!;
  state.cursor += 1;
  const trade: ShadowTrade = { ...base, tradeId: `shd-${state.cursor}` };
  state.trades.push(trade);
  push(
    state,
    'phase2.trade_tick',
    {
      tradeId: trade.tradeId,
      outcome: trade.outcome,
      setupTag: trade.setupTag,
      // UI may show red/green; reasons hidden until inspection / graduation
      display: trade.outcome === 'system_refused' ? 'red' : 'green',
    },
    now,
  );
  return trade;
}

export function classifyOverride(trade: ShadowTrade): OverrideClass {
  if (trade.outcome === 'system_refused') return 'spurious_red';
  if (trade.outcome === 'genuinely_bad') return 'correct_green_halt';
  if (trade.outcome === 'executed') return 'false_green_halt';
  return 'unknown';
}

/** User hits override / halt on a trade. */
export function attemptOverride(
  state: ShadowMarketState,
  tradeId: string,
  now = Date.now(),
): OverrideClass {
  const trade = state.trades.find((t) => t.tradeId === tradeId);
  if (!trade) return 'unknown';
  state.overrides.push({ tradeId, at: now });
  const cls = classifyOverride(trade);
  state.classifications.push(cls);
  push(
    state,
    'phase2.override',
    { tradeId, classification: cls, outcome: trade.outcome },
    now,
  );
  return cls;
}

/**
 * User names why a red trade was refused (communication unlock).
 * Accepts free text with required concept tokens (stealth teaching check).
 */
export function nameRefusalReason(
  state: ShadowMarketState,
  tradeId: string,
  answer: string,
  now = Date.now(),
): { ok: boolean; missing: string[] } {
  const trade = state.trades.find((t) => t.tradeId === tradeId);
  if (!trade || trade.outcome !== 'system_refused') {
    return { ok: false, missing: ['system_refused_trade'] };
  }
  const n = answer.toLowerCase();
  // At least one doctrine family
  const families = [
    ['refusal', 'debt', 'sovereign'],
    ['density', 'dilut'],
    ['audit', 'constraint', 'envelope'],
  ];
  const hit = families.some((group) => group.some((tok) => n.includes(tok)));
  const missing = hit ? [] : ['refusal|density|audit concept'];
  if (hit) {
    state.refuseNamed = true;
    state.namedReason = answer.trim();
    push(
      state,
      'phase2.refusal_named',
      { tradeId, answer: state.namedReason },
      now,
    );
  }
  return { ok: hit, missing };
}

export function phase2Metrics(state: ShadowMarketState): {
  spuriousRedRate: number;
  correctHaltCount: number;
  falseHaltCount: number;
  graduated: boolean;
} {
  const o = state.classifications;
  const spurious = o.filter((c) => c === 'spurious_red').length;
  const correct = o.filter((c) => c === 'correct_green_halt').length;
  const falseH = o.filter((c) => c === 'false_green_halt').length;
  return {
    spuriousRedRate: o.length ? spurious / o.length : 0,
    correctHaltCount: correct,
    falseHaltCount: falseH,
    /** Graduates if they named a refuse reason OR correctly halted genuine bad */
    graduated: state.refuseNamed || correct >= 1,
  };
}
