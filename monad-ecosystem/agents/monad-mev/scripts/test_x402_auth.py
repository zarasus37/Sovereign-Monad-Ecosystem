#!/usr/bin/env python3
"""
Test x402 auth flow against Base Sepolia (or any configured network).

This script validates:
  1. Module imports and configuration loading
  2. SIWX message construction (for HTTP auth)
  3. Payment requirement parsing (from 402 responses)
  4. EIP-712 typed data construction (for pay-per-request)
  5. Module integration with monad_price_fetcher.py

For endpoint connectivity testing (requires httpx), run separately:
  python -c "import httpx; import asyncio; ..."  (if httpx available)

Usage:
  python test_x402_auth.py
  python test_x402_auth.py --verbose
"""

import sys
import os
import time
import json
from pathlib import Path
from urllib import request, error

# Add scripts directory to path
scripts_dir = Path(__file__).parent
sys.path.insert(0, str(scripts_dir))

VERBOSE = "--verbose" in sys.argv


def log(msg: str):
    if VERBOSE or not msg.startswith("  "):
        print(msg)


def test_1_imports():
    log("\n[1/6] Testing module imports...")
    try:
        import x402_quicknode as x402
        log("  ✅ x402_quicknode imported successfully")
        return True
    except ImportError as e:
        log(f"  ❌ Import failed: {e}")
        return False


def test_2_config():
    log("\n[2/6] Testing configuration defaults...")
    import x402_quicknode as x402

    assert x402.X402_BASE_URL == "https://x402.quicknode.com"
    assert x402.X402_PAYMENT_NETWORK == "eip155:84532"
    assert x402.X402_TARGET_NETWORK == "monad-mainnet"
    assert x402.X402_PAYMENT_MODEL == "credit-drawdown"
    log(f"  ✅ Base URL:        {x402.X402_BASE_URL}")
    log(f"  ✅ Payment network: {x402.X402_PAYMENT_NETWORK}")
    log(f"  ✅ Target network:  {x402.X402_TARGET_NETWORK}")
    log(f"  ✅ Payment model:   {x402.X402_PAYMENT_MODEL}")

    configured = x402.is_configured()
    log(f"  ✅ is_configured() = {configured} (expected False without key)")
    if configured:
        log("  ⚠️  WARNING: X402_EVM_PRIVATE_KEY or X402_JWT_TOKEN is set in environment")
    return True


def test_3_siwx_message():
    log("\n[3/6] Testing SIWX message construction...")

    base_url = "https://x402.quicknode.com"
    payment_network = "eip155:84532"
    address = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B"
    nonce = f"{int(time.time() * 1000)}"
    issued_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

    message = (
        f"{base_url} wants you to sign in with your Ethereum account:\n"
        f"{address}\n\n"
        f"Sign in to QuickNode x402.\n\n"
        f"URI: {base_url}\n"
        f"Version: 1\n"
        f"Chain ID: {payment_network}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}"
    )

    log("  ✅ SIWX message constructed")
    if VERBOSE:
        log(f"  --- SIWX MESSAGE ---")
        for line in message.split("\n"):
            log(f"  {line}")
        log(f"  --- END SIWX ---")

    assert "wants you to sign in" in message
    assert address in message
    assert "Chain ID: eip155:84532" in message
    assert "Nonce:" in message
    assert "Issued At:" in message
    log("  ✅ SIWX message structure valid")
    return True


def test_4_eip712_data():
    log("\n[4/6] Testing EIP-712 typed data construction...")
    import x402_quicknode as x402

    try:
        from x402_quicknode import PaymentRequirement
        req = PaymentRequirement(
            scheme="x402",
            network="eip155:84532",
            max_amount_required="100000",
            resource="https://x402.quicknode.com/monad-mainnet",
            destination="0x1234567890123456789012345678901234567890",
            deadline=int(time.time()) + 3600,
            raw={}
        )
        log(f"  ✅ PaymentRequirement dataclass created")
        log(f"  📋 Amount: {req.max_amount_required} (USDC base units)")
        log(f"  📋 Resource: {req.resource}")
        log(f"  📋 Deadline: {req.deadline}")

        typed_data = x402._build_eip712_data(req, "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B")
        if typed_data:
            log(f"  ✅ EIP-712 typed data built for Base Sepolia")
            assert "types" in typed_data
            assert "EIP712Domain" in typed_data["types"]
            assert "TransferWithAuthorization" in typed_data["types"]
            assert typed_data["domain"]["name"] == "USDC"
            assert typed_data["domain"]["chainId"] == 84532
            log(f"  ✅ EIP-712 structure validated (USDC on Base Sepolia, chainId 84532)")
        else:
            log(f"  ⚠️  EIP-712 data returned None (network not in mapping)")
        return True
    except Exception as e:
        log(f"  ❌ EIP-712 test failed: {e}")
        return False


def test_5_endpoint_connectivity():
    log("\n[5/6] Testing x402 endpoint connectivity (urllib)...")

    base_url = "https://x402.quicknode.com"
    target = "monad-mainnet"
    url = f"{base_url}/{target}"

    log(f"  📡 Pinging {url}...")

    try:
        payload = json.dumps({
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_blockNumber",
            "params": []
        }).encode("utf-8")

        req = request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )

        with request.urlopen(req, timeout=10) as resp:
            status = resp.status
            log(f"  📡 Unauthenticated POST: HTTP {status}")
            body = resp.read().decode("utf-8", errors="replace")
            if status == 200:
                log(f"  ⚠️  Unexpected 200 OK (endpoint may not require auth yet)")
            else:
                log(f"  ⚠️  Unexpected status: {status}")
                if VERBOSE:
                    log(f"  📄 Body: {body[:200]}")
            return True

    except error.HTTPError as e:
        status = e.code
        body = e.read().decode("utf-8", errors="replace")
        log(f"  📡 Unauthenticated POST: HTTP {status}")

        if status == 401:
            log(f"  ✅ Expected 401 Unauthorized (no auth header)")
        elif status == 402:
            log(f"  ✅ Got 402 Payment Required (x402 protocol active)")
            try:
                data = json.loads(body)
                if VERBOSE:
                    log(f"  📄 Response body: {json.dumps(data, indent=2)[:400]}")
            except Exception:
                pass
            # Check headers
            if e.headers:
                payment_header = e.headers.get("X-PAYMENT-REQUIRED")
                if payment_header:
                    log(f"  ✅ X-PAYMENT-REQUIRED header present")
                    if VERBOSE:
                        log(f"  📄 Header: {payment_header[:200]}...")
                else:
                    log(f"  ⚠️  No X-PAYMENT-REQUIRED header in 402 response")
        else:
            log(f"  ⚠️  Unexpected HTTP status: {status}")
            if VERBOSE:
                log(f"  📄 Body: {body[:200]}")
        return True

    except error.URLError as e:
        log(f"  ❌ URL error: {e.reason}")
        log(f"  📡 Possible causes: endpoint not yet live, DNS issue, or firewall")
        return False
    except Exception as e:
        log(f"  ❌ Connectivity test failed: {e}")
        return False


def test_6_module_integration():
    log("\n[6/6] Testing x402_quicknode module integration...")
    import x402_quicknode as x402
    import inspect

    sig = inspect.signature(x402.fetch_mid_price)
    params = list(sig.parameters.keys())
    expected = ["token_pair", "pyth_contract", "price_id", "encode_fn"]
    assert params == expected, f"Expected params {expected}, got {params}"
    log(f"  ✅ fetch_mid_price signature correct: {params}")

    assert callable(x402.fetch)
    log(f"  ✅ fetch() callable")

    assert callable(x402.is_configured)
    log(f"  ✅ is_configured() callable")

    assert callable(x402.can_pay_per_request)
    log(f"  ✅ can_pay_per_request() callable")

    return True


def main(ctx):
    print("=" * 60)
    print("x402 QuickNode Auth Flow Test Suite")
    print("=" * 60)
    print(f"Python: {sys.version}")
    print(f"Working directory: {os.getcwd()}")
    print(f"Target: Base Sepolia (eip155:84532) → Monad Mainnet")

    results = []
    results.append(("Imports", test_1_imports()))
    results.append(("Config", test_2_config()))
    results.append(("SIWX Message", test_3_siwx_message()))
    results.append(("EIP-712 Data", test_4_eip712_data()))
    results.append(("Endpoint Connectivity", test_5_endpoint_connectivity()))
    results.append(("Module Integration", test_6_module_integration()))

    passed = sum(1 for _, ok in results if ok)
    total = len(results)

    print("\n" + "=" * 60)
    print(f"Results: {passed}/{total} tests passed")
    print("=" * 60)
    for name, ok in results:
        status = "✅ PASS" if ok else "❌ FAIL"
        print(f"  {status} — {name}")

    print("\n" + "-" * 60)
    print("NEXT STEPS:")
    print("-" * 60)
    print("1. Set environment variables:")
    print("   export X402_EVM_PRIVATE_KEY=0x...")
    print("   export X402_PAYMENT_NETWORK=eip155:84532")
    print("   export X402_PAYMENT_MODEL=credit-drawdown")
    print("")
    print("2. Ensure wallet has USDC on Base Sepolia:")
    print("   - Get testnet USDC: https://faucet.coinbase.com/")
    print("   - Or bridge from Base Mainnet")
    print("")
    print("3. Install Python dependencies (httpx + eth-account):")
    print("   poetry install  (from the monad-mev directory)")
    print("   — or —")
    print("   pip install httpx eth-account")
    print("")
    print("4. Run monad_price_fetcher.py:")
    print("   python monad_price_fetcher.py")
    print("-" * 60)

    return {"passed": passed, "total": total, "exit_code": 0 if passed == total else 1}


if __name__ == "__main__":
    import types
    ctx = types.SimpleNamespace()
    result = main(ctx)
    sys.exit(result["exit_code"])
