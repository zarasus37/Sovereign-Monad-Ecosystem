"""LOGOC trade event — Pydantic model for paper_execute journaling.

Mirrors @sovereign/gate-acl logocTrade.ts / shared/schemas/logoc-trade-event.json.
Includes EMA/liquidity price-logic fields for tier-1 allowed setups.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, model_validator

SetupTag = Literal[
    "liq_sweep_ema_reversal",
    "failed_break_trendline_fade",
    "session_liquidity_zone_fade",
    "other",
]
TrendContext = Literal[
    "up_trend_ema_stack",
    "down_trend_ema_stack",
    "range",
    "unknown",
]
LiquidityZoneType = Literal[
    "prior_day_high",
    "prior_day_low",
    "session_high",
    "session_low",
    "equal_highs",
    "equal_lows",
    "round_number",
    "trendline_cluster",
    "none",
]
LiquidityEvent = Literal["sweep", "failed_break", "acceptance", "none"]

TIER1_ALLOWED_SETUPS = frozenset(
    {
        "liq_sweep_ema_reversal",
        "failed_break_trendline_fade",
        "session_liquidity_zone_fade",
    }
)


class LOGOCTradeEvent(BaseModel):
    event_id: str = Field(..., description="UUID or hash for the event")
    timestamp: datetime

    principal_id: str
    agent_id: str
    domain: Literal["trading"] = "trading"
    tier: int = Field(..., ge=0)
    mode: Literal["paper", "live"] = "paper"

    instrument: str
    side: Literal["buy", "sell"]
    order_type: Literal["market", "limit", "stop"] = "limit"
    entry_price: float = Field(..., gt=0)
    stop_price: float = Field(..., gt=0)
    target_price: Optional[float] = Field(None, gt=0)

    synthetic_account_size: float = Field(..., gt=0)
    risk_per_trade_pct: float = Field(..., gt=0, le=0.02)
    account_risk_amount: float = Field(..., gt=0)
    position_size: float = Field(..., gt=0)
    position_notional: float = Field(..., gt=0)

    setup_tag: SetupTag
    entry_thesis: str
    session_context: Optional[str] = None
    timeframe: Optional[str] = None

    # EMA / liquidity price-logic
    trend_context: TrendContext = "unknown"
    liquidity_zone_type: Optional[LiquidityZoneType] = None
    liquidity_zone_price: Optional[float] = Field(None, gt=0)
    liquidity_event: Optional[LiquidityEvent] = None
    mm_behavior_hypothesis: Optional[str] = None
    structure_notes: Optional[str] = None

    emotional_state: Optional[str] = None
    cognitive_state: Optional[str] = None

    exit_price: Optional[float] = None
    exit_reason: Optional[str] = None
    realized_R: Optional[float] = None
    realized_pnl_synthetic: Optional[float] = None

    logoc_note: Optional[str] = None
    lesson: Optional[str] = None

    pl_score_delta: Optional[float] = None
    protocol_valid: Optional[bool] = None
    protocol_violations: Optional[list[str]] = None

    @model_validator(mode="after")
    def tier1_paper_risk(self) -> LOGOCTradeEvent:
        if self.tier == 1 and self.mode != "paper":
            raise ValueError("tier 1 requires mode=paper")
        if self.risk_per_trade_pct < 0.01 or self.risk_per_trade_pct > 0.02:
            raise ValueError("risk_per_trade_pct must be in [0.01, 0.02]")
        if self.tier >= 1 and self.mode == "paper":
            if self.setup_tag not in TIER1_ALLOWED_SETUPS and self.setup_tag != "other":
                raise ValueError(f"setup_tag not allowed at tier 1: {self.setup_tag}")
            if self.setup_tag in TIER1_ALLOWED_SETUPS and abs(self.risk_per_trade_pct - 0.01) > 1e-9:
                raise ValueError("tier-1 allowed setups require risk_per_trade_pct=0.01")
        return self


def position_size_units(
    *,
    side: Literal["buy", "sell"],
    entry: float,
    stop: float,
    synthetic_account: float,
    risk_pct: float,
) -> tuple[float, float, float]:
    """Return (account_risk_amount, position_size, position_notional)."""
    stop_dist = (entry - stop) if side == "buy" else (stop - entry)
    if stop_dist <= 0:
        raise ValueError("stop must be beyond entry")
    risk_amt = synthetic_account * risk_pct
    size = risk_amt / stop_dist
    notional = size * entry
    return risk_amt, size, notional
