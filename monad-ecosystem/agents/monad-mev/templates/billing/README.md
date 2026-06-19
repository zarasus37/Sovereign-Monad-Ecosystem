# Billing Service Template

This package handles Step 6 of the commercialization path:

- Stripe Checkout for recurring subscriptions
- Stripe Customer Portal for self-service billing changes
- first-party sales and presale inquiry capture
- Stripe webhooks that issue or deactivate API keys in the shared key store
- Manual CLI issuance for USDC-paid customers

## Endpoints

- `POST /checkout/session`
- `POST /portal/session`
- `POST /sales/request`
- `POST /webhooks/stripe`
- `GET /health`
- `GET /success`
- `GET /cancel`
- `GET /account`

For public deployment behind the commercial edge stack, this service should sit behind:

- `https://billing.<root-domain>`

## Why this shape

Stripe Checkout plus Billing is the fastest correct path for recurring SaaS-style licensing.
It avoids building renewal, retry, and dunning logic manually.

## Shared state

By default this service writes to:

`../api/config/api-keys.json`

That keeps payment events aligned with the Starter/Pro/Fund API access layer.

Lead and presale intake is persisted to:

`./config/inquiries.json`

That keeps fund, enterprise, demo, and presale requests inside the first-party stack instead of relying on a third-party form sink.

## Manual USDC path

For crypto-native buyers, the first version stays operationally simple:

1. buyer sends USDC to your wallet
2. you verify settlement
3. you issue a key with:

```bash
npm run issue-manual-key -- "Client Name" fund client@example.com "USDC tx 0xabc..."
```

## Required Stripe setup

- create recurring Stripe Prices for the tiers you want live checkout on
- Starter and Pro monthly/annual prices are required for the commercial self-serve path
- Fund and Enterprise prices are optional unless you want those tiers to go through Stripe Checkout instead of manual sales handling
- place the Price IDs in `.env`
- configure the webhook endpoint to point at `/webhooks/stripe`
- subscribe to:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`

## Local health check

```bash
curl http://127.0.0.1:3010/health
```

For the cleanest local path, prefer the combined stack in `templates/commercial-stack/`.
Use `docker-compose.yml` plus `docker-compose.local.yml` for local checks, or `docker-compose.prod.yml` for localhost-only production binding.
