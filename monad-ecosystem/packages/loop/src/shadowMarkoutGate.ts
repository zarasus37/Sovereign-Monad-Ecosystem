/**
 * Shadow Markout Gate
 * 
 * Synchronous bridge between the TS execution engine and Python analytical engine.
 * Enforces the Fail-Closed Doctrine for live MEV trading.
 * 
 * Before executing any live trade, the engine MUST obtain a PASS verdict from this gate.
 */

import {
  type ShadowMarkoutRequest,
  type ShadowMarkoutResponse,
  type ShadowVerdict,
  SHADOW_API_URL,
  SHADOW_TIMEOUT_MS,
} from '@sovereign/types';

/** Default fail-closed response when the shadow engine is unavailable. */
function failClosedResponse(req: ShadowMarkoutRequest): ShadowMarkoutResponse {
  return {
    verdict: 'ERROR_SERVICE_UNAVAILABLE',
    expectedSlippage: 1.0, // 100% — assume total loss
    shadowProfitUsd: -req.amountInUsd, // Total loss
    auditId: `error-shadow-unavailable-${Date.now()}`,
  };
}

/**
 * Evaluates a proposed live trade against the Python Shadow Markout engine.
 * 
 * FAILS CLOSED: If the shadow engine is unavailable or times out, the trade is aborted.
 * 
 * @param req - The trade parameters to evaluate
 * @returns ShadowMarkoutResponse with verdict and profit estimate
 */
export async function evaluateShadowMarkout(
  req: ShadowMarkoutRequest,
): Promise<ShadowMarkoutResponse> {
  console.log(`[Shadow Gate] Evaluating trade on pool ${req.poolAddress}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHADOW_TIMEOUT_MS);

  try {
    const response = await fetch(SHADOW_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        pool_address: req.poolAddress,
        amount_in_usd: req.amountInUsd,
        is_buy: req.isBuy,
        pyth_price_update: req.pythPriceUpdate,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[Shadow Gate] API returned ${response.status}`);
      return failClosedResponse(req);
    }

    const result = await response.json() as ShadowMarkoutResponse;
    
    console.log(`[Shadow Gate] Verdict: ${result.verdict}, Profit: $${result.shadowProfitUsd}, Slippage: ${(result.expectedSlippage * 100).toFixed(2)}%`);
    
    return result;

  } catch (error: any) {
    clearTimeout(timeout);
    
    if (error.name === 'AbortError') {
      console.error(`[Shadow Gate] Timeout after ${SHADOW_TIMEOUT_MS}ms — aborting trade`);
    } else {
      console.error(`[Shadow Gate] Evaluation failed:`, error.message);
    }
    
    // FAIL CLOSED: Return error verdict
    return failClosedResponse(req);
  }
}

/**
 * Determines if the trade should proceed based on the shadow verdict.
 */
export function shouldProceedTrade(response: ShadowMarkoutResponse): boolean {
  return response.verdict === 'PASS';
}

/**
 * Human-readable verdict explanation for logging/UI.
 */
export function explainVerdict(verdict: ShadowVerdict): string {
  const explanations: Record<ShadowVerdict, string> = {
    'PASS': 'Trade is safe and mathematically profitable',
    'FAIL_ADVERSE_SELECTION': 'Sandwich attack detected — frontrunning risk',
    'FAIL_STALE_PRICE': 'Pyth price data is stale — oracle divergence risk',
    'FAIL_CAPACITY_EXCEEDED': 'Pool capacity insufficient for trade size',
    'ERROR_SERVICE_UNAVAILABLE': 'Shadow engine unreachable — failing closed',
  };
  return explanations[verdict] || 'Unknown verdict';
}