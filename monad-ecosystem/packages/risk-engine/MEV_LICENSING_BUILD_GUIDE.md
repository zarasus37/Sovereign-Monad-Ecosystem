# Sovereign MEV Engine - Licensing Build Guide

## Current state to first paying customer

This guide reflects what is actually built in the repo now.

It is no longer a speculative plan for an `api/` folder or a notional Docker package. The implementation lives in the existing paths below.

---

## Current implementation status

| Step | Status | What exists now |
|------|--------|-----------------|
| 1. Demo package | Built | `demo-package/` now runs with synthetic feeds and a demo risk engine |
| 2. HTTP API wrapper | Built | `templates/api/` exposes `/evaluate`, `/health`, `/config` |
| 3. API key management | Built | JSON-backed key store with tier and AUM enforcement in `templates/api/` |
| 4. Fund / Enterprise Docker packaging | Built | `docker-compose.licensed.yml`, activation scripts, license-service template |
| 5. One-pager | Built | `docs/ONE-PAGER.md` rewritten around actual risk-engine differentiators |
| 6. Payments | Built as scaffold | `templates/billing/` plus `docs/PAYMENTS.md` |

The remaining work is not core product construction. It is live operations: real Stripe configuration, public deployment, domains, and outreach.

---

## What is built now

### Step 1 - Demo package

Path: `demo-package/`

What the buyer can do now:

```bash
cd demo-package
docker compose -f docker-compose.demo.yml up --build
```

What they see:

- synthetic market feeds
- spread detection
- opportunity candidate generation
- demo risk-engine decisions with approve / reject output

Relevant files:

- `demo-package/docker-compose.demo.yml`
- `demo-package/demo-market-agent/src/index.ts`
- `demo-package/demo-scanner/src/index.ts`
- `demo-package/demo-risk-engine/src/index.ts`
- `demo-package/README.md`

This is now a product demo for the evaluation layer rather than a spread-scanner toy.

### Step 2 - Starter / Pro API wrapper

Path: `templates/api/`

Endpoints:

- `POST /evaluate`
- `GET /health`
- `GET /config`

Relevant files:

- `templates/api/src/index.ts`
- `templates/api/src/evaluator.ts`
- `templates/api/src/config.ts`
- `templates/api/README.md`
- `templates/api/.env.example`
- `templates/api/Dockerfile`

### Step 3 - API key management and tier enforcement

Path: `templates/api/`

What is enforced:

- API key auth via `X-API-Key`
- tier identity
- AUM cap checks
- daily request limits

Relevant files:

- `templates/api/src/keystore.ts`
- `templates/api/config/api-keys.json`

Current commercial mapping:

| Tier | Price | AUM cap | Request limit |
|------|-------|---------|---------------|
| Starter | $1,000/mo | <= $5M | 1,000/day |
| Pro | $2,500/mo | <= $25M | 10,000/day |
| Fund | $5,000/mo | <= $100M | unlimited |
| Enterprise | $10,000+/mo | unlimited | unlimited |

### Step 4 - Fund / Enterprise licensed delivery

Paths:

- `docker-compose.licensed.yml`
- `scripts/activate-license.sh`
- `scripts/validate-license.sh`
- `scripts/deploy-licensed.sh`
- `scripts/health-check.sh`
- `docs/LICENSED-DEPLOYMENT.md`
- `templates/license-service/`

What exists now:

- a licensed compose overlay that fails fast if activation metadata is missing
- startup-time validation before bringing up a licensed stack
- a file-backed license activation server template with activate / validate endpoints

This is sufficient for initial commercial delivery. It is not yet a managed production licensing service.

### Step 5 - One-pager

Path: `docs/ONE-PAGER.md`

It now sells the actual product:

- bridge-latency-aware edge decay
- fractional Kelly sizing
- correlated Monte Carlo evaluation
- Docker and API packaging
- buyer fit by customer segment

### Step 6 - Payment and subscription handling

Paths:

- `templates/billing/`
- `docs/PAYMENTS.md`

What exists now:

- Stripe Checkout session endpoint
- Stripe Customer Portal session endpoint
- Stripe webhook handling for subscription create / update / cancel / payment failure
- shared API-key issuance and deactivation through the same key store used by `templates/api`
- manual CLI issuance flow for USDC-paid customers

Relevant files:

- `templates/billing/src/index.ts`
- `templates/billing/src/client-store.ts`
- `templates/billing/src/webhooks.ts`
- `templates/billing/src/cli.ts`
- `templates/billing/.env.example`
- `templates/billing/Dockerfile`

---

## Remaining live pieces

Substantial repo product work is done. The live-commercial work still needed is operational:

1. Create real Stripe Prices and webhook secrets.
2. Deploy the public commercial services.
3. Put domains and TLS in front of those services.
4. Populate the license-service store with real customer license records.
5. Start outreach and convert demo users into API or self-hosted buyers.

Those are go-live tasks, not core product construction tasks.

---

## Public commercial deployment

Path: `templates/commercial-stack/`

This is the current public-facing service bundle:

- `smev-api` on port `3000`
- `smev-billing` on port `3010`
- `smev-license-service` on port `4010`

Quick start:

```bash
cd templates/commercial-stack
copy .env.api.example .env.api
copy .env.billing.example .env.billing
copy .env.license-service.example .env.license-service
docker compose up -d --build
```

Relevant files:

- `templates/commercial-stack/docker-compose.yml`
- `templates/commercial-stack/README.md`

---

## Real values still required before launch

### Stripe

You still need to add:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_STARTER_PRICE_ID`
- `STRIPE_PRO_PRICE_ID`
- `STRIPE_FUND_PRICE_ID`
- `STRIPE_ENTERPRISE_PRICE_ID`

### Public URLs

You still need real values for:

- API domain
- billing success URL
- billing cancel URL
- billing portal return URL
- public license-service URL

### Licensed delivery

You still need to host the activation service used by:

- `scripts/activate-license.sh`
- `scripts/validate-license.sh`

The repo contains the server template. It does not host itself.

---

## Verification status

What has been verified in this repo work:

- demo-package TypeScript builds completed
- `templates/api` TypeScript build completed
- `templates/license-service` TypeScript build completed
- licensed compose overlay resolved successfully with generated activation metadata
- billing package source scaffold is in place and dependencies install successfully

Known environment limitation during local verification:

- direct Node execution in this Windows environment intermittently fails with `EPERM` on `c:\Users\crisc\Dev`
- because of that, I am not claiming a clean runtime verification for every Node package from this machine

This is an environment issue, not an intentional omission in the implementation.

---

## Commands you will actually use

### Demo

```bash
cd demo-package
docker compose -f docker-compose.demo.yml up --build
```

### API

```bash
cd templates/api
copy .env.example .env
npm install
npm run dev
```

### Billing

```bash
cd templates/billing
copy .env.example .env
npm install
npm run dev
```

### Manual USDC key issuance

```bash
cd templates/billing
npm run issue-manual-key -- "Client Name" fund client@example.com "USDC tx 0xabc..."
```

### Licensed Fund / Enterprise deployment

```bash
./scripts/activate-license.sh SMEV-FUND-ALPHA
./scripts/deploy-licensed.sh
./scripts/health-check.sh
```

### Public commercial stack

```bash
cd templates/commercial-stack
docker compose up -d --build
```

---

## Where first revenue should come from

Best first buyers:

- small crypto funds
- crypto prop desks on Base / Arbitrum
- DeFi treasury operators with idle inventory

Sales path:

1. run the demo
2. offer Starter or Pro API access for evaluation
3. move larger buyers to the self-hosted Fund package

---

## Canonical file locations

| What | Where |
|------|-------|
| Buyer demo | `demo-package/` |
| API product | `templates/api/` |
| Billing product | `templates/billing/` |
| License activation service | `templates/license-service/` |
| Public commercial stack | `templates/commercial-stack/` |
| Licensed self-hosted deployment docs | `docs/LICENSED-DEPLOYMENT.md` |
| Payments docs | `docs/PAYMENTS.md` |
| One-pager | `docs/ONE-PAGER.md` |
| Licensing boundaries | `docs/LICENSING.md` |

---

## Bottom line

The repo is no longer missing the main commercial product surfaces.

What remains between here and first revenue is live configuration, deployment, buyer acquisition, and keeping repo artifacts distinct from canonical phase claims.
