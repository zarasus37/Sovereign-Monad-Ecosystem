"""
x402_live_smoke.py — End-to-end live verification of the x402 flow.

This script exercises the FULL x402 stack against the live QuickNode
endpoint, gated on having either a JWT (preferred) or a funded
wallet private key. It is the single command to run once P2 is
unblocked.

Stages:
  1. Pre-flight (no creds required):
     - Check wallet ETH + USDC balance on Base Sepolia via public RPC
     - Verify Node + the @quicknode/x402 SDK + .env key are available for 2/3
  2. SIWX enrollment (requires X402_EVM_PRIVATE_KEY):
     - Delegate to auth_sdk.cjs, which SIWX-enrolls via the official
       @quicknode/x402 SDK and caches the JWT to .env as X402_JWT_TOKEN.
     - (The hand-rolled SIWX message this stage used to build was out of
       EIP-4361 spec — Chain ID carried the CAIP-2 form 'eip155:84532'
       instead of the bare integer 84532 — so /auth rejected it. The SDK
       builds the message correctly.)
  3. Live RPC (requires the wallet + SDK):
     - One live eth_blockNumber on monad-mainnet via the SDK's client.fetch,
       which handles the credit-drawdown PAYMENT-SIGNATURE header that a bare
       'Authorization: Bearer' request does not.
     - Print block number + credit remaining if exposed.

Run modes:
  python x402_live_smoke.py --stage preflight
      Just check wallet balance + SDK readiness (no signing).

  python x402_live_smoke.py --stage siwx
      SIWX-enroll via the SDK, cache JWT to .env.

  python x402_live_smoke.py --stage live
      One live RPC call (the actual smoke test).

  python x402_live_smoke.py
      All stages in sequence (skips stages whose creds are missing).
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib import request as urlrequest, error as urlerror

SCRIPTS_DIR = Path(__file__).parent
# Allow both in-tree execution and module-style execution
if SCRIPTS_DIR.name == "x402_bridge":
    sys.path.insert(0, str(SCRIPTS_DIR.parent))  # src/
else:
    sys.path.insert(0, str(SCRIPTS_DIR))

# Load secrets (X402_EVM_PRIVATE_KEY, etc.) from a gitignored .env sitting
# next to this script, so the private key never has to be passed on the
# command line or pasted into a transcript. .env is covered by the root
# .gitignore (.env / .env.*) and is never committed.
try:
    from dotenv import load_dotenv
    load_dotenv(SCRIPTS_DIR / ".env")
except ImportError:
    pass

# auth_sdk.cjs is the Node helper that drives the official @quicknode/x402 SDK
# (SIWX enrollment + live credit-drawdown RPC). Stages 2/3 delegate to it.
AUTH_SDK_HELPER = SCRIPTS_DIR / "auth_sdk.cjs"


def _run_sdk(mode: str) -> dict:
    """Run `node auth_sdk.cjs <mode>` with cwd = SCRIPTS_DIR (so the helper's
    dotenv loads the gitignored .env sitting next to it) and return the parsed
    JSON object it prints. Returns {"success": False, "error": ...} on failure.
    """
    if not AUTH_SDK_HELPER.exists():
        return {"success": False, "error": f"helper missing: {AUTH_SDK_HELPER.name}"}
    try:
        proc = subprocess.run(
            ["node", str(AUTH_SDK_HELPER), mode],
            cwd=str(SCRIPTS_DIR),
            capture_output=True, text=True, timeout=120,
            env=os.environ.copy(),
        )
    except FileNotFoundError:
        return {"success": False, "error": "node not found on PATH (install Node.js 18+)"}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "node helper timed out (>120s)"}
    # The helper prints one JSON line on stdout; dotenv/SDK may print other
    # lines, so parse the last stdout line that is valid JSON.
    parsed = None
    for line in reversed(proc.stdout.splitlines()):
        line = line.strip()
        if line.startswith("{"):
            try:
                parsed = json.loads(line)
                break
            except json.JSONDecodeError:
                continue
    if parsed is None:
        tail = (proc.stdout or proc.stderr or "").strip().splitlines()[-3:]
        return {"success": False, "error": "no JSON from helper", "stderr": "\n".join(tail)}
    return parsed

# Public Base Sepolia RPC for pre-flight balance checks
BASE_SEPOLIA_PUBLIC_RPCS = [
    "https://sepolia.base.org",
    "https://base-sepolia-rpc.publicnode.com",
]


def eip55_checksum(addr: str) -> bool:
    """Validate EIP-55 mixed-case checksum.

    Uses eth-utils if available for a strict check. In minimal environments
    without it we validate format only and warn that the checksum cannot be
    verified.
    """
    if not addr.startswith("0x") or len(addr) != 42:
        return False
    try:
        from eth_utils import to_checksum_address
        return to_checksum_address(addr) == addr
    except ImportError:
        body = addr[2:]
        # If the address contains mixed case, we cannot verify the checksum
        # without eth-utils. Accept it but warn.
        if not (body.islower() or body.isupper()):
            print(f"  ⚠️  Cannot verify EIP-55 checksum (eth-utils not installed); accepting {addr}")
        return True


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
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "x402-bridge/1.0",
                }
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
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "x402-bridge/1.0",
                }
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

    # SDK availability — the real prerequisite for stages 2/3 (the hand-rolled
    # SIWX path was out of spec; auth_sdk.cjs + the @quicknode/x402 SDK is the
    # only working auth path).
    if not AUTH_SDK_HELPER.exists():
        print(f"  ⚠️  auth_sdk.cjs missing at {AUTH_SDK_HELPER} — stages 2/3 will fail")
    else:
        probe = _run_sdk("probe")
        if probe.get("success"):
            key = "set" if probe.get("private_key_in_env") else "NOT set"
            print(f"  ✅ Node + @quicknode/x402 SDK available (stages 2/3 ready); private key in env: {key}")
        else:
            print(f"  ⚠️  SDK not resolvable: {probe.get('error', '')}")
            print(f"     See README 'One-time SDK install' / set X402_SDK_NODE_PATH")

    # Funding gate
    if usdc_balance is not None and usdc_balance < 0.5:
        print(f"\n  ⚠️  USDC balance {usdc_balance} is below typical 0.5 USDC minimum")
        print(f"     Get testnet USDC: https://faucet.coinbase.com/")

    return {
        "valid": True,
        "eth_balance": eth_balance,
        "usdc_balance": usdc_balance,
    }


# ── Stage 2: SIWX enrollment ────────────────────────────────────────────────

async def stage_siwx() -> dict:
    """SIWX-enroll via the @quicknode/x402 SDK (auth_sdk.cjs) and cache the JWT.

    The SDK builds the EIP-4361 SIWX message correctly. The hand-rolled message
    this stage used to build was out of spec — the Chain ID field carried the
    CAIP-2 form 'eip155:84532' instead of the bare integer 84532, and the domain
    line carried the 'https://' scheme — so /auth rejected it with 'Failed to
    parse SIWE message'. Delegating to the SDK is the only working path.
    """
    if not os.environ.get("X402_EVM_PRIVATE_KEY") and not (SCRIPTS_DIR / ".env").exists():
        print("\n[siwx] No X402_EVM_PRIVATE_KEY in env and no .env — skipping")
        return {"skipped": True}

    print("\n[siwx] SIWX-enrolling via @quicknode/x402 SDK (auth_sdk.cjs)...")
    result = _run_sdk("auth")
    if not result or not result.get("success"):
        print(f"  ❌ SIWX failed: {result.get('error') if result else 'no output'}")
        return {"error": result.get("error") if result else "no output"}
    auth = result.get("auth", {})
    print(f"  ✅ JWT acquired ({auth.get('jwt_chars')} chars), accountId={auth.get('accountId')}")
    if auth.get("jwt_cached"):
        print("  ✅ JWT cached to .env as X402_JWT_TOKEN")
    return {"jwt_acquired": True, "accountId": auth.get("accountId")}


# ── Stage 3: Live RPC ───────────────────────────────────────────────────────

async def stage_live() -> dict:
    """One live eth_blockNumber on monad-mainnet via the SDK's client.fetch.

    The SDK adds the credit-drawdown PAYMENT-SIGNATURE header that a bare
    'Authorization: Bearer' request does not, and runs the 402 -> sign ->
    retry cycle internally. With the wallet funded with Base Sepolia USDC the
    server verifies the payment and returns the block.
    """
    print("\n[live] Sending eth_blockNumber via credit-drawdown (SDK client.fetch)...")
    result = _run_sdk("live")
    if not result or not result.get("success"):
        err = result.get("error") if result else "no output"
        print(f"  ❌ Live RPC failed: {err}")
        live = (result or {}).get("live", {})
        if live.get("raw"):
            print(f"  body: {live['raw'][:300]}")
        return {"error": err}
    live = result.get("live", {})
    block = live.get("block_number")
    block_hex = live.get("block_hex") or ""
    print(f"  ✅ eth_blockNumber: {block}  ({block_hex})")
    credits = live.get("credits_remaining")
    if credits:
        print(f"  Credits remaining: {credits}")
    return {"block": block, "credits": credits}


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
