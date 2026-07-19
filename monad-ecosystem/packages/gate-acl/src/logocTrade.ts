/**
 * LOGOC_trade_event — canonical payload for every tier-1 paper_execute.
 *
 * Capital frame: fixed synthetic account (default $10_000).
 * Risk: max 1–2% of synthetic capital if stop is hit (tier-1 allowed setups force 1%).
 * Rules: defined setup, pre-set stop/target, no tilt/revenge size.
 * Price logic: EMA trend context + liquidity zone / sweep / MM hypothesis.
 *
 * TTCL: Theo (principal/agent, logoc_note) · Techno (prices, size, risk, structure) ·
 * Cosmo (tier, mode, PL placement).
 */

import { randomUUID } from 'node:crypto';

export const SYNTHETIC_ACCOUNT_DEFAULT = 10_000;
export const RISK_PCT_MIN = 0.01;
export const RISK_PCT_MAX = 0.02;
/** Tier-1 allowed EMA/liquidity setups force fixed 1% risk. */
export const TIER1_FIXED_RISK_PCT = 0.01;
/** Entry must be within ~0.3% of liquidity zone (retest, not chase). */
export const ZONE_RETEST_TOLERANCE = 0.003;

/**
 * Tier-2 live risk envelope (hard gate bounds).
 * On $500: 0.5% = $2.50/trade preferred max; daily loss = 3× = $7.50; max 5 trades/day.
 */
export const TIER2_LIVE_MAX_CAPITAL_USD = 500;
/** Preferred + enforced per-trade max risk fraction of live ceiling (0.5%). */
export const TIER2_LIVE_MAX_RISK_PCT_PER_TRADE = 0.005;
/** Absolute hard cap if a path still allows up to 1% (not preferred). */
export const TIER2_LIVE_RISK_PCT_HARD_MAX = 0.01;
/** @deprecated use TIER2_LIVE_RISK_PCT_HARD_MAX */
export const TIER2_LIVE_RISK_PCT_MAX = TIER2_LIVE_RISK_PCT_HARD_MAX;
/** @deprecated use TIER2_LIVE_MAX_RISK_PCT_PER_TRADE */
export const TIER2_LIVE_RISK_PCT_PREFERRED = TIER2_LIVE_MAX_RISK_PCT_PER_TRADE;
/** Daily loss limit = multiplier × max per-trade risk USD. */
export const TIER2_LIVE_DAILY_LOSS_MULTIPLIER = 3;
export const TIER2_LIVE_MAX_TRADES_PER_DAY = 5;

export type TradeSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit' | 'stop';
export type TradeMode = 'paper' | 'live';

export type SetupTag =
  | 'liq_sweep_ema_reversal'
  | 'failed_break_trendline_fade'
  | 'session_liquidity_zone_fade'
  | 'other';

export type TrendContext =
  | 'up_trend_ema_stack'
  | 'down_trend_ema_stack'
  | 'range'
  | 'unknown';

export type LiquidityZoneType =
  | 'prior_day_high'
  | 'prior_day_low'
  | 'session_high'
  | 'session_low'
  | 'equal_highs'
  | 'equal_lows'
  | 'round_number'
  | 'trendline_cluster'
  | 'none';

export type LiquidityEvent = 'sweep' | 'failed_break' | 'acceptance' | 'none';

/** Tier-1 locked setup tags (EMA-anchored liquidity). */
export const TIER1_ALLOWED_SETUPS: readonly SetupTag[] = [
  'liq_sweep_ema_reversal',
  'failed_break_trendline_fade',
  'session_liquidity_zone_fade',
] as const;

export const LONG_LIQUIDITY_ZONES: readonly LiquidityZoneType[] = [
  'prior_day_low',
  'session_low',
  'equal_lows',
  'round_number',
  'trendline_cluster',
] as const;

export const SHORT_LIQUIDITY_ZONES: readonly LiquidityZoneType[] = [
  'prior_day_high',
  'session_high',
  'equal_highs',
  'round_number',
  'trendline_cluster',
] as const;

/** Canonical LOGOC trade event (wire JSON). */
export interface LOGOCTradeEvent {
  event_id: string;
  timestamp: string;

  principal_id: string;
  agent_id: string;
  domain: 'trading';
  tier: number;
  mode: TradeMode;

  instrument: string;
  side: TradeSide;
  order_type: OrderType;
  entry_price: number;
  stop_price: number;
  target_price: number | null;

  synthetic_account_size: number;
  risk_per_trade_pct: number;
  account_risk_amount: number;
  position_size: number;
  position_notional: number;

  setup_tag: SetupTag | string;
  entry_thesis: string;
  session_context: string | null;
  timeframe: string | null;

  /** EMA / liquidity price-logic (tier-1 formal structure) */
  trend_context: TrendContext;
  liquidity_zone_type: LiquidityZoneType | null;
  liquidity_zone_price: number | null;
  liquidity_event: LiquidityEvent | null;
  mm_behavior_hypothesis: string | null;
  structure_notes: string | null;

  emotional_state: string | null;
  cognitive_state: string | null;

  exit_price: number | null;
  exit_reason: string | null;
  realized_R: number | null;
  realized_pnl_synthetic: number | null;
  /** Live realized P&L in USD when mode=live (audit; separate from synthetic paper). */
  realized_pnl_live: number | null;

  logoc_note: string | null;
  lesson: string | null;

  /** Suggested PL delta when process is valid (default 3.0) */
  pl_score_delta: number | null;

  /** Snapshot of risk envelope at entry (esp. tier-2 live). */
  risk_envelope: LiveRiskEnvelope | null;

  /** Protocol validation result (server-filled) */
  protocol_valid?: boolean;
  protocol_violations?: string[];
}

/** Auditable risk covenant attached to LOGOC / mandate snapshot. */
export interface LiveRiskEnvelope {
  tier: number;
  mode: TradeMode;
  live_capital_ceiling_usd: number;
  max_risk_pct_per_trade: number;
  daily_loss_limit_usd: number;
  max_trades_per_day: number;
}

/** Derived from journal: live closes for a calendar day. */
export interface LiveDailyStats {
  date: string; // YYYY-MM-DD
  live_pnl_today: number;
  live_trades_today: number;
  limit_hit: boolean;
  daily_loss_limit_usd: number;
  max_trades_per_day: number;
}

/** Intent payload fields for tier-2 live_execute risk checks. */
export interface LiveExecuteRiskIntent {
  capitalUSD: number;
  /** Planned stop risk in USD (account_risk_amount from sizing). */
  perTradeRiskUSD: number;
  /** Optional full LOGOC event for setup validation. */
  tradeEvent?: LOGOCTradeEvent | null;
}

export interface TradePlanInput {
  principal_id: string;
  agent_id: string;
  tier: number;
  mode?: TradeMode;
  instrument: string;
  side: TradeSide;
  order_type?: OrderType;
  entry_price: number;
  stop_price: number;
  target_price: number;
  synthetic_account_size?: number;
  risk_per_trade_pct?: number;
  setup_tag: SetupTag | string;
  entry_thesis: string;
  session_context?: string;
  timeframe?: string;
  trend_context?: TrendContext;
  liquidity_zone_type?: LiquidityZoneType | null;
  liquidity_zone_price?: number | null;
  liquidity_event?: LiquidityEvent | null;
  mm_behavior_hypothesis?: string | null;
  structure_notes?: string | null;
  emotional_state?: string;
  cognitive_state?: string;
}

export interface RiskSizing {
  synthetic_account_size: number;
  risk_per_trade_pct: number;
  account_risk_amount: number;
  stop_distance: number;
  position_size: number;
  position_notional: number;
}

// ── EMA / liquidity helpers ──────────────────────────────────────────────────

export function isEMABiasedUp(trend_context: string): boolean {
  return trend_context === 'up_trend_ema_stack';
}

export function isEMABiasedDown(trend_context: string): boolean {
  return trend_context === 'down_trend_ema_stack';
}

export function isValidLiquidityZoneForLong(zone: string | null | undefined): boolean {
  if (!zone) return false;
  return (LONG_LIQUIDITY_ZONES as readonly string[]).includes(zone);
}

export function isValidLiquidityZoneForShort(zone: string | null | undefined): boolean {
  if (!zone) return false;
  return (SHORT_LIQUIDITY_ZONES as readonly string[]).includes(zone);
}

export function isSweep(event: Pick<LOGOCTradeEvent, 'liquidity_event'>): boolean {
  return event.liquidity_event === 'sweep';
}

export function isNearZone(
  entry: number,
  zonePrice: number,
  tol: number = ZONE_RETEST_TOLERANCE,
): boolean {
  if (!(zonePrice > 0) || !(entry > 0)) return false;
  return Math.abs(entry - zonePrice) <= tol * zonePrice;
}

/**
 * Long liq_sweep_ema_reversal: up EMA stack, sweep of lows, retest entry, stop beyond sweep low, 1% risk.
 */
export function isValidEMALiquidityLongSetup(e: LOGOCTradeEvent): string[] {
  const v: string[] = [];
  if (e.setup_tag !== 'liq_sweep_ema_reversal') {
    v.push('setup_not_liq_sweep_ema_reversal');
    return v;
  }
  if (e.side !== 'buy') v.push('liq_sweep_long_requires_buy');
  if (!isEMABiasedUp(e.trend_context)) v.push('trend_not_up_ema_stack');
  if (!isValidLiquidityZoneForLong(e.liquidity_zone_type)) {
    v.push('liquidity_zone_invalid_for_long');
  }
  if (!isSweep(e)) v.push('liquidity_event_not_sweep');
  if (e.liquidity_zone_price == null || !(e.liquidity_zone_price > 0)) {
    v.push('liquidity_zone_price_required');
  } else if (!isNearZone(e.entry_price, e.liquidity_zone_price)) {
    v.push('entry_not_retest_near_zone');
  }
  v.push(...assertSetupRiskPct(e));
  if (e.liquidity_zone_price != null && !(e.stop_price < e.liquidity_zone_price)) {
    v.push('stop_must_be_beyond_sweep_low');
  }
  return v;
}

/** Paper: fixed 1%. Live tier≥2: ≤ 0.5% of live capital. */
function assertSetupRiskPct(e: LOGOCTradeEvent): string[] {
  const v: string[] = [];
  if (e.mode === 'live' && e.tier >= 2) {
    if (e.risk_per_trade_pct > TIER2_LIVE_MAX_RISK_PCT_PER_TRADE + 1e-9) {
      v.push('tier2_live_risk_exceeds_0_5pct');
    }
  } else if (Math.abs(e.risk_per_trade_pct - TIER1_FIXED_RISK_PCT) > 1e-9) {
    v.push('tier1_setup_requires_fixed_1pct_risk');
  }
  const expectedRisk = e.synthetic_account_size * e.risk_per_trade_pct;
  if (expectedRisk > 0 && Math.abs(e.account_risk_amount - expectedRisk) > expectedRisk * 0.02) {
    v.push('account_risk_not_equal_capital_times_pct');
  }
  return v;
}

/**
 * Short liq_sweep_ema_reversal: down EMA stack, sweep of highs, retest, stop beyond sweep high.
 */
export function isValidEMALiquidityShortSetup(e: LOGOCTradeEvent): string[] {
  const v: string[] = [];
  if (e.setup_tag !== 'liq_sweep_ema_reversal') {
    v.push('setup_not_liq_sweep_ema_reversal');
    return v;
  }
  if (e.side !== 'sell') v.push('liq_sweep_short_requires_sell');
  if (!isEMABiasedDown(e.trend_context)) v.push('trend_not_down_ema_stack');
  if (!isValidLiquidityZoneForShort(e.liquidity_zone_type)) {
    v.push('liquidity_zone_invalid_for_short');
  }
  if (!isSweep(e)) v.push('liquidity_event_not_sweep');
  if (e.liquidity_zone_price == null || !(e.liquidity_zone_price > 0)) {
    v.push('liquidity_zone_price_required');
  } else if (!isNearZone(e.entry_price, e.liquidity_zone_price)) {
    v.push('entry_not_retest_near_zone');
  }
  v.push(...assertSetupRiskPct(e));
  if (e.liquidity_zone_price != null && !(e.stop_price > e.liquidity_zone_price)) {
    v.push('stop_must_be_beyond_sweep_high');
  }
  return v;
}

/** failed_break_trendline_fade — break into liquidity fails and snaps back with EMA bias. */
export function isValidFailedBreakFade(e: LOGOCTradeEvent): string[] {
  const v: string[] = [];
  if (e.setup_tag !== 'failed_break_trendline_fade') {
    v.push('setup_not_failed_break_trendline_fade');
    return v;
  }
  if (e.liquidity_event !== 'failed_break' && e.liquidity_event !== 'sweep') {
    v.push('failed_break_requires_failed_break_or_sweep_event');
  }
  if (e.side === 'buy') {
    if (!isEMABiasedUp(e.trend_context)) v.push('fade_long_requires_up_ema_stack');
    if (!isValidLiquidityZoneForLong(e.liquidity_zone_type)) {
      v.push('liquidity_zone_invalid_for_long');
    }
  } else {
    if (!isEMABiasedDown(e.trend_context)) v.push('fade_short_requires_down_ema_stack');
    if (!isValidLiquidityZoneForShort(e.liquidity_zone_type)) {
      v.push('liquidity_zone_invalid_for_short');
    }
  }
  if (e.liquidity_zone_price == null) v.push('liquidity_zone_price_required');
  else if (!isNearZone(e.entry_price, e.liquidity_zone_price)) {
    v.push('entry_not_retest_near_zone');
  }
  v.push(...assertSetupRiskPct(e));
  return v;
}

/** session_liquidity_zone_fade — fade session H/L sweep with EMA bias. */
export function isValidSessionLiquidityFade(e: LOGOCTradeEvent): string[] {
  const v: string[] = [];
  if (e.setup_tag !== 'session_liquidity_zone_fade') {
    v.push('setup_not_session_liquidity_zone_fade');
    return v;
  }
  if (e.liquidity_zone_type !== 'session_high' && e.liquidity_zone_type !== 'session_low') {
    v.push('session_fade_requires_session_high_or_low');
  }
  if (!isSweep(e) && e.liquidity_event !== 'failed_break') {
    v.push('session_fade_requires_sweep_or_failed_break');
  }
  if (e.side === 'buy') {
    if (!isEMABiasedUp(e.trend_context)) v.push('session_fade_long_requires_up_ema');
    if (e.liquidity_zone_type !== 'session_low') v.push('session_fade_long_expects_session_low');
  } else {
    if (!isEMABiasedDown(e.trend_context)) v.push('session_fade_short_requires_down_ema');
    if (e.liquidity_zone_type !== 'session_high') v.push('session_fade_short_expects_session_high');
  }
  if (e.liquidity_zone_price == null) v.push('liquidity_zone_price_required');
  else if (!isNearZone(e.entry_price, e.liquidity_zone_price)) {
    v.push('entry_not_retest_near_zone');
  }
  v.push(...assertSetupRiskPct(e));
  return v;
}

/** Dispatch setup-specific EMA/liquidity validation for tier-1 paper. */
export function validateTier1SetupLogic(e: LOGOCTradeEvent): string[] {
  if (!(TIER1_ALLOWED_SETUPS as readonly string[]).includes(e.setup_tag)) {
    return [`setup_tag_not_allowed_at_tier1:${e.setup_tag}`];
  }
  if (e.setup_tag === 'liq_sweep_ema_reversal') {
    return e.side === 'buy'
      ? isValidEMALiquidityLongSetup(e)
      : isValidEMALiquidityShortSetup(e);
  }
  if (e.setup_tag === 'failed_break_trendline_fade') {
    return isValidFailedBreakFade(e);
  }
  if (e.setup_tag === 'session_liquidity_zone_fade') {
    return isValidSessionLiquidityFade(e);
  }
  return ['setup_tag_unknown'];
}

/** Same EMA/liquidity setup lock for tier-2 live (process continuity). */
export function validateTier2SetupLogic(e: LOGOCTradeEvent): string[] {
  return validateTier1SetupLogic(e).map((r) =>
    r.startsWith('setup_tag_not_allowed_at_tier1')
      ? r.replace('tier1', 'tier2')
      : r,
  );
}

/** Max USD risk per live trade under the preferred envelope. */
export function tier2MaxPerTradeRiskUSD(
  capitalCeiling: number = TIER2_LIVE_MAX_CAPITAL_USD,
): number {
  return capitalCeiling * TIER2_LIVE_MAX_RISK_PCT_PER_TRADE;
}

/** Daily loss limit USD = 3 × per-trade max risk. */
export function tier2DailyLossLimitUSD(
  capitalCeiling: number = TIER2_LIVE_MAX_CAPITAL_USD,
): number {
  return tier2MaxPerTradeRiskUSD(capitalCeiling) * TIER2_LIVE_DAILY_LOSS_MULTIPLIER;
}

/** Build auditable risk envelope snapshot for LOGOC / journal. */
export function buildLiveRiskEnvelope(
  tier: number,
  mode: TradeMode,
  capitalCeiling: number = TIER2_LIVE_MAX_CAPITAL_USD,
): LiveRiskEnvelope {
  return {
    tier,
    mode,
    live_capital_ceiling_usd: capitalCeiling,
    max_risk_pct_per_trade: TIER2_LIVE_MAX_RISK_PCT_PER_TRADE,
    daily_loss_limit_usd: tier2DailyLossLimitUSD(capitalCeiling),
    max_trades_per_day: TIER2_LIVE_MAX_TRADES_PER_DAY,
  };
}

/**
 * Tier-2 live risk gate: capital ceiling, per-trade risk, daily loss, max trades.
 * Same hardness as setup validity — limits close the path for the day.
 */
export function validateTier2LiveRisk(
  intent: LiveExecuteRiskIntent,
  dailyStats: Pick<LiveDailyStats, 'live_pnl_today' | 'live_trades_today'>,
  opts?: { capitalCeilingUSD?: number },
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const ceiling = opts?.capitalCeilingUSD ?? TIER2_LIVE_MAX_CAPITAL_USD;
  const maxRiskUSD = tier2MaxPerTradeRiskUSD(ceiling);
  const dailyLossLimitUSD = tier2DailyLossLimitUSD(ceiling);

  if (intent.capitalUSD > ceiling) {
    reasons.push('capital_ceiling_exceeded');
  }
  if (intent.capitalUSD <= 0) {
    reasons.push('capital_must_be_positive');
  }
  if (intent.perTradeRiskUSD > maxRiskUSD + 1e-9) {
    reasons.push('per_trade_risk_exceeded');
  }
  if (intent.perTradeRiskUSD <= 0) {
    reasons.push('per_trade_risk_required');
  }
  // Hard max 1% of ceiling (defense in depth if preferred is bypassed upstream)
  const hardMax = ceiling * TIER2_LIVE_RISK_PCT_HARD_MAX;
  if (intent.perTradeRiskUSD > hardMax + 1e-9) {
    reasons.push('per_trade_risk_hard_max_exceeded');
  }

  const currentLossUSD = Math.max(0, -dailyStats.live_pnl_today);
  if (currentLossUSD >= dailyLossLimitUSD - 1e-9) {
    reasons.push('daily_loss_limit_reached');
  }
  if (dailyStats.live_trades_today >= TIER2_LIVE_MAX_TRADES_PER_DAY) {
    reasons.push('max_trades_per_day_reached');
  }

  return { ok: reasons.length === 0, reasons };
}

/**
 * Full live_execute path: mandate tier/mode + risk envelope + EMA/liquidity setup.
 */
export function gateLiveExecute(
  intent: LiveExecuteRiskIntent,
  mandate: { tier: number; mode: string; capitalCeilingUSD: number },
  dailyStats: Pick<LiveDailyStats, 'live_pnl_today' | 'live_trades_today'>,
): { status: 'approved' | 'rejected'; reasons: string[] } {
  const reasons: string[] = [];

  if (mandate.tier < 2 || mandate.mode !== 'live') {
    reasons.push('tier_or_mode_invalid');
  }

  const ceiling = Math.min(mandate.capitalCeilingUSD, TIER2_LIVE_MAX_CAPITAL_USD);
  const riskCheck = validateTier2LiveRisk(intent, dailyStats, {
    capitalCeilingUSD: ceiling > 0 ? ceiling : TIER2_LIVE_MAX_CAPITAL_USD,
  });
  if (!riskCheck.ok) reasons.push(...riskCheck.reasons);

  if (intent.tradeEvent) {
    if (intent.tradeEvent.mode !== 'live') {
      reasons.push('live_execute_requires_mode_live_event');
    }
    const setup = validateTier2SetupLogic(intent.tradeEvent);
    if (setup.length) reasons.push(...setup);
  }

  return reasons.length === 0
    ? { status: 'approved', reasons: [] }
    : { status: 'rejected', reasons };
}

/** UTC calendar date YYYY-MM-DD from unix ms or ISO string. */
export function calendarDateUTC(at: number | string = Date.now()): string {
  if (typeof at === 'string') return at.slice(0, 10);
  return new Date(at).toISOString().slice(0, 10);
}

/**
 * Derive live daily aggregates from journal trade rows.
 * Counts closed live trades with realized_pnl_live (or live-mode realized_pnl_synthetic fallback).
 */
export function computeLiveDailyStats(
  trades: LOGOCTradeEvent[],
  date: string = calendarDateUTC(),
  capitalCeiling: number = TIER2_LIVE_MAX_CAPITAL_USD,
): LiveDailyStats {
  const closedLive = trades.filter((t) => {
    if (t.mode !== 'live') return false;
    if (t.exit_price == null) return false;
    const d = calendarDateUTC(t.timestamp);
    return d === date;
  });

  let live_pnl_today = 0;
  for (const t of closedLive) {
    if (t.realized_pnl_live != null) live_pnl_today += t.realized_pnl_live;
    else if (t.realized_pnl_synthetic != null) live_pnl_today += t.realized_pnl_synthetic;
  }

  const live_trades_today = closedLive.length;
  const daily_loss_limit_usd = tier2DailyLossLimitUSD(capitalCeiling);
  const currentLoss = Math.max(0, -live_pnl_today);
  const limit_hit =
    currentLoss >= daily_loss_limit_usd - 1e-9 ||
    live_trades_today >= TIER2_LIVE_MAX_TRADES_PER_DAY;

  return {
    date,
    live_pnl_today: Math.round(live_pnl_today * 100) / 100,
    live_trades_today,
    limit_hit,
    daily_loss_limit_usd,
    max_trades_per_day: TIER2_LIVE_MAX_TRADES_PER_DAY,
  };
}

// ── Risk math ────────────────────────────────────────────────────────────────

/** Stop distance in price units (always positive). */
export function stopDistance(
  side: TradeSide,
  entry: number,
  stop: number,
): number {
  if (side === 'buy') return entry - stop;
  return stop - entry;
}

/**
 * Standard risk-based position size:
 * account_risk_amount = capital × risk_pct
 * position_size (units) = account_risk_amount / stop_distance
 *
 * @param opts.allowLiveRisk — permit risk_pct down to live envelope (0.5%) instead of paper 1–2%.
 */
export function computePositionSizing(
  side: TradeSide,
  entry: number,
  stop: number,
  syntheticAccount: number = SYNTHETIC_ACCOUNT_DEFAULT,
  riskPct: number = RISK_PCT_MIN,
  opts?: { allowLiveRisk?: boolean },
): RiskSizing {
  const dist = stopDistance(side, entry, stop);
  if (dist <= 0) {
    throw new Error(
      `Invalid stop for ${side}: stop must be beyond entry (distance=${dist})`,
    );
  }
  if (opts?.allowLiveRisk) {
    if (riskPct <= 0 || riskPct > TIER2_LIVE_RISK_PCT_HARD_MAX + 1e-12) {
      throw new Error(
        `live risk_per_trade_pct ${riskPct} outside (0, ${TIER2_LIVE_RISK_PCT_HARD_MAX}]`,
      );
    }
  } else if (riskPct < RISK_PCT_MIN - 1e-12 || riskPct > RISK_PCT_MAX + 1e-12) {
    throw new Error(
      `risk_per_trade_pct ${riskPct} outside [${RISK_PCT_MIN}, ${RISK_PCT_MAX}]`,
    );
  }
  const account_risk_amount = syntheticAccount * riskPct;
  const position_size = account_risk_amount / dist;
  const position_notional = position_size * entry;
  return {
    synthetic_account_size: syntheticAccount,
    risk_per_trade_pct: riskPct,
    account_risk_amount,
    stop_distance: dist,
    position_size,
    position_notional,
  };
}

export function realizedR(
  side: TradeSide,
  entry: number,
  stop: number,
  exit: number,
): number {
  const risk = stopDistance(side, entry, stop);
  if (risk <= 0) return 0;
  const move = side === 'buy' ? exit - entry : entry - exit;
  return move / risk;
}

/** Build open (entry) LOGOC event with enforced risk math. */
export function buildEntryEvent(plan: TradePlanInput, now: Date = new Date()): LOGOCTradeEvent {
  const isLive = (plan.mode ?? 'paper') === 'live';
  const riskPct =
    plan.risk_per_trade_pct ??
    (isLive ? TIER2_LIVE_MAX_RISK_PCT_PER_TRADE : TIER1_FIXED_RISK_PCT);
  const account =
    plan.synthetic_account_size ??
    (isLive ? TIER2_LIVE_MAX_CAPITAL_USD : SYNTHETIC_ACCOUNT_DEFAULT);
  const sizing = computePositionSizing(
    plan.side,
    plan.entry_price,
    plan.stop_price,
    account,
    riskPct,
    { allowLiveRisk: isLive },
  );

  return {
    event_id: randomUUID(),
    timestamp: now.toISOString(),
    principal_id: plan.principal_id,
    agent_id: plan.agent_id,
    domain: 'trading',
    tier: plan.tier,
    mode: plan.mode ?? 'paper',
    instrument: plan.instrument,
    side: plan.side,
    order_type: plan.order_type ?? 'limit',
    entry_price: plan.entry_price,
    stop_price: plan.stop_price,
    target_price: plan.target_price,
    synthetic_account_size: sizing.synthetic_account_size,
    risk_per_trade_pct: sizing.risk_per_trade_pct,
    account_risk_amount: sizing.account_risk_amount,
    position_size: sizing.position_size,
    position_notional: sizing.position_notional,
    setup_tag: plan.setup_tag,
    entry_thesis: plan.entry_thesis,
    session_context: plan.session_context ?? null,
    timeframe: plan.timeframe ?? null,
    trend_context: plan.trend_context ?? 'unknown',
    liquidity_zone_type: plan.liquidity_zone_type ?? null,
    liquidity_zone_price: plan.liquidity_zone_price ?? null,
    liquidity_event: plan.liquidity_event ?? null,
    mm_behavior_hypothesis: plan.mm_behavior_hypothesis ?? null,
    structure_notes: plan.structure_notes ?? null,
    emotional_state: plan.emotional_state ?? null,
    cognitive_state: plan.cognitive_state ?? null,
    exit_price: null,
    exit_reason: null,
    realized_R: null,
    realized_pnl_synthetic: null,
    realized_pnl_live: null,
    logoc_note: null,
    lesson: null,
    pl_score_delta: 3.0,
    risk_envelope:
      (plan.mode ?? 'paper') === 'live' || plan.tier >= 2
        ? buildLiveRiskEnvelope(
            plan.tier,
            plan.mode ?? (plan.tier >= 2 ? 'live' : 'paper'),
            plan.mode === 'live' ? TIER2_LIVE_MAX_CAPITAL_USD : TIER2_LIVE_MAX_CAPITAL_USD,
          )
        : null,
  };
}

export function closeTrade(
  open: LOGOCTradeEvent,
  exit: { exit_price: number; exit_reason: string; logoc_note: string; lesson: string },
  now: Date = new Date(),
): LOGOCTradeEvent {
  const R = realizedR(open.side, open.entry_price, open.stop_price, exit.exit_price);
  const pnl = R * open.account_risk_amount;
  const pnlRounded = Math.round(pnl * 100) / 100;
  return {
    ...open,
    timestamp: now.toISOString(),
    exit_price: exit.exit_price,
    exit_reason: exit.exit_reason,
    realized_R: Math.round(R * 1000) / 1000,
    realized_pnl_synthetic: open.mode === 'paper' ? pnlRounded : open.realized_pnl_synthetic,
    realized_pnl_live: open.mode === 'live' ? pnlRounded : null,
    logoc_note: exit.logoc_note,
    lesson: exit.lesson,
  };
}

/**
 * Protocol rules for tier-1 paper_execute (+ EMA/liquidity setup lock).
 * Returns violation codes (empty = valid).
 */
export function validatePaperProtocol(
  event: LOGOCTradeEvent,
  session: {
    lastLossAt?: number | null;
    lastLossSize?: number | null;
    now?: number;
    cooldownMs?: number;
  } = {},
): string[] {
  const v: string[] = [];

  if (event.mode === 'paper') {
    if (event.tier < 1) {
      v.push('tier_insufficient_for_paper_execute');
    }
    if (Math.abs(event.synthetic_account_size - SYNTHETIC_ACCOUNT_DEFAULT) > 1e-6) {
      v.push('synthetic_account_must_be_fixed_10000');
    }
    if (
      event.risk_per_trade_pct < RISK_PCT_MIN - 1e-9 ||
      event.risk_per_trade_pct > RISK_PCT_MAX + 1e-9
    ) {
      v.push('risk_per_trade_pct_outside_1_to_2_percent');
    }
  } else if (event.mode === 'live') {
    if (event.tier < 2) {
      v.push('tier_insufficient_for_live_execute');
    }
  } else {
    v.push('mode_must_be_paper_or_live');
  }

  // Position risk math — paper uses 1–2%; live tier2 uses ≤0.5%
  if (event.mode === 'live' && event.tier >= 2) {
    if (
      event.risk_per_trade_pct <= 0 ||
      event.risk_per_trade_pct > TIER2_LIVE_MAX_RISK_PCT_PER_TRADE + 1e-9
    ) {
      v.push('risk_per_trade_pct_outside_live_envelope');
    }
  }

  // Rule 1 — defined setup
  if (!event.setup_tag?.trim()) v.push('rule1_missing_setup_tag');
  if (!event.entry_thesis || event.entry_thesis.trim().length < 20) {
    v.push('rule1_entry_thesis_too_thin');
  }

  // Rule 2 — pre-set stop and target + risk math
  if (!(event.entry_price > 0 && event.stop_price > 0)) {
    v.push('rule2_entry_stop_required');
  } else {
    const dist = stopDistance(event.side, event.entry_price, event.stop_price);
    if (dist <= 0) v.push('rule2_stop_not_beyond_entry');
    try {
      const expected = computePositionSizing(
        event.side,
        event.entry_price,
        event.stop_price,
        event.synthetic_account_size,
        event.risk_per_trade_pct,
        { allowLiveRisk: event.mode === 'live' },
      );
      const sizeTol = Math.abs(event.position_size - expected.position_size) / expected.position_size;
      if (sizeTol > 0.02) v.push('rule2_position_size_mismatch_risk_math');
      const riskTol =
        Math.abs(event.account_risk_amount - expected.account_risk_amount) /
        expected.account_risk_amount;
      if (riskTol > 0.02) v.push('rule2_account_risk_mismatch');
    } catch {
      v.push('rule2_risk_math_invalid');
    }
  }
  if (event.target_price == null || !(event.target_price > 0)) {
    v.push('rule2_target_required');
  } else if (event.side === 'buy' && event.target_price <= event.entry_price) {
    v.push('rule2_target_not_beyond_entry');
  } else if (event.side === 'sell' && event.target_price >= event.entry_price) {
    v.push('rule2_target_not_beyond_entry');
  }

  // Rule 3 — no tilt / revenge size after loss
  if (
    session.lastLossAt != null &&
    session.lastLossSize != null &&
    session.now != null
  ) {
    const cooldown = session.cooldownMs ?? 0;
    if (session.now - session.lastLossAt < cooldown && event.position_size > session.lastLossSize * 1.01) {
      v.push('rule3_revenge_size_after_loss');
    }
    if (event.position_size > session.lastLossSize * 1.01 && session.lastLossAt > 0) {
      if (session.now - session.lastLossAt < 4 * 60 * 60 * 1000) {
        v.push('rule3_size_increase_after_loss_forbidden');
      }
    }
  }

  // EMA / liquidity setup lock (paper tier ≥ 1 or live tier ≥ 2)
  if (event.mode === 'paper' && event.tier >= 1) {
    v.push(...validateTier1SetupLogic(event));
  } else if (event.mode === 'live' && event.tier >= 2) {
    v.push(...validateTier2SetupLogic(event));
  }

  // Tier-2 live: envelope risk (preferred 0.5% of live ceiling)
  if (event.mode === 'live' && event.tier >= 2) {
    if (event.risk_per_trade_pct > TIER2_LIVE_MAX_RISK_PCT_PER_TRADE + 1e-9) {
      v.push('tier2_live_risk_exceeds_0_5pct');
    }
    if (event.risk_per_trade_pct > TIER2_LIVE_RISK_PCT_HARD_MAX + 1e-9) {
      v.push('tier2_live_risk_exceeds_1pct');
    }
    const maxRiskUSD = tier2MaxPerTradeRiskUSD(TIER2_LIVE_MAX_CAPITAL_USD);
    if (event.account_risk_amount > maxRiskUSD + 1e-9) {
      v.push('tier2_live_account_risk_usd_exceeded');
    }
    if (
      event.synthetic_account_size > TIER2_LIVE_MAX_CAPITAL_USD + 1e-9 &&
      event.mode === 'live'
    ) {
      // Live sizing capital must not exceed ceiling (paper uses $10k synthetic).
      v.push('tier2_live_capital_above_ceiling');
    }
  }

  return v;
}

export function stampProtocol(
  event: LOGOCTradeEvent,
  session?: Parameters<typeof validatePaperProtocol>[1],
): LOGOCTradeEvent {
  const violations = validatePaperProtocol(event, session);
  return {
    ...event,
    protocol_valid: violations.length === 0,
    protocol_violations: violations,
  };
}
