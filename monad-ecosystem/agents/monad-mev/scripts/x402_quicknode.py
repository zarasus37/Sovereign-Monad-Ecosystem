# x402_quicknode.py — Full Python x402 client (HTTP Bridge + EIP-712 Signing)
# Implements the x402 protocol natively in Python. No Node.js dependency.
#
# QuickNode x402: 1,000,000 free credits/month per wallet. No API key.
# Supports both payment models:
#   - credit-drawdown: JWT session (simpler, no per-request signing)
#   - pay-per-request: EIP-712 signing per request (true x402 protocol)
#
# Dependencies (declared in ../pyproject.toml):
#   Required:  httpx         — HTTP client (credit-drawdown, pay-per-request, provider pool)
#   Required:  eth-account   — SIWX (HTTP auth) + EIP-712 (pay-per-request signing)
#                              Lazy-imported so the module loads cleanly without it;
#                              pay-per-request + HTTP auth paths return None until installed.
#
# Install:   poetry install  (from the monad-mev directory)
#            — or —  pip install httpx eth-account
#
# Docs: https://www.quicknode.com/docs/build-with-ai/x402-payments
#       https://github.com/coinbase/x402

import os
import time
import logging
import json as _json
from typing import Optional, Dict, Any, Tuple
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Lazy imports — httpx is only loaded when actually used
# ---------------------------------------------------------------------------

_httpx: Optional[Any] = None

def _get_httpx():
    global _httpx
    if _httpx is None:
        import httpx
        _httpx = httpx
    return _httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

X402_BASE_URL = os.getenv("X402_BASE_URL", "https://x402.quicknode.com")
X402_PAYMENT_NETWORK = os.getenv("X402_PAYMENT_NETWORK", "eip155:84532")
X402_TARGET_NETWORK = os.getenv("X402_TARGET_NETWORK", "monad-mainnet")
X402_PAYMENT_MODEL = os.getenv("X402_PAYMENT_MODEL", "credit-drawdown")
#   ^ "credit-drawdown" | "pay-per-request" | "nanopayment"

X402_EVM_PRIVATE_KEY = os.getenv("X402_EVM_PRIVATE_KEY", "")
X402_JWT_TOKEN = os.getenv("X402_JWT_TOKEN", "")

X402_TIMEOUT = float(os.getenv("X402_TIMEOUT", "30.0"))
X402_MAX_CONCURRENT = int(os.getenv("X402_MAX_CONCURRENT", "20"))

# ---------------------------------------------------------------------------
# Optional crypto dependency — only needed for pay-per-request
# ---------------------------------------------------------------------------

_eth_account = None
_web3 = None

try:
    from eth_account import Account
    from eth_account.messages import encode_defunct, encode_typed_data
    _eth_account = True
except ImportError:
    logger.debug("eth-account not installed. pay-per-request signing unavailable. "
                 "Install: pip install eth-account")

try:
    from web3 import Web3
    _web3 = True
except ImportError:
    logger.debug("web3 not installed. Some helpers unavailable.")


# ---------------------------------------------------------------------------
# Payment requirement dataclass (from x402 402 response)
# ---------------------------------------------------------------------------

@dataclass
class PaymentRequirement:
    """Parsed X-PAYMENT-REQUIRED header from a 402 response."""
    scheme: str
    network: str
    max_amount_required: str  # in base units (e.g., "100000" for $0.10 USDC with 6 decimals)
    resource: str
    destination: str
    deadline: int
    raw: Dict[str, Any]  # full JSON for extensibility


# ---------------------------------------------------------------------------
# HTTP client (shared, connection-pooled)
# ---------------------------------------------------------------------------

_http_client: Optional[Any] = None

def _get_client() -> Any:
    global _http_client
    if _http_client is None:
        httpx = _get_httpx()
        limits = httpx.Limits(
            max_keepalive_connections=20,
            max_connections=40,
        )
        _http_client = httpx.AsyncClient(limits=limits, timeout=X402_TIMEOUT)
    return _http_client


async def _close_client():
    global _http_client
    if _http_client is not None:
        await _http_client.aclose()
        _http_client = None


# ---------------------------------------------------------------------------
# Configuration helpers
# ---------------------------------------------------------------------------

def is_configured() -> bool:
    """Return True if x402 is configured (JWT or private key)."""
    return bool(
        (X402_JWT_TOKEN and X402_JWT_TOKEN.strip()) or
        (X402_EVM_PRIVATE_KEY and X402_EVM_PRIVATE_KEY.strip())
    )


def can_pay_per_request() -> bool:
    """Return True if pay-per-request signing is available."""
    return _eth_account and bool(X402_EVM_PRIVATE_KEY)


def can_credit_drawdown() -> bool:
    """Return True if JWT credit-drawdown is available."""
    return bool(X402_JWT_TOKEN and X402_JWT_TOKEN.strip())


# ---------------------------------------------------------------------------
# Core x402 fetch — handles BOTH payment models transparently
# ---------------------------------------------------------------------------

async def fetch(jsonrpc_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Make an x402-enabled JSON-RPC request.
    
    Payment model selection (auto-detected):
      1. credit-drawdown (JWT) — if X402_JWT_TOKEN is set
      2. pay-per-request (EIP-712 signing) — if eth-account + private key
      3. Falls back to None if neither is available
    
    Auto-refresh:
      - credit-drawdown: JWT expiry triggers _refresh_jwt() (re-auth via Node.js or re-request)
      - pay-per-request: no refresh needed, each request is signed independently
    """
    if not is_configured():
        return None

    # Credit-drawdown is preferred if available (faster, no per-request signing)
    if can_credit_drawdown() and X402_PAYMENT_MODEL in ("credit-drawdown", "nanopayment"):
        return await _fetch_credit_drawdown(jsonrpc_payload)

    # Pay-per-request requires eth-account + private key
    if can_pay_per_request() and X402_PAYMENT_MODEL == "pay-per-request":
        return await _fetch_pay_per_request(jsonrpc_payload)

    # Fallback: try credit-drawdown even if model mismatch, then pay-per-request
    if can_credit_drawdown():
        return await _fetch_credit_drawdown(jsonrpc_payload)
    if can_pay_per_request():
        return await _fetch_pay_per_request(jsonrpc_payload)

    logger.warning("x402 configured but no usable payment model. Check dependencies.")
    return None


# ---------------------------------------------------------------------------
# Credit-drawdown model (JWT session)
# ---------------------------------------------------------------------------

async def _fetch_credit_drawdown(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """JWT-based credit drawdown. JWT refreshed on expiry automatically."""
    global X402_JWT_TOKEN

    if not X402_JWT_TOKEN:
        return None

    url = f"{X402_BASE_URL}/{X402_TARGET_NETWORK}"
    client = _get_client()

    for attempt in range(2):
        headers = {
            "Authorization": f"Bearer {X402_JWT_TOKEN}",
            "Content-Type": "application/json",
        }
        try:
            resp = await client.post(url, headers=headers, json=payload)

            if resp.status_code in (401, 402, 403):
                if attempt == 0:
                    logger.warning(
                        f"x402 JWT expired (HTTP {resp.status_code}). "
                        f"Attempting re-authentication..."
                    )
                    refreshed = await _refresh_jwt()
                    if refreshed:
                        continue
                    logger.warning("x402 JWT re-auth failed. Will try pay-per-request fallback.")
                else:
                    logger.warning("x402 JWT still invalid after re-auth.")
                return None

            resp.raise_for_status()
            return resp.json()

        except _get_httpx().TimeoutException:
            logger.warning("x402 credit-drawdown timed out.")
            return None
        except Exception as e:
            logger.warning(f"x402 credit-drawdown error: {e}")
            return None

    return None


async def _refresh_jwt(max_attempts: int = 2) -> bool:
    """
    Refresh JWT token. Tries multiple methods in order:
      1. Re-authenticate via x402 /auth endpoint (if private key available)
      2. Spawn Node.js helper script (if available)
    """
    # Try re-auth via HTTP if we have a private key
    if X402_EVM_PRIVATE_KEY and _eth_account:
        for attempt in range(1, max_attempts + 1):
            try:
                success = await _auth_via_http()
                if success:
                    return True
            except Exception as e:
                logger.warning(f"HTTP auth attempt {attempt} failed: {e}")
            await _async_sleep(1)

    # Fallback: spawn Node.js helper if available
    return await _refresh_jwt_via_node(max_attempts)


async def _auth_via_http() -> bool:
    """
    Authenticate with x402 /auth endpoint using SIWX signature.
    
    This is the native Python equivalent of the Node.js createQuicknodeX402Client
    preAuth flow. Requires eth-account for message signing.
    """
    if not _eth_account or not X402_EVM_PRIVATE_KEY:
        return False

    try:
        from eth_account import Account
    except ImportError:
        return False

    # Load wallet
    pk = X402_EVM_PRIVATE_KEY
    if not pk.startswith("0x"):
        pk = "0x" + pk
    account = Account.from_key(pk)

    # Build SIWX message
    nonce = f"{int(time.time() * 1000)}"
    issued_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    message = (
        f"{X402_BASE_URL} wants you to sign in with your Ethereum account:\n"
        f"{account.address}\n\n"
        f"Sign in to QuickNode x402.\n\n"
        f"URI: {X402_BASE_URL}\n"
        f"Version: 1\n"
        f"Chain ID: {X402_PAYMENT_NETWORK}\n"
        f"Nonce: {nonce}\n"
        f"Issued At: {issued_at}"
    )

    # Sign
    encoded = encode_defunct(text=message)
    signed = account.sign_message(encoded)
    signature = signed.signature.hex()

    # POST to /auth
    auth_payload = {
        "message": message,
        "signature": signature,
    }

    client = _get_client()
    auth_url = f"{X402_BASE_URL}/auth"
    resp = await client.post(auth_url, json=auth_payload)
    resp.raise_for_status()
    data = resp.json()

    token = data.get("token")
    if token:
        global X402_JWT_TOKEN
        X402_JWT_TOKEN = token
        logger.info("x402 JWT re-authenticated via HTTP.")
        return True
    return False


async def _refresh_jwt_via_node(max_attempts: int = 2) -> bool:
    """Fallback: spawn Node.js get_x402_jwt.js helper to refresh JWT."""
    import asyncio
    from pathlib import Path

    this_dir = Path(__file__).parent
    script_path = this_dir / "get_x402_jwt.js"
    if not script_path.exists():
        script_path = Path(__file__).parent.parent / "scripts" / "get_x402_jwt.js"
    if not script_path.exists():
        return False

    for attempt in range(1, max_attempts + 1):
        try:
            proc = await asyncio.create_subprocess_exec(
                "node", str(script_path), "--json",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=os.environ.copy(),
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
            data = _json.loads(stdout.decode("utf-8", errors="replace"))
            if data.get("success") and data.get("token"):
                global X402_JWT_TOKEN
                X402_JWT_TOKEN = data["token"]
                logger.info("x402 JWT refreshed via Node.js helper.")
                return True
        except Exception:
            pass
        await _async_sleep(1)
    return False


# ---------------------------------------------------------------------------
# Pay-per-request model (EIP-712 signing per request)
# ---------------------------------------------------------------------------

async def _fetch_pay_per_request(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Full x402 pay-per-request protocol:
      1. POST without payment header
      2. If 402, parse X-PAYMENT-REQUIRED
      3. Sign payment authorization (EIP-712 / EIP-3009)
      4. Retry with X-PAYMENT header
    """
    if not _eth_account or not X402_EVM_PRIVATE_KEY:
        logger.warning("pay-per-request requires eth-account + X402_EVM_PRIVATE_KEY")
        return None

    url = f"{X402_BASE_URL}/{X402_TARGET_NETWORK}"
    client = _get_client()
    headers = {"Content-Type": "application/json"}

    try:
        # Step 1: First request without payment
        resp = await client.post(url, headers=headers, json=payload)

        # Step 2: If payment required, negotiate
        if resp.status_code == 402:
            payment_req = _parse_payment_required(resp)
            if payment_req is None:
                logger.warning("x402 402 response but no X-PAYMENT-REQUIRED header.")
                return None

            logger.info(
                f"x402 payment required: {payment_req.max_amount_required} "
                f"for {payment_req.resource}"
            )

            # Step 3: Sign payment
            payment_header = _sign_payment(payment_req)
            if payment_header is None:
                logger.error("Failed to sign x402 payment authorization.")
                return None

            headers["X-Payment"] = payment_header

            # Step 4: Retry with payment
            resp = await client.post(url, headers=headers, json=payload)

        resp.raise_for_status()
        return resp.json()

    except _get_httpx().TimeoutException:
        logger.warning("x402 pay-per-request timed out.")
        return None
    except Exception as e:
        logger.warning(f"x402 pay-per-request error: {e}")
        return None


def _parse_payment_required(resp: Any) -> Optional[PaymentRequirement]:
    """Parse the X-PAYMENT-REQUIRED header from a 402 response."""
    raw = resp.headers.get("X-PAYMENT-REQUIRED")
    if not raw:
        # Fallback: try body if header is missing
        try:
            body = resp.json()
            raw = _json.dumps(body.get("payment_requirement", body))
        except Exception:
            return None

    try:
        data = _json.loads(raw)
        return PaymentRequirement(
            scheme=data.get("scheme", "x402"),
            network=data.get("network", X402_PAYMENT_NETWORK),
            max_amount_required=str(data.get("maxAmountRequired", "0")),
            resource=data.get("resource", ""),
            destination=data.get("destination", ""),
            deadline=int(data.get("deadline", 0)),
            raw=data,
        )
    except Exception as e:
        logger.warning(f"Failed to parse x402 payment requirement: {e}")
        return None


def _sign_payment(req: PaymentRequirement) -> Optional[str]:
    """
    Sign the x402 payment authorization.
    
    This constructs an EIP-712 typed data signature for a USDC
    TransferWithAuthorization (EIP-3009), which is the standard x402
    payment mechanism on EVM chains.
    
    NOTE: The exact typed data structure depends on the x402 protocol version
    and the specific USDC contract on the payment network. The structure below
    is the standard EIP-3009 format. If QuickNode uses a different format,
    adapt _build_eip712_data() accordingly.
    """
    if not _eth_account:
        logger.error("eth-account not available. Cannot sign x402 payment.")
        return None

    try:
        from eth_account import Account
    except ImportError:
        return None

    pk = X402_EVM_PRIVATE_KEY
    if not pk.startswith("0x"):
        pk = "0x" + pk
    account = Account.from_key(pk)

    # Build EIP-712 typed data for TransferWithAuthorization
    typed_data = _build_eip712_data(req, account.address)
    if typed_data is None:
        return None

    try:
        # Sign EIP-712 typed data
        signed = account.sign_message(encode_typed_data(full_message=typed_data))
        signature = signed.signature.hex()
    except Exception as e:
        logger.warning(f"EIP-712 signing failed: {e}")
        return None

    # Build X-Payment header value
    payment = {
        "scheme": "x402",
        "network": req.network,
        "authorization": {
            "signature": signature,
            "paymentDetails": typed_data["message"],
        },
    }
    return _json.dumps(payment)


def _build_eip712_data(req: PaymentRequirement, payer_address: str) -> Optional[Dict[str, Any]]:
    """
    Build EIP-712 typed data for USDC TransferWithAuthorization.
    
    This is the standard EIP-3009 structure used by x402 on EVM chains.
    The USDC contract address and chain ID depend on the payment network.
    """
    # Network → chain ID + USDC contract mapping
    # Add more networks as needed
    network_map = {
        "eip155:84532": {"chain_id": 84532, "usdc": "0x036CbD53842c5426634e7929541eC2318f3dCF7e"},  # Base Sepolia
        "eip155:8453":  {"chain_id": 8453,  "usdc": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"},  # Base Mainnet
    }

    network_info = network_map.get(req.network)
    if network_info is None:
        logger.warning(f"Unknown x402 payment network: {req.network}. "
                       f"Add it to _build_eip712_data().")
        return None

    chain_id = network_info["chain_id"]
    usdc_contract = network_info["usdc"]
    valid_before = req.deadline
    valid_after = 0
    nonce = os.urandom(32).hex()

    typed_data = {
        "types": {
            "EIP712Domain": [
                {"name": "name", "type": "string"},
                {"name": "version", "type": "string"},
                {"name": "chainId", "type": "uint256"},
                {"name": "verifyingContract", "type": "address"},
            ],
            "TransferWithAuthorization": [
                {"name": "from", "type": "address"},
                {"name": "to", "type": "address"},
                {"name": "value", "type": "uint256"},
                {"name": "validAfter", "type": "uint256"},
                {"name": "validBefore", "type": "uint256"},
                {"name": "nonce", "type": "bytes32"},
            ],
        },
        "domain": {
            "name": "USDC",
            "version": "2",
            "chainId": chain_id,
            "verifyingContract": usdc_contract,
        },
        "primaryType": "TransferWithAuthorization",
        "message": {
            "from": payer_address,
            "to": req.destination,
            "value": req.max_amount_required,
            "validAfter": valid_after,
            "validBefore": valid_before,
            "nonce": "0x" + nonce,
        },
    }
    return typed_data


# ---------------------------------------------------------------------------
# Convenience wrapper for monad_price_fetcher.py
# ---------------------------------------------------------------------------

async def fetch_mid_price(
    token_pair: str,
    pyth_contract: str,
    price_id: str,
    encode_fn,
) -> Optional[float]:
    """
    Fetch Pyth getPriceUnsafe via x402 (credit-drawdown or pay-per-request).
    
    Parameters match the caller in monad_price_fetcher.py so the
    integration is a single-line drop-in.
    """
    payload = {
        "jsonrpc": "2.0",
        "method": "eth_call",
        "params": [{
            "to": pyth_contract,
            "data": encode_fn(price_id)
        }, "latest"],
        "id": 1,
    }

    result = await fetch(payload)
    if result is None:
        return None

    raw_result = result.get("result", "")
    if not raw_result or raw_result == "0x":
        return None

    # Decode ABI: price(int64), conf(uint64), expo(int32), publishTime(uint64)
    try:
        raw = bytes.fromhex(raw_result[2:])
        price_raw = int.from_bytes(raw[0:32], "big", signed=True)
        expo = int.from_bytes(raw[64:96], "big", signed=True)
        return price_raw * (10 ** expo)
    except Exception as e:
        logger.warning(f"x402 ABI decode failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _async_sleep(seconds: float):
    """Async sleep using asyncio."""
    import asyncio
    await asyncio.sleep(seconds)


# ---------------------------------------------------------------------------
# Setup instructions (run on first use)
# ---------------------------------------------------------------------------
"""
SETUP — Choose ONE payment model:

A) Credit-drawdown (RECOMMENDED — fastest, no per-request signing)
   -------------------------------------------------------------
   1. Set private key:  export X402_EVM_PRIVATE_KEY=0x...
   2. First run auto-authenticates via HTTP and gets JWT:
        python -c "import asyncio; from x402_quicknode import fetch; ..."
   3. The JWT is cached in memory. No further setup needed.
   4. Set model:  export X402_PAYMENT_MODEL=credit-drawdown

B) Pay-per-request (full x402 protocol, no JWT needed)
   ---------------------------------------------------
   1. Install signing library:  pip install eth-account
   2. Set private key:  export X402_EVM_PRIVATE_KEY=0x...
   3. Set model:  export X402_PAYMENT_MODEL=pay-per-request
   4. Each request is signed independently. No JWT expiry issues.

C) Nanopayment (Circle Gateway, batched payments)
   ------------------------------------------------
   1. Set model:  export X402_PAYMENT_MODEL=nanopayment
   2. Requires one-time USDC deposit to Gateway contract.
   3. See QuickNode docs for Gateway setup.

DEPENDENCIES (declared in ../pyproject.toml):
  - httpx       — HTTP client (always required)
  - eth-account — SIWX (HTTP auth) + EIP-712 (pay-per-request signing)
    Install via:  poetry install  (recommended)
                  — or —  pip install httpx eth-account

ENVIRONMENT VARIABLES:
  X402_EVM_PRIVATE_KEY    Your wallet private key (0x...)
  X402_PAYMENT_NETWORK    eip155:84532 (Base Sepolia) or eip155:8453 (Base Mainnet)
  X402_TARGET_NETWORK     monad-mainnet (the chain you query)
  X402_PAYMENT_MODEL      credit-drawdown | pay-per-request | nanopayment
  X402_BASE_URL           https://x402.quicknode.com
  X402_JWT_TOKEN          (auto-set by credit-drawdown, optional manual override)

NETWORK SUPPORT:
  The _build_eip712_data() function maps payment networks to USDC contracts.
  Add more networks by extending the network_map dict.
"""
