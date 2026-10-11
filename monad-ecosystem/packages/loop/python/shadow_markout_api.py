"""
Shadow Markout Gate API

FastAPI wrapper around the Shadow Markout analytical engine.
Exposes the trade evaluation logic as a synchronous HTTP endpoint.

This is the "truth oracle" that the TS execution engine queries before
executing any live trade. The TS engine FAILS CLOSED if this service
is unavailable.

To integrate your existing shadow_markout_hardened.py:
  1. Copy your analyzer class/function into this package
  2. Wire it in the evaluate_trade() function below
  3. Run: uvicorn shadow_markout_api:app --port 8000
"""

import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional

app = FastAPI(
    title="Shadow Markout Gate",
    description="MEV trade validation — the final sanity check before execution",
    version="0.1.0",
)

# ─────────────────────────────────────────────────────────────────────────────
# Request/Response Models
# ─────────────────────────────────────────────────────────────────────────────

class MarkoutRequest(BaseModel):
    pool_address: str
    amount_in_usd: float
    is_buy: bool
    pyth_price_update: dict


class MarkoutResponse(BaseModel):
    verdict: str  # "PASS", "FAIL_ADVERSE_SELECTION", "FAIL_STALE_PRICE", "FAIL_CAPACITY_EXCEEDED"
    expected_slippage: float
    shadow_profit_usd: float
    audit_id: str

# ─────────────────────────────────────────────────────────────────────────────
# Shadow Markout Analyzer (Placeholder — wire your existing logic here)
# ─────────────────────────────────────────────────────────────────────────────

class ShadowMarkoutAnalyzer:
    """
    Wrapper around your shadow_markout_hardened.py logic.
    
    In production, this would import and call your existing analyzer:
        from shadow_markout_hardened import ShadowMarkoutAnalyzer as YourAnalyzer
    """
    
    def evaluate(
        self,
        pool: str,
        amount: float,
        is_buy: bool,
        pyth_data: dict,
    ) -> MarkoutResponse:
        """
        Evaluate a proposed trade against the shadow markout model.
        
        Returns PASS only if:
          - Price is not stale (within 60 seconds)
          - No adverse selection detected (sandwich risk < threshold)
          - Pool has sufficient capacity for the trade size
        """
        # ═══════════════════════════════════════════════════════════════════
        # TODO: Wire your existing shadow_markout_hardened.py logic here
        # ═══════════════════════════════════════════════════════════════════
        
        # Placeholder: simulate analysis
        price = pyth_data.get('price', 0)
        conf = pyth_data.get('conf', 0)
        
        # Simple heuristics for demonstration:
        # 1. Check price staleness
        publish_time = pyth_data.get('publishTime', 0)
        age_seconds = time.time() - publish_time
        is_stale = age_seconds > 60
        
        # 2. Check for adverse selection (simplified)
        # In production, you'd analyze MEV opportunity size
        adverse_selection = amount > 10000 and not is_buy  # Large sells are risky
        
        # 3. Check capacity (simplified)
        capacity_exceeded = amount > 50000  # Hard cap at $50k
        
        # Determine verdict
        if is_stale:
            verdict = "FAIL_STALE_PRICE"
            expected_slippage = 0.05
            shadow_profit_usd = -amount * expected_slippage
        elif adverse_selection:
            verdict = "FAIL_ADVERSE_SELECTION"
            expected_slippage = 0.03
            shadow_profit_usd = -amount * expected_slippage
        elif capacity_exceeded:
            verdict = "FAIL_CAPACITY_EXCEEDED"
            expected_slippage = 0.10
            shadow_profit_usd = -amount * expected_slippage
        else:
            verdict = "PASS"
            # Expected profit: small positive spread
            expected_slippage = 0.001  # 0.1%
            shadow_profit_usd = amount * 0.002  # 0.2% expected profit
        
        return MarkoutResponse(
            verdict=verdict,
            expected_slippage=expected_slippage,
            shadow_profit_usd=shadow_profit_usd,
            audit_id=f"shadow-{pool[-6:]}-{int(time.time())}",
        )


# Initialize analyzer
analyzer = ShadowMarkoutAnalyzer()

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
    
    This is the synchronous gate that the TS execution engine calls
    before every live trade. If this returns non-PASS, the TS engine
    aborts without signing.
    
    Flow:
      1. Validate Pyth price freshness
      2. Simulate sandwich attack impact
      3. Check pool capacity
      4. Return PASS/FAIL with profit estimate
    """
    try:
        result = analyzer.evaluate(
            pool=req.pool_address,
            amount=req.amount_in_usd,
            is_buy=req.is_buy,
            pyth_data=req.pyth_price_update,
        )
        
        return result
        
    except Exception as e:
        # FAIL CLOSED: Any analytical error aborts the trade
        raise HTTPException(
            status_code=500,
            detail={
                "error": "SHADOW_ENGINE_ERROR",
                "message": str(e),
                "verdict": "ERROR_SERVICE_UNAVAILABLE",
            },
        )


@app.get("/")
def root():
    """API root with documentation link."""
    return {
        "service": "Shadow Markout Gate",
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": {
            "evaluate": "POST /api/v1/shadow/evaluate",
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