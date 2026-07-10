# monad_price_fetcher.py
# ProviderPool-backed Monad RPC price fetcher for shadow_markout_hardened.py
#
# Providers confirmed mainnet (November 2025 launch):
#   - Alchemy  : rpc1.monad.xyz  (official Monad docs)
#   - QuickNode: managed endpoints, testnet + mainnet
#   - dRPC     : public + NodeCloud, launch-day ready
#   - Chainstack, BlockPI, Triton: also confirmed mainnet
#
# x402 Integration (NEW):
#   QuickNode x402 provides wallet-authenticated, pay-per-request access
#   with 1,000,000 free credits/month per wallet. No API key. No rate limits.
#   Set X402_JWT_TOKEN to use x402 as the primary provider.
#
#   To get a JWT token:
#     1. Install the SDK (outside the repo):  npm install @quicknode/x402 dotenv
#        then set X402_SDK_NODE_PATH to that node_modules dir (npm can't install
#        inside this pnpm workspace — see README "One-time SDK install").
#     2. Run:  node src/x402_bridge/auth_sdk.cjs auth   (caches JWT to .env)
#
# Resolves ADR-001 (ISSUE-003): rotate on 429, no single point of failure.

import asyncio
import httpx
import os
import random
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# x402 Integration — import lightweight JWT-only client (no heavy deps)
# ---------------------------------------------------------------------------

_x402_available = False
try:
    from x402_bridge.quicknode import is_configured as _x402_is_configured
    from x402_bridge.quicknode import fetch_mid_price as _x402_fetch_mid_price
    from x402_bridge.quicknode import _close_client as _x402_close
    _x402_available = True
except ImportError:
    logger.debug("x402_bridge.quicknode module not available; using provider-pool only.")

# ---------------------------------------------------------------------------
# Provider Pool — register 2-3 endpoints; pool rotates on rate-limit (429)
# ---------------------------------------------------------------------------

# Provider strings:
#   - URL (https://...)  → standard HTTP provider
#   - "x402"             → x402 QuickNode (JWT auth, no rate limit)
#   - ""                 → skipped (not configured)
PROVIDER_POOL = [
    "x402" if os.getenv("X402_JWT_TOKEN") else "",                # x402 (preferred if JWT set)
    os.getenv("MONAD_RPC_PRIMARY",   "https://rpc1.monad.xyz"),  # Alchemy-hosted
    os.getenv("MONAD_RPC_SECONDARY", ""),                        # QuickNode standard
    os.getenv("MONAD_RPC_TERTIARY",  ""),                        # dRPC or other
]

# ---------------------------------------------------------------------------
# Pyth Network Integration
# ---------------------------------------------------------------------------

PYTH_CONTRACT_MONAD = os.getenv("PYTH_CONTRACT_MONAD", "0x2880aB155794e7179c9eE2e38200202908C17B43")

# Pyth price IDs (bytes32)
PYTH_PRICE_IDS = {
    "MON/USD":  os.getenv("PYTH_PRICE_ID_MON_USD", "0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1"),
    "MON/USDC": os.getenv("PYTH_PRICE_ID_MON_USDC", "0x31491744e2dbf6df7fcf4ac0820d18a609b49076d45066d3568424e62f686cd1"),
}

def _encode_get_price_unsafe(price_id_hex: str) -> str:
    """Encode getPriceUnsafe(bytes32) call."""
    selector = "0x96c51e3c"
    price_id_padded = price_id_hex.replace("0x", "").zfill(64)
    return selector + price_id_padded

# ---------------------------------------------------------------------------
# Provider rotation state
# ---------------------------------------------------------------------------

_provider_index = 0

def _active_providers() -> list[str]:
    """Return only non-empty, non-x402 provider URLs."""
    return [p for p in PROVIDER_POOL if p and p != "x402"]

def _x402_enabled() -> bool:
    """Return True if x402 is configured and the module loaded."""
    return _x402_available and _x402_is_configured()

def _next_provider() -> str:
    """Round-robin rotation across active HTTP providers."""
    global _provider_index
    providers = _active_providers()
    if not providers:
        raise RuntimeError(
            "No Monad RPC providers configured. "
            "Set MONAD_RPC_PRIMARY (and optionally SECONDARY/TERTIARY) in your environment, "
            "or set X402_JWT_TOKEN to use x402 QuickNode."
        )
    url = providers[_provider_index % len(providers)]
    _provider_index += 1
    return url

# ---------------------------------------------------------------------------
# HTTP Session Pool & Concurrency
# ---------------------------------------------------------------------------

# Global AsyncClient for connection pooling (prevents TCP exhaustion)
_http_client: Optional[httpx.AsyncClient] = None

# Global Semaphore to limit concurrent in-flight RPC requests
# 5 is extremely safe for free-tier QuickNode/Alchemy rate limits.
_rpc_semaphore: Optional[asyncio.Semaphore] = None

def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None:
        limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
        _http_client = httpx.AsyncClient(limits=limits, timeout=10.0)
    return _http_client

def _get_semaphore() -> asyncio.Semaphore:
    global _rpc_semaphore
    if _rpc_semaphore is None:
        _rpc_semaphore = asyncio.Semaphore(5)
    return _rpc_semaphore

async def _close_http_client():
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None
    # Also close x402's shared client if it was used
    if _x402_available:
        try:
            await _x402_close()
        except Exception:
            pass

# ---------------------------------------------------------------------------
# On-chain price fetch — Pyth Network getPriceUnsafe
# ---------------------------------------------------------------------------

async def fetch_mid_price(token_pair: str) -> Optional[float]:
    """
    Fetch mid-price from Monad via Pyth getPriceUnsafe(priceId).
    
    Strategy:
      1. Try x402 QuickNode first (no rate limits, JWT auth).
      2. If x402 fails or isn't configured, fall back to the provider pool
         with exponential backoff for 429 / 503 rate-limit errors.
    """
    price_id = PYTH_PRICE_IDS.get(token_pair)
    if not price_id or "..." in price_id:
        return None

    # -------------------------------------------------------------------
    # Path 1: x402 (fast, no rate limits, no semaphore needed)
    # -------------------------------------------------------------------
    if _x402_enabled():
        try:
            price = await _x402_fetch_mid_price(
                token_pair=token_pair,
                pyth_contract=PYTH_CONTRACT_MONAD,
                price_id=price_id,
                encode_fn=_encode_get_price_unsafe,
            )
            if price is not None:
                logger.debug(f"x402 returned {token_pair} = ${price:.6f}")
                return price
        except Exception as e:
            logger.debug(f"x402 fetch failed: {e}, falling back to provider pool.")

    # -------------------------------------------------------------------
    # Path 2: Provider pool (rate-limited, with retry / backoff)
    # -------------------------------------------------------------------
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [{
            "to": PYTH_CONTRACT_MONAD,
            "data": _encode_get_price_unsafe(price_id)
        }, "latest"],
        "id": 1
    }

    client = _get_http_client()
    semaphore = _get_semaphore()
    providers = _active_providers()

    # Dramatically increase max retries since we only have 1 active free provider usually.
    # 20 retries with exponential backoff easily covers a 1-minute rate limit window.
    max_retries = max(20, len(providers) * 5)
    base_delay = 1.5
    max_delay = 10.0

    async with semaphore:
        for attempt in range(max_retries):
            rpc_url = _next_provider()
            try:
                resp = await client.post(rpc_url, json=payload)

                # Exponential backoff on rate limit or server error
                if resp.status_code in (429, 503):
                    jitter = random.uniform(0.1, 0.3)
                    delay = min(max_delay, base_delay * (1.5 ** attempt)) + jitter
                    logger.debug(f"RPC HTTP {resp.status_code} from {rpc_url}, retrying in {delay:.2f}s...")
                    await asyncio.sleep(delay)
                    continue

                resp.raise_for_status()

                result = resp.json().get("result", "")
                if not result or result == "0x":
                    return None

                # Decode ABI: price(int64), conf(uint64), expo(int32), publishTime(uint64)
                raw = bytes.fromhex(result[2:])
                price_raw = int.from_bytes(raw[0:32], "big", signed=True)
                expo = int.from_bytes(raw[64:96], "big", signed=True)
                return price_raw * (10 ** expo)
            except Exception as e:
                # Fallback for network timeouts or connection errors
                jitter = random.uniform(0.1, 0.3)
                delay = min(max_delay, base_delay * (2 ** attempt)) + jitter
                logger.debug(f"RPC Error from {rpc_url}: {str(e)}, retrying in {delay:.2f}s...")
                await asyncio.sleep(delay)
                continue

    return None

# ---------------------------------------------------------------------------
# Drop-in replacement for _default_price_fetcher in shadow_markout_hardened.py
# ---------------------------------------------------------------------------

async def monad_price_fetcher(
    trade_id: str,
    token_pair: str,
    delay_seconds: int,
) -> Optional[float]:
    """
    Waits delay_seconds (T+15s or T+60s markout window), then reads on-chain price.
    """
    await asyncio.sleep(delay_seconds)
    return await fetch_mid_price(token_pair)

# ---------------------------------------------------------------------------
# CLI smoke test — verifies provider connectivity before a full 50-trade run
# ---------------------------------------------------------------------------

async def _smoke_test():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")

    # x402 status
    if _x402_enabled():
        logger.info("x402: ENABLED (X402_JWT_TOKEN detected)")
    else:
        logger.info("x402: NOT configured. Set X402_JWT_TOKEN to enable QuickNode x402.")
        logger.info("  To get a JWT:  node src/x402_bridge/auth_sdk.cjs auth  (uses the @quicknode/x402 SDK; see README)")

    providers = _active_providers()
    logger.info(f"Provider pool: {len(providers)} active")
    for p in providers:
        logger.info(f"  {p}")

    if not providers and not _x402_enabled():
        logger.error("No providers configured. Set MONAD_RPC_PRIMARY or X402_JWT_TOKEN.")
        return

    for pair, price_id in PYTH_PRICE_IDS.items():
        logger.info(f"Fetching {pair} from {PYTH_CONTRACT_MONAD} (ID: {price_id})...")
        price = await fetch_mid_price(pair)
        if price is not None:
            logger.info(f"  {pair} = ${price:.6f}  [LIVE]")
        else:
            logger.warning(f"  {pair} = None  [fallback will activate]")
            
    await _close_http_client()

if __name__ == "__main__":
    asyncio.run(_smoke_test())
