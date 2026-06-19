# Sovereign RGE v2 API — Cloudflare Worker Deployment

## What this is
The canonical RGE v2 risk evaluation engine deployed as a Cloudflare Worker.
- Zero hosting cost (Cloudflare free tier: 100,000 requests/day)
- Globally distributed, <10ms cold start
- KV namespace already provisioned: `sovereign-api-keys`

## Prerequisites

```bash
npm install -g wrangler
wrangler login        # authenticate to your Cloudflare account
```

## Deploy (one command)

```bash
cd sovereign-worker
wrangler deploy
```

Your API will be live at:
`https://sovereign-rge-api.<your-subdomain>.workers.dev`

## Test it immediately

```bash
# Health check (no auth)
curl https://sovereign-rge-api.<subdomain>.workers.dev/health

# Evaluate an opportunity
curl -X POST https://sovereign-rge-api.<subdomain>.workers.dev/evaluate \
  -H "x-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "spreadBps": 35,
    "vol": 0.80,
    "portfolioUsd": 10000
  }'
```

## Provision your first API key

```bash
node provision-key.mjs "Client Name" "client@example.com" starter
# → generates sk-sovereign-<32hex> and writes to KV
```

## Tiers

| Tier       | Daily Limit | AUM Cap      |
|------------|-------------|--------------|
| starter    | 1,000       | $5M          |
| pro        | 10,000      | $25M         |
| fund       | Unlimited   | $100M        |
| enterprise | Unlimited   | None         |

## KV Namespace (already live)
- Name: `sovereign-api-keys`
- ID: `3db6365424c64247b41bf6d31cc3c590`
- Bound in wrangler.toml as `SOVEREIGN_API_KEYS`
