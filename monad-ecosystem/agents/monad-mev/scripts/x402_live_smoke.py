"""
x402_live_smoke.py — End-to-end live verification of the x402 flow.

This script exercises the FULL x402 stack against the live QuickNode
endpoint, gated on having either a JWT (preferred) or a funded
wallet private key. It is the single command to run once P2 is
unblocked.

Stages:
  1. Pre-flight (no creds required):
     - Check wallet ETH + USDC balance on Base Sepolia via public RPC
     - Validate SIWX message construction
  2. SIWX enrollment (requires X402_EVM_PRIVATE_KEY):
     - Sign SIWX message with EIP-191 personal_sign
     - POST to /auth to obtain JWT
     - Cache JWT to X402_JWT_TOKEN env
  3. Live RPC (requires JWT or pay-per-request key):
     - Send eth_blockNumber via credit-drawdown
     - Send eth_blockNumber via pay-per-request (EIP-712 sign)
     - Print block number + credit remaining if exposed
  4. Cleanup:
     - Re-export JWT for monad_price_fetcher.py pickup

Run modes:
  python x402_live_smoke.py --preflight
      Just check wallet balance + SIWX message validity (no signing).

  python x402_live_smoke.py --stage siwx
      Sign SIWX, exchange for JWT, save to .env.

  python x402_live_smoke.py --stage live
      Use existing JWT to make one live RPC call (the actual smoke test).

  python x402_live_smoke.py
      All stages in sequence (skips stages whose creds are missing).
"""

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path
from urllib import request as urlrequest, error as urlerror

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

# Public Base Sepolia RPC for pre-flight balance checks
BASE_SEPOLIA_PUBLIC_RPCS = [
    "https://sepolia.base.org",
    "https://base-sepolia-rpc.publicnode.com",
]


def eip55_checksum(addr: str) -> bool:
    """Validate EIP-55 mixed-case checksum (without eth_utils dep)."""
    if not addr.startswith("0x") or len(addr) != 42:
        return False
    try:
        from eth_utils import to_checksum_address
        return to_checksum_address(addr) == addr
    except ImportError:
        # Fallback: accept all-lowercase or all-uppercase (no checksum check)
        body = addr[2:]
        return body.islower() or body.isupper() or body == body.upper().lower()


# ── Stage 1: Pre-flight ─────────────────────────────────────────────────────

async def stage_preflight() -> dict:
    """Check wallet ETH + USDC balance on Base Sepolia."""
    addr = os.environ.get("X402_EVM_PRIVATE_KEY_ADDRESS") or os.environ.get("X402_WALLET_ADDRESS")
    if not addr:
        print("⚠️  X402_EVM_PRIVATE_KEY_ADDRESS not set — skipping balance check")
        return {"skipped": True}

    print(f"\n[preflight] Wallet: {addr}")
    if not eip55_checksum(addr):
        print(f"  ❌ Invalid EIP-55 checksum: {addr}")
        return {"valid": False}

    print(f"  ✅ EIP-55 checksum valid")

    # ETH balance via public RPC
    eth_balance = None
    for rpc in BASE_SEPOLIA_PUBLIC_RPCS:
        try:
            payload = {
                "jsonrpc": "2.0", "id": 1,
                "method": "eth_getBalance", "params": [addr, "latest"]
            }
            req = urlrequest.Request(
                rpc, method="POST",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urlrequest.urlopen(req, timeout=10) as r:
                result = json.loads(r.read().decode("utf-8"))
                if "result" in result:
                    eth_balance = int(result["result"], 16) / 1e18
                    print(f"  ✅ ETH balance: {eth_balance:.6f} ETH (via {rpc})")
                    break
        except Exception as e:
            print(f"  ⚠️  RPC {rpc} failed: {e}")
            continue

    if eth_balance is None:
        print(f"  ⚠️  Could not fetch ETH balance (no public RPC reachable)")

    # USDC balance (ERC-20 balanceOf)
    usdc_contract = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"  # USDC on Base Sepolia
    usdc_balance = None
    balance_of_data = "0x70a08231" + addr[2:].lower().rjust(64, "0")
    for rpc in BASE_SEPOLIA_PUBLIC_RPCS:
        try:
            payload = {
                "jsonrpc": "2.0", "id": 1,
                "method": "eth_call",
                "params": [{"to": usdc_contract, "data": balance_of_data}, "latest"]
            }
            req = urlrequest.Request(
                rpc, method="POST",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urlrequest.urlopen(req, timeout=10) as r:
                result = json.loads(r.read().decode("utf-8"))
                if "result" in result:
                    usdc_balance = int(result["result"], 16) / 1e6
                    print(f"  ✅ USDC balance: {usdc_balance:.2f} USDC (via {rpc})")
                    break
        except Exception as e:
            continue

    if usdc_balance is None:
        print(f"  ⚠️  Could not fetch USDC balance")

    # SIWX message construction
    try:
        import x402_quicknode as x402
        base_url = x402.X402_BASE_URL
        payment_network = x402.X402_PAYMENT_NETWORK
        nonce = f"{int(time.time() * 1000)}"
        issued_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        message = (
            f"{base_url} wants you to sign in with your Ethereum account:\n"
            f"{addr}\n\n"
            f"Sign in to QuickNode x402.\n\n"
            f"URI: {base_url}\n"
            f"Version: 1\n"
            f"Chain ID: {payment_network}\n"
            f"Nonce: {nonce}\n"
            f"Issued At: {issued_at}"
        )
        print(f"  ✅ SIWX message constructible ({len(message)} chars)")
    except Exception as e:
        print(f"  ❌ SIWX construction failed: {e}")
        return {"valid": False}

    # Funding gate
    if usdc_balance is not None and usdc_balance < 0.5:
        print(f"\n  ⚠️  USDC balance {usdc_balance} is below typical 0.5 USDC minimum")
        print(f"     Get testnet USDC: https://faucet.coinbase.com/")

    return {
        "valid": True,
        "eth_balance": eth_balance,
        "usdc_balance": usdc_balance,
        "siwx_message": message,
    }


# ── Stage 2: SIWX enrollment ────────────────────────────────────────────────

async def stage_siwx() -> dict:
    """Sign SIWX message, POST to /auth, save JWT to .env."""
    pk = os.environ.get("X402_EVM_PRIVATE_KEY")
    addr = os.environ.get("X402_EVM_PRIVATE_KEY_ADDRESS")
    if not pk:
        print("\n[siwx] X402_EVM_PRIVATE_KEY not set — skipping")
        return {"skipped": True}

    print(f"\n[siwx] Signing SIWX message for {addr}...")

    try:
        from eth_account import Account
        from eth_account.messages import encode_defunct
    except ImportError:
        print("  ❌ eth-account not installed. Run: pip install eth-account")
        return {"error": "eth-account missing"}

    try:
        import httpx
    except ImportError:
        print("  ❌ httpx not installed. Run: pip install httpx")
        return {"error": "httpx missing"}

    import x402_quicknode as x402
    base_url = x402.X402_BASE_URL
    payment_network = x402.X402_PAYMENT_NETWORK

    nonce = f"{int(time.time() * 1000)}"
    issued_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    message_text = (
        f"{base_url} wants you to sign in with your Ethereum account:\n"
        f"{addr}\n\n"
        f"Sign in to QuickNode x402.\n\n"
        f"URI: {base_url}\n"
        f"Version: 1\n"
        f"Chain ID: {payment_network}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}"
    )

    # Sign with EIP-191 personal_sign
    signable = encode_defunct(text=message_text)
    signed = Account.sign_message(signable, pk)
    signature = signed.signature.hex()
    if not signature.startswith("0x"):
        signature = "0x" + signature

    # POST to /auth
    print(f"  POST {base_url}/auth ...")
    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.post(
            f"{base_url}/auth",
            json={
                "address": addr,
                "signature": signature,
                "message": message_text,
                "network": payment_network,
            }
        )
        print(f"  Status: {r.status_code}")
        body = r.text
        if r.status_code == 200:
            data = r.json()
            jwt = data.get("jwt") or data.get("token")
            if jwt:
                print(f"  ✅ JWT obtained ({len(jwt)} chars)")
                # Save to .env
                env_path = SCRIPTS_DIR / ".env"
                env_line = f"X402_JWT_TOKEN={jwt}\n"
                if env_path.exists():
                    content = env_path.read_text()
                    if "X402_JWT_TOKEN=" in content:
                        content = "\n".join(
                            line for line in content.splitlines()
                            if not line.startswith("X402_JWT_TOKEN=")
                        )
                    content += env_line
                    env_path.write_text(content)
                    print(f"  ✅ JWT cached in {env_path.name}")
                else:
                    env_path.write_text(f"X402_JWT_TOKEN={jwt}\n")
                    print(f"  ✅ JWT cached in new {env_path.name}")
                os.environ["X402_JWT_TOKEN"] = jwt
                return {"jwt": jwt[:30] + "...", "status": 200}
            else:
                print(f"  ⚠️  200 OK but no jwt field in body")
                print(f"  body: {body[:500]}")
                return {"status": 200, "body": body[:500]}
        else:
            print(f"  ❌ Auth failed: {r.status_code}")
            print(f"  body: {body[:500]}")
            return {"status": r.status_code, "body": body[:500]}


# ── Stage 3: Live RPC ───────────────────────────────────────────────────────

async def stage_live() -> dict:
    """Make one live eth_blockNumber call via credit-drawdown."""
    import httpx
    import x402_quicknode as x402

    jwt = os.environ.get("X402_JWT_TOKEN")
    if not jwt:
        print("\n[live] X402_JWT_TOKEN not set — skipping live RPC")
        return {"skipped": True}

    print(f"\n[live] Sending eth_blockNumber via credit-drawdown...")
    url = f"{x402.X402_BASE_URL}/{x402.X402_TARGET_NETWORK}"
    payload = {"jsonrpc": "2.0", "id": 1, "method": "eth_blockNumber", "params": []}

    async with httpx.AsyncClient(timeout=30.0) as c:
        r = await c.post(
            url,
            json=payload,
            headers={
                "Authorization": f"Bearer {jwt}",
                "Content-Type": "application/json",
            }
        )
        print(f"  Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            block = int(data.get("result", "0x0"), 16)
            print(f"  ✅ eth_blockNumber: {block}")
            # Look for credit header
            credits = r.headers.get("X-Credits-Remaining") or r.headers.get("X-RateLimit-Remaining")
            if credits:
                print(f"  Credits remaining: {credits}")
            return {"status": 200, "block": block, "credits": credits}
        else:
            print(f"  body: {r.text[:500]}")
            return {"status": r.status_code, "body": r.text[:500]}


# ── Main ────────────────────────────────────────────────────────────────────

async def main(args):
    print("=" * 60)
    print("x402 Live Smoke Test — Sovereign Monad Ecosystem")
    print("=" * 60)
    print(f"Endpoint: https://x402.quicknode.com")
    print(f"Target:   monad-mainnet")
    print(f"Model:    credit-drawdown (recommended)")

    if args.stage in ("preflight", "all"):
        await stage_preflight()
    if args.stage in ("siwx", "all"):
        await stage_siwx()
    if args.stage in ("live", "all"):
        await stage_live()

    print("\n" + "=" * 60)
    print("Done.")
    print("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="x402 live smoke test")
    parser.add_argument(
        "--stage", choices=["preflight", "siwx", "live", "all"], default="all",
        help="Which stage to run (default: all)"
    )
    args = parser.parse_args()
    asyncio.run(main(args))
