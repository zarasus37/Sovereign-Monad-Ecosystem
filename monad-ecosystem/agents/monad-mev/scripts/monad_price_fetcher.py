# monad_price_fetcher.py
# ProviderPool-backed Monad RPC price fetcher for shadow_markout_hardened.py
#
# Providers confirmed mainnet (November 2025 launch):
#   - Alchemy  : rpc1.monad.xyz  (official Monad docs)
#   - QuickNode: managed endpoints, testnet + mainnet
#   - dRPC     : public + NodeCloud, launch-day ready
#   - Chainstack, BlockPI, Triton: also confirmed mainnet
#
# Resolves ADR-001 (ISSUE-003): rotate on 429, no single point of failure.

import asyncio
import httpx
import os
from typing import Optional

# ---------------------------------------------------------------------------
# Provider Pool — register 2-3 endpoints; pool rotates on rate-limit (429)
# ---------------------------------------------------------------------------

PROVIDER_POOL = [
    os.getenv("MONAD_RPC_PRIMARY",   "https://rpc1.monad.xyz"),       # Alchemy-hosted (official docs)
    os.getenv("MONAD_RPC_SECONDARY", ""),                              # QuickNode — set via env
    os.getenv("MONAD_RPC_TERTIARY",  ""),                              # dRPC — set via env
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
    """Return only non-empty provider URLs."""
    return [p for p in PROVIDER_POOL if p]


def _next_provider() -> str:
    """Round-robin rotation across active providers."""
    global _provider_index
    providers = _active_providers()
    if not providers:
        raise RuntimeError(
            "No Monad RPC providers configured. "
            "Set MONAD_RPC_PRIMARY (and optionally SECONDARY/TERTIARY) in your environment."
        )
    url = providers[_provider_index % len(providers)]
    _provider_index += 1
    return url


# ---------------------------------------------------------------------------
# On-chain price fetch — Pyth Network getPriceUnsafe
# ---------------------------------------------------------------------------

async def fetch_mid_price(token_pair: str) -> Optional[float]:
    """
    Fetch mid-price from Monad via Pyth getPriceUnsafe(priceId).
    """
    price_id = PYTH_PRICE_IDS.get(token_pair)
    if not price_id or "..." in price_id:
        return None

    payload = {
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [{
            "to": PYTH_CONTRACT_MONAD,
            "data": _encode_get_price_unsafe(price_id)
        }, "latest"],
        "id": 1
    }

    providers = _active_providers()
    for attempt in range(len(providers)):
        rpc_url = _next_provider()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(rpc_url, json=payload)
                
                if resp.status_code == 429:
                    continue

                result = resp.json().get("result", "")
                if result and result != "0x":
                    # Decode ABI: price(int64), conf(uint64), expo(int32), publishTime(uint64)
                    raw = bytes.fromhex(result[2:])
                    price_raw = int.from_bytes(raw[0:32], "big", signed=True)
                    expo = int.from_bytes(raw[64:96], "big", signed=True)
                    return price_raw * (10 ** expo)
        except Exception:
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

    Wire into ShadowMarkoutAnalyzer:
        from monad_price_fetcher import monad_price_fetcher

        analyzer = ShadowMarkoutAnalyzer(
            target_trades=50,
            price_fetcher=monad_price_fetcher,
            output_dir="./.runtime_state/markout"
        )

    A run with zero WARNING: RPC unavailable lines in the log = real markout.
    That output is the Operator Review evidence.
    """
    await asyncio.sleep(delay_seconds)
    return await fetch_mid_price(token_pair)


# ---------------------------------------------------------------------------
# CLI smoke test — verifies provider connectivity before a full 50-trade run
# ---------------------------------------------------------------------------

async def _smoke_test():
    import logging
    logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
    logger = logging.getLogger(__name__)

    providers = _active_providers()
    logger.info(f"Active providers: {len(providers)}")
    for p in providers:
        logger.info(f"  {p}")

    if not providers:
        logger.error("No providers configured. Set MONAD_RPC_PRIMARY in environment.")
        return

    for pair, price_id in PYTH_PRICE_IDS.items():
        logger.info(f"Fetching {pair} from {PYTH_CONTRACT_MONAD} (ID: {price_id})...")
        price = await fetch_mid_price(pair)
        if price is not None:
            logger.info(f"  {pair} = ${price:.6f}  [LIVE]")
        else:
            logger.warning(f"  {pair} = None  [fallback will activate — check contract address, price ID, or provider]")


if __name__ == "__main__":
    asyncio.run(_smoke_test())
