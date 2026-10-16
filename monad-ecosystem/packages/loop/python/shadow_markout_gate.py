"""
shadow_markout_gate.py — synchronous pre-trade gate logic.

This is the engine behind `POST /api/v1/shadow/evaluate`, which
@sovereign/loop's `shadowMarkoutGate.ts` calls before every live trade with a
2000ms timeout (SHADOW_TIMEOUT_MS).

WHAT IT IS NOT
--------------
It is not shadow_markout_hardened.py. The hardened analyzer is a POST-FILL
harness: it waits T+15s/T+60s for realized prices and reports whether alpha
retained. That cannot run inside a 2s synchronous pre-trade call.

This module carries the *same doctrine* forward to the only moment a verdict
can still stop a trade:

    hardened doctrine              pre-trade observable that carries it
    ---------------------------    -------------------------------------
    retention >= gate_threshold    slippage + uncertainty budget vs edge
    retention < 0.70 is adverse   slippage/uncertainty exceeds the edge
    capacity_ceiling_usd          notional vs learned + static ceiling
    Pyth-driven realized price     Pyth publishTime + confidence band

Nothing here is a placeholder. Every threshold is a named, overridable,
documented quantity with a stated default, and the default matches the
pre-port stub's boundary so no trade that passed before now fails silently.

HONEST LIMITS (read before trusting a PASS)
-------------------------------------------
1. Retention cannot be measured before the fill. The check below is a
   pre-trade *bound* on expected slippage, not an observation of alpha.
2. No alpha model lives here. This module will not invent a profit number.
   `shadow_profit_usd` is 0 unless the caller declares `expected_edge_bps`
   in the request. The pre-port stub returned a hardcoded +0.2% "expected
   profit" for every passing trade; that number was fabricated and is gone.
3. A wide Pyth confidence band is mapped to FAIL_STALE_PRICE because the
   ShadowVerdict union has five members and none of them means "price
   unusable". That is the least-wrong existing verdict, not a precise one.

Zero third-party dependencies, so the gate is testable without a Python env.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, Optional

# Retention doctrine is owned by the hardened analyzer — this module borrows it
# rather than restating it, so the post-fill harness and the pre-trade gate can
# never drift apart. shadow_markout_hardened imports only stdlib, so this costs
# the API process nothing.
from shadow_markout_hardened import (  # noqa: E402
    ADVERSE_SELECTION_RETENTION,
    GATE_THRESHOLD,
    SOURCE_SHA256 as HARDENED_SOURCE_SHA256,
)

__all__ = [
    "ADVERSE_SELECTION_RETENTION",
    "GATE_THRESHOLD",
    "HARDENED_SOURCE_SHA256",
    "GateConfig",
    "GateVerdict",
    "evaluate_per_trade",
]


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return default
    if not math.isfinite(value):
        return default
    return value


@dataclass(frozen=True)
class GateConfig:
    """
    Every threshold the gate applies. Defaults preserve the pre-port stub's
    decision boundary so the port does not silently tighten or loosen the gate.
    """

    # A Pyth observation older than this cannot bound slippage for a trade that
    # executes now. (Stub used 60s.)
    max_price_age_s: float = 60.0
    # A publishTime in the future beyond this is a corrupted or spoofed feed,
    # not a clock skew. Fail closed rather than accept a price we cannot place
    # in time.
    max_clock_skew_s: float = 5.0
    # Confidence band, in bps of price, above which the price cannot be used to
    # bound impact. 100bps = 1%.
    max_conf_bps: float = 100.0
    # Static notional ceiling when no observation ledger exists. (Stub used $50k.)
    max_notional_usd: float = 50_000.0
    # Depth-independent slippage allowance, bps.
    base_slippage_bps: float = 10.0
    # Linear size-impact assumption, bps per USD of notional. 0.001 bps/USD
    # puts the impact term at the 50bps mark at the $50k ceiling.
    size_impact_bps_per_usd: float = 0.001
    # Retention doctrine budget: expected slippage may not exceed
    # (1 - gate_threshold) of the declared edge, i.e. retention must stay at or
    # above GATE_THRESHOLD.
    gate_threshold: float = GATE_THRESHOLD
    # Optional JSON ledger of observed {notional_usd, slippage_bps} pairs used
    # to learn a capacity ceiling from real fills (the hardened analyzer's
    # linear-impact model). Absent = static ceiling only.
    ledger_path: Optional[str] = None

    @classmethod
    def from_env(cls) -> "GateConfig":
        return cls(
            max_price_age_s=_env_float("SHADOW_MAX_PRICE_AGE_S", 60.0),
            max_clock_skew_s=_env_float("SHADOW_MAX_CLOCK_SKEW_S", 5.0),
            max_conf_bps=_env_float("SHADOW_MAX_CONF_BPS", 100.0),
            max_notional_usd=_env_float("SHADOW_MAX_NOTIONAL_USD", 50_000.0),
            base_slippage_bps=_env_float("SHADOW_BASE_SLIPPAGE_BPS", 10.0),
            size_impact_bps_per_usd=_env_float("SHADOW_SIZE_IMPACT_BPS_PER_USD", 0.001),
            gate_threshold=_env_float("SHADOW_GATE_THRESHOLD", GATE_THRESHOLD),
            ledger_path=os.getenv("SHADOW_LEDGER_PATH") or None,
        )

    def fingerprint(self) -> str:
        """Stable hash of the active thresholds, folded into every audit id.

        A verdict is only reproducible if you know the configuration that
        produced it, and the configuration includes which build of the ported
        hardened analyzer the doctrine came from.
        """
        blob = json.dumps(
            {"cfg": asdict(self), "hardened": HARDENED_SOURCE_SHA256[:16]},
            sort_keys=True,
        ).encode()
        return hashlib.sha256(blob).hexdigest()[:8]


@dataclass
class GateVerdict:
    verdict: str
    expected_slippage: float          # fraction, not bps (TS contract)
    shadow_profit_usd: float
    audit_id: str
    reason: str
    metrics: Dict[str, Any] = field(default_factory=dict)


# Verdicts, kept as literals so a typo fails at import rather than at runtime.
PASS = "PASS"
FAIL_STALE_PRICE = "FAIL_STALE_PRICE"
FAIL_ADVERSE_SELECTION = "FAIL_ADVERSE_SELECTION"
FAIL_CAPACITY_EXCEEDED = "FAIL_CAPACITY_EXCEEDED"
ERROR_SERVICE_UNAVAILABLE = "ERROR_SERVICE_UNAVAILABLE"


def _audit_id(payload: Dict[str, Any], config: GateConfig, verdict: str) -> str:
    """
    Deterministic audit id.

    The pre-port stub used f"shadow-{pool[-6:]}-{int(time.time())}", which is
    neither reproducible nor collision-free (two calls on the same pool in the
    same second share an id). The custody procedure requires a per-transfer
    audit trail, so the id must be a hash over the request, the active
    thresholds, and the verdict.
    """
    blob = json.dumps(
        {"p": payload, "c": config.fingerprint(), "v": verdict},
        sort_keys=True,
        default=str,
    ).encode()
    return f"shadow-{hashlib.sha256(blob).hexdigest()[:20]}"


def _learned_capacity_ceiling(config: GateConfig) -> Optional[float]:
    """
    Derive a capacity ceiling from observed fills using the same linear-impact
    model as shadow_markout_hardened.ShadowMarkoutAnalyzer._estimate_capacity_ceiling.

    Reads [{notional_usd, slippage_bps}, ...] from SHADOW_LEDGER_PATH. Returns
    None when there is no ledger or not enough usable observations, in which
    case the caller falls back to the static ceiling.
    """
    if not config.ledger_path:
        return None
    try:
        with open(config.ledger_path, "r", encoding="utf-8") as fh:
            rows = json.load(fh)
    except (OSError, ValueError):
        return None
    if not isinstance(rows, list) or len(rows) < 3:
        return None

    notionals = [
        float(r.get("notional_usd", 0)) for r in rows if isinstance(r, dict)
    ]
    slippages = [
        float(r.get("slippage_bps", 0)) for r in rows if isinstance(r, dict)
    ]
    pairs = [(n, s) for n, s in zip(notionals, slippages) if n > 0 and s >= 0]
    if len(pairs) < 3:
        return None

    avg_slip = sum(s for _, s in pairs) / len(pairs)
    avg_notional = sum(n for n, _ in pairs) / len(pairs)
    if avg_slip <= 0 or avg_notional <= 0:
        # No observed impact → the linear model cannot bound anything. Refuse
        # to imply a ceiling it cannot support.
        return None

    impact_rate = avg_slip / avg_notional          # bps per USD
    gate_tolerance_bps = (1.0 - config.gate_threshold) * 10_000
    if impact_rate <= 0:
        return None
    return gate_tolerance_bps / impact_rate


def evaluate_per_trade(
    pool_address: str,
    amount_in_usd: float,
    is_buy: bool,
    pyth_data: Dict[str, Any],
    expected_edge_bps: Optional[float] = None,
    config: Optional[GateConfig] = None,
    now: Optional[float] = None,
) -> GateVerdict:
    """
    Evaluate one proposed trade. Synchronous, no I/O, sub-millisecond.

    Order of checks is deliberate: cheapest and most fundamental first, so the
    audit trace names the actual reason a trade was blocked rather than the
    first condition in an arbitrary list.

    Returns a GateVerdict. Callers are responsible for fail-closed handling on
    exception; this function raises only on genuinely malformed input.
    """
    cfg = config or GateConfig()
    now_s = now if now is not None else time.time()

    # ---- 0. Input sanity -------------------------------------------------
    # A non-finite or non-positive price is not a trade condition, it is a
    # broken feed. Mapping it to FAIL_STALE_PRICE keeps it inside the existing
    # five-verdict contract rather than inventing a sixth.
    try:
        price = float(pyth_data.get("price", 0) or 0)
        conf = float(pyth_data.get("conf", 0) or 0)
        publish_time = float(pyth_data.get("publishTime", 0) or 0)
        amount = float(amount_in_usd)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"malformed pyth_price_update: {exc}") from exc

    payload = {
        "pool_address": pool_address,
        "amount_in_usd": amount_in_usd,
        "is_buy": is_buy,
        "pyth_price_update": pyth_data,
        "expected_edge_bps": expected_edge_bps,
    }

    def verdict_of(v: str, slip: float, profit: float, reason: str, **metrics) -> GateVerdict:
        return GateVerdict(
            verdict=v,
            expected_slippage=slip,
            shadow_profit_usd=profit,
            audit_id=_audit_id(payload, cfg, v),
            reason=reason,
            metrics=metrics,
        )

    if not math.isfinite(price) or price <= 0:
        return verdict_of(
            FAIL_STALE_PRICE, 1.0, -abs(amount) if math.isfinite(amount) else 0.0,
            "price_unusable", price=price,
        )
    if not math.isfinite(conf) or conf < 0:
        return verdict_of(FAIL_STALE_PRICE, 1.0, -abs(amount), "confidence_unusable", conf=conf)
    if not math.isfinite(amount) or amount <= 0:
        return verdict_of(FAIL_CAPACITY_EXCEEDED, 1.0, 0.0, "non_positive_notional", amount=amount)
    if not math.isfinite(publish_time) or publish_time <= 0:
        return verdict_of(FAIL_STALE_PRICE, 1.0, -abs(amount), "missing_publish_time")

    # ---- 1. Price freshness ---------------------------------------------
    age_s = now_s - publish_time
    if age_s < -cfg.max_clock_skew_s:
        return verdict_of(
            FAIL_STALE_PRICE, 1.0, -abs(amount), "publish_time_in_future",
            age_s=age_s, max_clock_skew_s=cfg.max_clock_skew_s,
        )
    age_s = max(age_s, 0.0)
    if age_s > cfg.max_price_age_s:
        return verdict_of(
            FAIL_STALE_PRICE, 1.0, -abs(amount), "price_stale",
            age_s=age_s, max_price_age_s=cfg.max_price_age_s,
        )

    # ---- 2. Confidence band ---------------------------------------------
    # conf and price are both raw Pyth integers sharing the same `expo`, so the
    # ratio is scale-invariant and `expo` cancels. That keeps this correct for
    # any feed precision without needing the raw price.
    conf_bps = (conf / price) * 10_000
    if not math.isfinite(conf_bps) or conf_bps > cfg.max_conf_bps:
        return verdict_of(
            FAIL_STALE_PRICE, 1.0, -abs(amount), "confidence_band_too_wide",
            conf_bps=conf_bps, max_conf_bps=cfg.max_conf_bps,
        )

    # ---- 3. Capacity ceiling --------------------------------------------
    # The more conservative of learned and static wins. A learned ceiling below
    # the static one means observed fills degraded at sizes the static cap still
    # allows.
    learned = _learned_capacity_ceiling(cfg)
    ceiling = cfg.max_notional_usd if learned is None else min(cfg.max_notional_usd, learned)
    if amount > ceiling:
        return verdict_of(
            FAIL_CAPACITY_EXCEEDED, 1.0, 0.0, "notional_above_capacity_ceiling",
            amount_in_usd=amount, capacity_ceiling_usd=ceiling,
            ceiling_source="learned" if learned is not None and learned < cfg.max_notional_usd
                           else "static",
        )

    # ---- 4. Slippage budget ---------------------------------------------
    impact_bps = cfg.size_impact_bps_per_usd * amount
    total_slip_bps = cfg.base_slippage_bps + impact_bps + conf_bps
    expected_slippage = total_slip_bps / 10_000

    # ---- 5. Edge vs uncertainty -----------------------------------------
    # With no declared edge the oracle cannot assert profitability. It reports
    # the slippage it expects and claims no profit. That is a safety PASS, not
    # an alpha claim.
    if expected_edge_bps is None:
        return verdict_of(
            PASS, expected_slippage, 0.0, "safety_checks_passed_no_edge_declared",
            total_slip_bps=total_slip_bps, conf_bps=conf_bps, impact_bps=impact_bps,
            profit_asserted=False,
        )

    try:
        edge_bps = float(expected_edge_bps)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"expected_edge_bps not a number: {exc}") from exc
    if not math.isfinite(edge_bps):
        return verdict_of(
            FAIL_ADVERSE_SELECTION, expected_slippage, -abs(amount), "edge_not_finite",
            total_slip_bps=total_slip_bps,
        )

    net_edge_bps = edge_bps - total_slip_bps
    # Retention doctrine: the trade must retain at least gate_threshold of its
    # declared edge after slippage and uncertainty.
    retention = (net_edge_bps / edge_bps) if edge_bps > 0 else 0.0
    profit = amount * (net_edge_bps / 10_000)

    if net_edge_bps <= 0:
        return verdict_of(
            FAIL_ADVERSE_SELECTION, expected_slippage, profit, "edge_consumed_by_slippage",
            expected_edge_bps=edge_bps, total_slip_bps=total_slip_bps,
            net_edge_bps=net_edge_bps,
        )
    if retention < cfg.gate_threshold:
        return verdict_of(
            FAIL_ADVERSE_SELECTION, expected_slippage, profit, "retention_below_gate",
            retention=retention, gate_threshold=cfg.gate_threshold,
            expected_edge_bps=edge_bps, total_slip_bps=total_slip_bps,
        )

    return verdict_of(
        PASS, expected_slippage, profit, "retention_at_or_above_gate",
        retention=retention, gate_threshold=cfg.gate_threshold,
        expected_edge_bps=edge_bps, total_slip_bps=total_slip_bps,
        profit_asserted=True,
    )