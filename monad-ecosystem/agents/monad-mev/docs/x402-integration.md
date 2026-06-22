# x402 QuickNode Integration Guide

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
│                    monad_price_fetcher.py                   │
├─────────────────────────────────────────────────────────────┤
│  x402 provider (primary)     │  Provider pool (fallback)     │
│  ─────────────────────────   │  ─────────────────────────   │
│  x402_quicknode.fetch()      │  Alchemy / QuickNode / dRPC   │
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
# Python dependencies (already in monad_price_fetcher.py)
pip install httpx

# Optional: for pay-per-request signing
pip install eth-account

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

### 5. Run the Test

```bash
# Test the x402 module without running the full fetcher
python test_x402_auth.py

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
python monad_price_fetcher.py

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
python -c "from x402_quicknode import is_configured; print(is_configured())"
# Should print: True
```

### "401 Unauthorized" after JWT expiry

**Cause:** JWT expired, auto-refresh failed (e.g., `eth-account` not installed)

**Fix:**
```bash
# Install signing library for auto-refresh
pip install eth-account

# Or manually refresh JWT
node get_x402_jwt.js --json
export X402_JWT_TOKEN=<output>
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
    "User-Agent": "monad-mev-fetcher/1.0",
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
| `x402_quicknode.py` | Python x402 client (credit-drawdown + pay-per-request) |
| `monad_price_fetcher.py` | Price fetcher with x402 as primary provider |
| `get_x402_jwt.js` | Node.js helper for JWT (optional, fallback only) |
| `test_x402_auth.py` | Test suite for x402 module validation |
| `.env.example` | Environment variable template |

---

## Security Notes

1. **Private key:** Never commit `X402_EVM_PRIVATE_KEY` to git. Use `.env` files and `.gitignore`.

2. **Wallet isolation:** Use a dedicated wallet for x402, not your main trading wallet. The wallet only needs USDC for API credits.

3. **Network scope:** The private key signs on the **payment network** (Base Sepolia/Base Mainnet), not on Monad. The target network (Monad) is queried, not signed.

4. **JWT caching:** The JWT is stored in-memory only. It is not written to disk. Each process instance authenticates independently.

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

Run multiple fetcher instances with different wallet env vars, or implement a wallet rotation in `x402_quicknode.py`.

---

## Links

- **QuickNode x402 Docs:** https://www.quicknode.com/docs/build-with-ai/x402-payments
- **x402 Protocol Spec:** https://github.com/coinbase/x402
- **Base Sepolia Faucet:** https://faucet.coinbase.com/
- **Monad Docs:** https://docs.monad.xyz/
