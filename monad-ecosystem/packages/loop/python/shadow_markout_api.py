"""
Shadow Markout Gate API

FastAPI wrapper around the Shadow Markout analytical engine. This is the
"truth oracle" the TS execution engine queries before executing any live
trade. The TS engine FAILS CLOSED if this service is unavailable.

CONSUMER
--------
monad-ecosystem/packages/loop/src/shadowMarkoutGate.ts
    evaluateShadowMarkout() → POST ${SHADOW_API_URL}
                              (default http://localhost:8000/api/v1/shadow/evaluate)
                              2000ms timeout, abort on overrun
    reads: verdict, expectedSlippage, shadowProfitUsd, auditId

PORT HISTORY
------------
Before 2026-10-16 this file's ShadowMarkoutAnalyzer was a heuristic stub:
"sells > $10k = adverse selection", "trades > $50k = capacity exceeded", and
a hardcoded +0.2% expected profit on every passing trade. The logic now lives
in shadow_markout_gate.evaluate_per_trade(), and the ported post-fill harness
is shadow_markout_hardened.py.

WIRE FORMAT
-----------
Request fields stay snake_case — that is what the TS gate sends.
Response fields are camelCase — that is what the TS gate reads.

The pre-port stub returned snake_case (`expected_slippage`,
`shadow_profit_usd`, `audit_id`) against a consumer that reads camelCase.
`verdict` matched by coincidence, so PASS/FAIL still gated correctly, but
`expectedSlippage` and `shadowProfitUsd` arrived as undefined on every live
trade: the gate logged NaN% slippage, and executionEngine's
`Math.max(0, shadow.shadowProfitUsd)` produced NaN gross yield. Fixed here
via the camelCase aliases below.

Run: uvicorn shadow_markout_api:app --host 0.0.0.0 --port 8000
"""

import time

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from shadow_markout_gate import (
    GateConfig,
    evaluate_per_trade,
    HARDENED_SOURCE_SHA256,
)

app = FastAPI(
    title="Shadow Markout Gate",
    description="MEV trade validation — the final sanity check before execution",
    version="1.0.0",
)

_config = GateConfig.from_env()


# ─────────────────────────────────────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────────────────────────────────────

class MarkoutRequest(BaseModel):
    # The TS gate posts snake_case; accept snake_case and camelCase alike so a
    # future consumer using either spelling is not rejected.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    pool_address: str
    amount_in_usd: float
    is_buy: bool
    pyth_price_update: dict
    # Optional. The oracle has no alpha model and will not invent one. Supply
    # the caller's declared edge to get a profit assertion; omit it and the
    # response carries profit_asserted=False with shadowProfitUsd=0.
    expected_edge_bps: float | None = None


class MarkoutResponse(BaseModel):
    # Serialized by alias → camelCase, which is what shadowMarkoutGate.ts reads.
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    verdict: str  # PASS | FAIL_ADVERSE_SELECTION | FAIL_STALE_PRICE | FAIL_CAPACITY_EXCEEDED
    expected_slippage: float
    shadow_profit_usd: float
    audit_id: str
    # Additive. The custody procedure needs a per-transfer reason, and the
    # numbers behind a verdict need to be auditable after the fact.
    reason: str = ""
    metrics: dict = Field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Health endpoint for load balancer / k8s probe."""
    return {
        "status": "ok",
        "service": "shadow-markout-gate",
        "timestamp": time.time(),
    }


@app.post("/api/v1/shadow/evaluate", response_model=MarkoutResponse)
async def evaluate_trade(req: MarkoutRequest):
    """
    Evaluate a proposed trade against the shadow markout model.

    This is the synchronous gate the TS execution engine calls before every
    live trade. If this returns non-PASS, the TS engine aborts without signing.

    Flow:
      1. Validate Pyth price freshness and confidence band
      2. Check the notional against the capacity ceiling (learned, else static)
      3. Bound expected slippage and compare it against the declared edge
      4. Return PASS/FAIL with the slippage and profit basis
    """
    try:
        result = evaluate_per_trade(
            pool_address=req.pool_address,
            amount_in_usd=req.amount_in_usd,
            is_buy=req.is_buy,
            pyth_data=req.pyth_price_update,
            expected_edge_bps=req.expected_edge_bps,
            config=_config,
        )
    except Exception as e:
        # FAIL CLOSED: Any analytical error aborts the trade. The TS gate also
        # fails closed on a non-2xx, so this is belt and braces.
        raise HTTPException(
            status_code=500,
            detail={
                "error": "SHADOW_ENGINE_ERROR",
                "message": str(e),
                "verdict": "ERROR_SERVICE_UNAVAILABLE",
            },
        )

    return MarkoutResponse(
        verdict=result.verdict,
        expected_slippage=result.expected_slippage,
        shadow_profit_usd=result.shadow_profit_usd,
        audit_id=result.audit_id,
        reason=result.reason,
        metrics=result.metrics,
    )


@app.get("/api/v1/shadow/config")
def gate_config():
    """
    Active gate thresholds and the pinned provenance of the ported analyzer.

    Exposed so an operator can see what the gate will actually enforce without
    reading the source, and so a verdict's config_fingerprint is traceable.
    """
    return {
        "hardened_source_sha256": HARDENED_SOURCE_SHA256,
        "config_fingerprint": _config.fingerprint(),
        "thresholds": {
            "max_price_age_s": _config.max_price_age_s,
            "max_clock_skew_s": _config.max_clock_skew_s,
            "max_conf_bps": _config.max_conf_bps,
            "max_notional_usd": _config.max_notional_usd,
            "base_slippage_bps": _config.base_slippage_bps,
            "size_impact_bps_per_usd": _config.size_impact_bps_per_usd,
            "gate_threshold": _config.gate_threshold,
            "ledger_path": _config.ledger_path,
        },
    }


@app.get("/")
def root():
    """API root with documentation link."""
    return {
        "service": "Shadow Markout Gate",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "evaluate": "POST /api/v1/shadow/evaluate",
            "config": "GET /api/v1/shadow/config",
            "health": "GET /health",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "shadow_markout_api:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )