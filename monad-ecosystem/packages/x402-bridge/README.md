# x402 QuickNode Integration Guide

> **LEGACY_NON_SOVEREIGN** — This package is a pre‑charter external bridge and does not currently satisfy `docs/CHARTER.md` §3 (sovereignty as an architectural property). Live smoke tests are blocked on funding, and cost accounting / failure boundaries are not yet validated. See `docs/LEGACY_COMPONENTS.md` for the remediation plan and deadline.

## Overview

This guide covers integrating **x402 QuickNode** into the Monad MEV price fetcher. x402 is a wallet-authenticated, pay-per-request access layer that provides **1,000,000 free API credits per month** with no API key and no rate limits.

**Key benefits over traditional provider pools:**
- No rate limits (no 429 retries)
- No API key registration
- 1M free credits/month per wallet
- Higher concurrency (20+ vs. 5 with provider pools)
- Faster request latency (no exponential backoff)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    x402_bridge.price_fetcher                   │
├─────────────────────────────────────────────────────────────┤
│  x402 provider (primary)     │  Provider pool (fallback)     │
│  ─────────────────────────   │  ─────────────────────────   │
│  x402_bridge.quicknode.fetch()      │  Alchemy / QuickNode / dRPC   │
│  ├── credit-drawdown         │  ├── exponential backoff       │
│  │   └── JWT session auth     │  └── 5-concurrent semaphore    │
│  └── pay-per-request         │                                │
│      └── EIP-712 per request │                                │
└─────────────────────────────────────────────────────────────┘
```

**Auto-fallback:** If x402 fails (JWT expiry, network error, auth failure), the fetcher automatically falls back to the standard provider pool.

---

## Quick Start (5 Minutes)

### 1. Prerequisites

```bash
# Install all Python dependencies from the manifest
# (httpx for the HTTP client, eth-account for SIWX + EIP-712 signing)
poetry install
# — or, without poetry —
pip install httpx eth-account

# Node.js (only for JWT helper alternative)
# node --version  # v18+ recommended
```

### 2. Configure Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env with your wallet private key
# This wallet must have USDC on the payment network
```

### 3. Required Environment Variables

```bash
# Core (required for all payment models)
export X402_EVM_PRIVATE_KEY=0x...          # Your wallet private key
export X402_PAYMENT_NETWORK=eip155:84532   # Base Sepolia (dev) or eip155:8453 (Base Mainnet)
export X402_PAYMENT_MODEL=credit-drawdown   # Recommended

# Optional (have sensible defaults)
export X402_TARGET_NETWORK=monad-mainnet
export X402_BASE_URL=https://x402.quicknode.com
export X402_MAX_CONCURRENT=20
export X402_TIMEOUT=30.0
```

### 4. Get USDC on Base Sepolia (Dev/Test)

Your wallet needs USDC on the **payment network** (Base Sepolia for dev), not on Monad.

**Option A: Coinbase Faucet**
- Visit: https://faucet.coinbase.com/
- Request Base Sepolia USDC

**Option B: Bridge from Base Mainnet**
- Use the official Base bridge

**Active settlement wallet (P2):** `0x54D928b0593db01BB46b2A5D0c2e4365C6Ac881F` (Base Sepolia, EIP-55 valid). Fund it with **Base Sepolia USDC** (the credit-drawdown server verifies each per-request payment against USDC — see "Verified Live (2026-07-10)" below) plus a little Base Sepolia ETH for gas. Get both from the Coinbase faucet: https://faucet.coinbase.com/.

**Chain trap — read before funding.** "Ethereum Sepolia" (chain `11155111`), "Base Sepolia" (chain `84532` — the one x402 charges on), and "Base mainnet" (chain `8453`) are three *different* ledgers. The wallet address is identical on all three, but balances are per-chain. Funding the wrong one (e.g. a generic Sepolia faucet that dispenses Ethereum Sepolia ETH) will **not** show up on Base Sepolia and will **not** unblock the smoke test. At the faucet, select **Base Sepolia** as the destination network.

### 5. Run the Test

```bash
# Test the x402 module without running the full fetcher
python tests/test_x402_auth.py

# Expected output:
# ============================================================
# x402 QuickNode Auth Flow Test Suite
# ============================================================
# ✅ PASS — Imports
# ✅ PASS — Config
# ✅ PASS — SIWX Message
# ✅ PASS — EIP-712 Data
# ✅ PASS — Endpoint Connectivity
# ✅ PASS — Module Integration
# Results: 6/6 tests passed
```

### 6. Run the Price Fetcher

```bash
python x402_bridge.price_fetcher

# Output should show:
# x402: ENABLED (X402_EVM_PRIVATE_KEY detected)
# Provider pool: 2 active
# ...
# Fetching MON/USD ...
#   MON/USD = $0.123456  [LIVE]
```

---

## Payment Models

### Credit-Drawdown (Recommended)

**How it works:**
1. Authenticate once with SIWX (wallet signature) → get JWT
2. JWT valid for ~1 hour
3. Each request consumes credits automatically
4. When credits exhausted, server auto-buys new bundle
5. Auto-refresh on JWT expiry (transparent re-auth)

**Pros:** Fastest (no per-request signing), simple
**Cons:** JWT expires after ~1 hour (auto-refreshed)

**Config:**
```bash
export X402_PAYMENT_MODEL=credit-drawdown
```

**Auto-refresh behavior:**
```
Request 1:  x402 fetch → 200 OK → return price ✓
...
Request 50: x402 fetch → 401 Unauthorized → AUTO-REFRESH:
              1. POST /auth with SIWX signature
              2. Get new JWT
              3. Retry request → 200 OK → return price ✓
```

### Pay-Per-Request

**How it works:**
1. POST request without payment header
2. If 402, parse `X-PAYMENT-REQUIRED` header
3. Sign EIP-712 `TransferWithAuthorization` (EIP-3009)
4. Retry with `X-Payment` header

**Pros:** No JWT expiry, no session state
**Cons:** Slower (per-request signing), requires `eth-account`

**Config:**
```bash
export X402_PAYMENT_MODEL=pay-per-request
```

**Payment flow:**
```
POST /monad-mainnet → 402
  ↓
X-PAYMENT-REQUIRED: {maxAmount, resource, destination, deadline}
  ↓
Sign EIP-712: USDC.TransferWithAuthorization(from, to, value, validAfter, validBefore, nonce)
  ↓
POST /monad-mainnet + X-Payment: {scheme, network, authorization}
  ↓
200 OK → JSON-RPC response
```

### Nanopayment (Circle Gateway)

**How it works:**
1. One-time USDC deposit to Circle Gateway contract
2. Requests are batched and settled periodically
3. Lower per-request overhead

**Pros:** Lowest per-request cost, batched settlement
**Cons:** Requires Gateway setup and deposit

**Config:**
```bash
export X402_PAYMENT_MODEL=nanopayment
```

See QuickNode docs for Gateway setup.

---

## Credit Economics

### Free Tier

**1,000,000 credits/month per wallet** = **~33,000 requests/day**

| Check Frequency | Requests/Day | Wallets Needed | Status |
|---------------|-------------|---------------|--------|
| Every 1 second | 86,400 | 3 | Still free |
| Every 5 seconds | 17,280 | 1 | Comfortable |
| Every 10 seconds | 8,640 | 1 | Generous headroom |

### Credit Cost

Typical JSON-RPC calls consume **1 credit per request**. Complex calls (e.g., `eth_getLogs` with large ranges) may consume more.

### Monitoring

The x402 module logs credit usage at `INFO` level. Check logs for:
```
INFO: x402 JWT refreshed successfully.
INFO: x402 request: 200 OK (credits remaining: 999,950)
```

---

## Troubleshooting

### "x402: NOT configured" in smoke test

**Cause:** `X402_EVM_PRIVATE_KEY` not set or empty

**Fix:**
```bash
export X402_EVM_PRIVATE_KEY=0x...
# Verify:
python -c "from x402_bridge.quicknode import is_configured; print(is_configured())"
# Should print: True
```

### "401 Unauthorized" after JWT expiry

**Cause:** JWT expired, auto-refresh failed (e.g., `eth-account` not installed)

**Fix:**
```bash
# Install signing library for auto-refresh
pip install eth-account

# Or manually refresh JWT (caches it to .env as X402_JWT_TOKEN)
node auth_sdk.cjs auth
```

### "402 Payment Required" with credit-drawdown

**Cause:** Credits exhausted, wallet has no USDC on payment network

**Fix:**
```bash
# Check wallet balance on Base Sepolia
# Get testnet USDC: https://faucet.coinbase.com/

# Or switch to pay-per-request (uses USDC directly)
export X402_PAYMENT_MODEL=pay-per-request
```

### "403 Forbidden" (Cloudflare 1010)

**Cause:** WAF blocking non-browser requests (common in test environments)

**Fix:** This is usually a transient issue. The provider pool fallback handles this automatically. For production, ensure requests include proper headers:
```python
headers = {
    "Authorization": f"Bearer {jwt_token}",
    "Content-Type": "application/json",
    "User-Agent": "x402-bridge/1.0",
}
```

### "Connection timeout" to x402 endpoint

**Cause:** Endpoint not yet live, DNS issue, or firewall

**Fix:**
```bash
# Test connectivity
curl -I https://x402.quicknode.com

# If unreachable, the provider pool fallback activates automatically
# Verify fallback is configured:
export MONAD_RPC_PRIMARY=https://rpc1.monad.xyz
```

---

## File Reference

| File | Purpose |
|------|---------|
| `src/x402_bridge/quicknode.py` | Python x402 client (credit-drawdown + pay-per-request) |
| `src/x402_bridge/price_fetcher.py` | Price fetcher with x402 as primary provider |
| `src/x402_bridge/auth_sdk.cjs` | Node.js helper (official `@quicknode/x402` SDK) for SIWX auth + live credit-drawdown RPC; used by `live_smoke.py` stages 2/3 |
| `tests/test_x402_auth.py` | Test suite for x402 module validation (offline) |
| `src/x402_bridge/live_smoke.py` | End-to-end live verification (3 staged commands) |
| `.env.example` | Environment variable template |

---

## Security Notes

1. **Private key:** Never commit `X402_EVM_PRIVATE_KEY` to git. Use `.env` files and `.gitignore`.

2. **Wallet isolation:** Use a dedicated wallet for x402, not your main trading wallet. The wallet only needs USDC for API credits.

3. **Network scope:** The private key signs on the **payment network** (Base Sepolia/Base Mainnet), not on Monad. The target network (Monad) is queried, not signed.

4. **JWT caching:** The JWT is stored in-memory only. It is not written to disk. Each process instance authenticates independently.

---

## Live Verification (P2 Unblock)

The `x402_bridge.live_smoke` script is the one-command P2 unblock. Three stages, each independently runnable:

### Stage 1: Pre-flight (no creds required)

```bash
# Address-only — no signing, no network secret exposure
X402_EVM_PRIVATE_KEY_ADDRESS=0x54D928b0593db01BB46b2A5D0c2e4365C6Ac881F \
  python x402_bridge.live_smoke --stage preflight
```

Output:
- EIP-55 checksum validation
- ETH + USDC balance check on Base Sepolia
- SIWX message construction (266 chars)

### Stage 2: SIWX enrollment (requires X402_EVM_PRIVATE_KEY)

Put the key in the gitignored `.env` next to `auth_sdk.cjs` (never commit, never paste in chat):

```
X402_EVM_PRIVATE_KEY_ADDRESS=0x54D928b0593db01BB46b2A5D0c2e4365C6Ac881F
X402_EVM_PRIVATE_KEY=0x...
X402_PAYMENT_NETWORK=eip155:84532
X402_PAYMENT_MODEL=credit-drawdown
```

Then (one-time: install the SDK — see "One-time SDK install" below; set `X402_SDK_NODE_PATH` if you installed it outside the repo):

```bash
python x402_bridge.live_smoke --stage siwx
```

Output:
- SIWX-enroll via the official `@quicknode/x402` SDK. The hand-rolled SIWX message this script used to build was out of EIP-4361 spec (`Chain ID: eip155:84532` instead of the integer `84532`; domain `https://x402.quicknode.com` instead of `x402.quicknode.com`), so `/auth` rejected it with `"Failed to parse SIWE message"`. The SDK builds the message correctly.
- JWT cached to `.env` as `X402_JWT_TOKEN`

### Stage 3: Live RPC (requires the wallet + SDK)

```bash
python x402_bridge.live_smoke --stage live
```

Output:
- One `eth_blockNumber` on `monad-mainnet` via the SDK's `client.fetch`, which adds the credit-drawdown `PAYMENT-SIGNATURE` header and runs the 402 → sign → retry cycle. A bare `Authorization: Bearer` request is insufficient (returns `402 "PAYMENT-SIGNATURE header is required"`).
- Block height reported
- `X-Credits-Remaining` header captured if exposed (often not — the server does not always return it)

### Verified Live (2026-06-22)

The endpoint `https://x402.quicknode.com/monad-mainnet` returns HTTP 402 with this x402 v2 body (truncated):

```json
{
  "x402Version": 2,
  "resource": {"url": "https://x402.quicknode.com/monad-mainnet", ...},
  "accepts": [
    {"scheme": "exact", "network": "eip155:84532", "amount": "1000000",
     "payTo": "0xF46394adDdA95A3d5bCC1124605E3d15D204623C",
     "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
     "extra": {"name": "USDC", "version": "2"}},
    {"scheme": "exact", "network": "eip155:84532", "amount": "1000",
     "payTo": "0xF46394adDdA95A3d5bCC1124605E3d15D204623C",
     "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
     "extra": {"name": "USDC", "version": "2"}},
    {"scheme": "exact", "network": "eip155:84532", "amount": "100",
     "extra": {"name": "GatewayWalletBatched", "verifyingContract":
       "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"}},
    {"scheme": "exact", "network": "eip155:8453",   "amount": "10000000", ...}
  ]
}
```

**Confirmed payment options (Base Sepolia):**
- **per-request**: 1,000,000 (= $1.00 USDC) or 1,000 (= $0.001 USDC) per call
- **nanopayment**: 100 base units per batched call ($0.0001), 7-day timeout, Circle Gateway contract `0x0077777d7EBA4688BDeF3E311b846F25870A19B9`
- **credit-drawdown**: SIWX auth required (not exposed in 402 body); 1M credits/month free tier

Cloudflare 1010 WAF blocks bare `urllib` requests — must use `httpx` with proper `User-Agent: x402-bridge/1.0` header (already handled by `x402_bridge.quicknode.py`).

### Verified Live (2026-07-10) — end-to-end green

With the wallet funded on **Base Sepolia** (0.0005 ETH + 3.00 USDC), `python x402_bridge.live_smoke --stage all` runs all three stages green through the Python entrypoint:

```
[preflight] ✅ ETH 0.000500  ✅ USDC 3.00  ✅ Node + @quicknode/x402 SDK ready
[siwx]      ✅ JWT acquired, cached to .env
[live]      ✅ eth_blockNumber: 86,779,988   (monad-mainnet)
```

Corrections to the original (2026-06-22) write-up above:

- **credit-drawdown is NOT signature-only.** Despite the "1M free credits, no USDC" pitch, the SDK's `client.fetch` sends `Bearer` → receives 402 → signs a per-request payment authorization → retries, and the server verifies that payment against **Base Sepolia USDC**. With 0 USDC the retry returns `402 "Unexpected error verifying payment"`. **USDC on Base Sepolia is required.**
- **The hand-rolled SIWX message (`live_smoke.py` / `quicknode.py`) is out of EIP-4361 spec** and is rejected by `/auth`. Stages 2/3 now delegate to the official `@quicknode/x402` SDK via `auth_sdk.cjs`.
- **`auth_jwt.js` was removed.** It used shell-style `#` comment lines in a `.js` (a `SyntaxError`) and CommonJS `require()` under a root `"type":"module"` `package.json`, so it never executed. `auth_sdk.cjs` (`.cjs` forces CommonJS) replaces it.

### One-time SDK install

`npm install` inside this repo fails with `EUNSUPPORTEDPROTOCOL "workspace:*"` (npm walks up to the pnpm root `package.json`). Install the SDK outside the repo and point the helper at it:

```bash
mkdir -p "$LOCALAPPDATA/Temp/x402sdk"
cd "$LOCALAPPDATA/Temp/x402sdk"
npm install @quicknode/x402 dotenv
export X402_SDK_NODE_PATH="$LOCALAPPDATA/Temp/x402sdk/node_modules"
python x402_bridge.live_smoke --stage all
```

The wallet private key is read from the gitignored `.env` next to `auth_sdk.cjs`; it is never passed on the command line or pasted into a transcript.

---

## Advanced: Multiple Wallets

For high-frequency monitoring (>1 req/second), use multiple wallets to scale credits:

```bash
# Wallet 1
export X402_EVM_PRIVATE_KEY=0x...
export X402_JWT_TOKEN=  # auto-generated
# 1M credits/month

# Wallet 2 (secondary process)
export X402_EVM_PRIVATE_KEY=0x...
export X402_JWT_TOKEN=  # auto-generated
# Another 1M credits/month
```

Run multiple fetcher instances with different wallet env vars, or implement a wallet rotation in `x402_bridge.quicknode.py`.

---

## Links

- **QuickNode x402 Docs:** https://www.quicknode.com/docs/build-with-ai/x402-payments
- **x402 Protocol Spec:** https://github.com/coinbase/x402
- **Base Sepolia Faucet:** https://faucet.coinbase.com/
- **Monad Docs:** https://docs.monad.xyz/
