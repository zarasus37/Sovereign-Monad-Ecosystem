# Sovereign MEV Engine — Revenue Activation Agent Prompt

You are taking over a partially built commercial infrastructure and completing it end-to-end so it generates real revenue. Every technical asset is already live. Your job is to wire up payments, automate key delivery, identify outreach targets, and execute the first outbound campaign. Do not ask for permission at decision points — execute with stated assumptions and report what you did.

---

## What Already Exists (Do Not Rebuild)

### Live API
- **URL:** `https://sovereign-rge-api.sovereign-mev.workers.dev`
- **Engine:** RGE v2 — Monte Carlo risk evaluator for cross-chain arb opportunities
- **Auth:** `x-api-key` header, keys stored in Cloudflare KV namespace `sovereign-api-keys` (ID: `3db6365424c64247b41bf6d31cc3c590`)
- **Endpoints:** `GET /health` (no auth), `GET /config` (auth), `POST /evaluate` (auth)
- **Evaluate payload:** `{ spreadBps, vol, portfolioUsd, bridgeWindowSec }`
- **Evaluate response:** `{ decision, effectiveSpreadBps, kellyFraction, recommendedSizeUsd, expectedValueUsd, sharpeLike, tailLossP95Usd, tailLossPct, bridgeFailureAdjusted, monteCarloRuns, decisionGate, callsRemainingToday }`

### Licensing Tiers (hardcoded in worker.js)
| Tier | Monthly Price | Daily API Calls | AUM Cap |
|---|---|---|---|
| starter | $800 | 1,000 | $5M |
| pro | $2,000 | 10,000 | $25M |
| fund | $5,000 | unlimited | $100M |
| enterprise | custom | unlimited | unlimited |

### Pre-Sale Page
- **URL:** `https://sovereign-web-6rk.pages.dev/sovereign-presale.html`
- **Local file:** `C:\Users\crisc\Dev\agents\monad-mev\sovereign-presale.html`
- Currently wired to Formspree (reservation capture only, no payment)
- Needs to be rewired to Stripe Checkout

### Commercial Landing Page
- **URL:** `https://sovereign-web-6rk.pages.dev/sovereign-commercial.html`
- **Local file:** `C:\Users\crisc\Dev\agents\monad-mev\sovereign-commercial.html`

### Worker Source
- **Local file:** `C:\Users\crisc\Dev\agents\monad-mev\sovereign-worker\src\worker.js`
- **wrangler.toml:** `C:\Users\crisc\Dev\agents\monad-mev\sovereign-worker\wrangler.toml`
- KV binding name in worker: `env.SOVEREIGN_API_KEYS`

### Key Provisioning Script
- **File:** `C:\Users\crisc\Dev\agents\monad-mev\sovereign-worker\provision-key.mjs`
- **Usage:** `node provision-key.mjs "Client Name" "email@domain.com" starter`
- Generates `sk-sovereign-{32 hex}` key, writes JSON to KV via `--path` temp file, prints key to stdout
- Already verified working

### Arb Scout
- **File:** `C:\Users\crisc\Dev\agents\monad-mev\sovereign-worker\arb-scout\scout.py`
- Queries Dune Analytics for Ethereum wallets that have made 5–500 bridge transactions in the last 30 days across Across, Stargate, Hop, Wormhole bridge contracts
- Runs each wallet through the live RGE API
- Generates outreach messages per wallet with real eval numbers
- **Dune API key:** `n2Nszy1ReGgouxvZy1koOI0dpG1mPPpe`
- **Internal scout API key:** `sk-sovereign-63bf83724a3ed42bb3ee2951c9423509`
- **Run:** `python scout.py --dune-key n2Nszy1ReGgouxvZy1koOI0dpG1mPPpe --limit 15 --output reports.json`
- Latest reports already saved at: `C:\Users\crisc\Dev\agents\monad-mev\sovereign-worker\arb-scout\reports.json`

### Cloudflare Deployment
- **Worker deploy:** `cd C:\Users\crisc\Dev\agents\monad-mev\sovereign-worker && wrangler deploy`
- **Pages deploy:** `cd C:\Users\crisc\Dev\agents\monad-mev && wrangler pages deploy . --project-name sovereign-web`
- wrangler is installed globally, user is authenticated
- Python is at: `C:\Users\crisc\AppData\Local\Programs\Python\Python313\python.exe`
- Node/npm available in PATH

---

## What You Need to Build

### Task 1 — Stripe Payment Integration

**Goal:** When a customer clicks "Reserve" on the pre-sale page, they pay immediately via Stripe Checkout. On successful payment, their API key is automatically provisioned and emailed to them.

**Step 1a — Stripe products**
Create three Stripe products with recurring monthly prices:
- Founding Starter: $800/mo → metadata `tier=starter`
- Founding Pro: $2,000/mo → metadata `tier=pro`
- Founding Fund: $5,000/mo → metadata `tier=fund`

Use the Stripe API (`POST https://api.stripe.com/v1/prices`) with the user's Stripe secret key. Store the resulting price IDs — you'll need them in the checkout session creation.

**Step 1b — Checkout session endpoint**
Add `POST /checkout` to `worker.js`. This endpoint:
- Accepts `{ tier, clientName, email }` in the request body (no auth required — this is called before the customer has a key)
- Creates a Stripe Checkout Session via `https://api.stripe.com/v1/checkout/sessions` with:
  - `mode: subscription`
  - `payment_method_types: [card]`
  - `line_items: [{ price: PRICE_ID_FOR_TIER, quantity: 1 }]`
  - `customer_email: email`
  - `metadata: { tier, clientName, email }`
  - `success_url: https://sovereign-web-6rk.pages.dev/sovereign-presale.html?status=success`
  - `cancel_url: https://sovereign-web-6rk.pages.dev/sovereign-presale.html?status=cancelled`
- Returns `{ url: checkoutSessionUrl }`

The Stripe secret key must be stored as a Cloudflare Worker secret: `wrangler secret put STRIPE_SECRET_KEY`

**Step 1c — Stripe webhook endpoint**
Add `POST /webhook/stripe` to `worker.js`. This endpoint:
- Reads the raw request body as text (required for signature verification)
- Verifies the `Stripe-Signature` header using HMAC-SHA256 against `STRIPE_WEBHOOK_SECRET`
  - Stripe signature format: `t=timestamp,v1=signature`
  - Compute: `HMAC-SHA256(key=STRIPE_WEBHOOK_SECRET, msg="${timestamp}.${rawBody}")`
  - Compare computed hex to the `v1=` value in the header
- If verification fails → return 400
- Parse the event body as JSON
- Handle only `checkout.session.completed` events:
  1. Extract `metadata.tier`, `metadata.clientName`, `metadata.email` from the session
  2. Generate API key: `sk-sovereign-` + 32 random hex chars (use `crypto.getRandomValues`)
  3. Write to KV: key = apiKey, value = `JSON.stringify({ clientName, email, tier, createdAt: today, aumCapUsd: TIERS[tier].aumCapUsd, dailyCallLimit: TIERS[tier].dailyLimit })`
  4. Send key delivery email via Resend (see Task 2)
  5. Return 200 `{ received: true }`
- Return 200 for all unhandled event types (Stripe requires 200 to stop retrying)

Store the webhook secret: `wrangler secret put STRIPE_WEBHOOK_SECRET`

After deploying the updated worker, register the webhook in Stripe Dashboard → Developers → Webhooks:
- Endpoint URL: `https://sovereign-rge-api.sovereign-mev.workers.dev/webhook/stripe`
- Events: `checkout.session.completed`

**Step 1d — Pre-sale page update**
Replace the current `submitReservation()` function in `sovereign-presale.html`. The new flow:
- On form submit, POST to `https://sovereign-rge-api.sovereign-mev.workers.dev/checkout` with `{ tier, clientName, email }`
- On success, redirect the browser to the returned `url` (the Stripe hosted checkout page)
- Handle errors gracefully with an inline message

**Step 1e — Success/cancel state**
Add handling to the pre-sale page for the `?status=success` and `?status=cancelled` URL params:
- `success`: show "Payment received. Your API key will arrive in your inbox within 60 seconds."
- `cancelled`: show "Checkout cancelled. Your spot is still available." and restore the form

---

### Task 2 — Automated Key Delivery Email

**Goal:** Within 60 seconds of a successful Stripe payment, the customer receives an email with their API key, endpoint URL, and quickstart instructions.

Use **Resend** (`https://api.resend.com/emails`) — simple REST API, generous free tier.

Store the API key: `wrangler secret put RESEND_API_KEY`

The key delivery email content (HTML):

```
Subject: Your Sovereign MEV Engine API Key — [Tier] Access

You're in.

API Key:    sk-sovereign-XXXX...
Endpoint:   https://sovereign-rge-api.sovereign-mev.workers.dev
Tier:       [Tier Name]
Daily limit: [N] calls/day

Quickstart (POST /evaluate):

  curl -X POST https://sovereign-rge-api.sovereign-mev.workers.dev/evaluate \
    -H "x-api-key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"spreadBps": 80, "vol": 0.00694, "portfolioUsd": 500000, "bridgeWindowSec": 900}'

Response fields:
  decision           — APPROVE or REJECT
  effectiveSpreadBps — spread after vol decay and costs
  recommendedSizeUsd — Kelly-optimal position size
  expectedValueUsd   — mean P&L across 1,000 Monte Carlo paths
  sharpeLike         — EV/StdDev ratio
  tailLossP95Usd     — worst-case loss at 5th percentile
  callsRemainingToday — remaining calls in your daily quota

Questions? Reply to this email.
```

Send from: `keys@sovereignmev.com` (or `onboarding@resend.dev` if domain not yet verified)
Send to: customer email from Stripe metadata

---

### Task 3 — Wallet Identity Lookup

**Goal:** Take the 50 wallet addresses in `reports.json` and find real identities (ENS names, Twitter/X handles, Farcaster usernames) so outreach messages can be addressed to a person, not an address.

**Input file:** `C:\Users\crisc\Dev\agents\monad-mev\sovereign-worker\arb-scout\reports.json`
Each entry has a `wallet` field (checksummed Ethereum address).

**Step 3a — ENS lookup**
For each wallet, call:
```
GET https://api.ensdata.net/{wallet}
```
Response may include: `ens` (primary ENS name), `twitter`, `github`, `avatar`

Rate limit: be polite, add 200ms delay between requests.

**Step 3b — Farcaster lookup**
For wallets that have no ENS result, try:
```
GET https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses={wallet}
```
Requires a Neynar API key (free tier at neynar.com). If no Neynar key is available, skip this step.

**Step 3c — Twitter cross-reference**
If the ENS record returns a Twitter handle, that's the contact. Append it to the wallet record.

**Step 3d — Output**
Write an enriched `reports_enriched.json` with the same structure as `reports.json` but with an updated `identity` block:
```json
{
  "wallet": "0x...",
  "identity": {
    "ens": "name.eth",
    "twitter": "handle",
    "farcaster": "fname",
    "displayName": "Best available name for salutation"
  },
  "outreach": {
    "message": "...",
    "contactVia": "twitter | farcaster | ens_dm | unknown",
    "ready": true
  }
}
```

Mark `ready: false` for any wallet where no identity was found.

---

### Task 4 — Outreach Execution

**Goal:** Send the outreach messages to every wallet where `identity.ready = true`.

**The outreach message is already generated** in each entry's `report` field. Do not rewrite it — use it verbatim, substituting the identity's display name into the salutation if available.

**Channel priority:**
1. **Twitter/X DM** — if `identity.twitter` is set, the message goes there
2. **Farcaster DM** — if `identity.farcaster` is set and no Twitter, use Warpcast DM via Neynar API
3. **ENS contact** — if the ENS record has a `url` or `email` field, use it
4. **Skip** — if none of the above, mark `contactVia: unknown` and log it

**For Twitter DMs:**
Use the Twitter/X API v2 (`POST https://api.twitter.com/2/dm_conversations/with/:participant_id/messages`). Requires a Twitter Developer App with DM write permissions.
If Twitter API credentials are not available, output the final message list as a formatted text file `outreach_ready.txt` — one block per wallet — so the user can send manually.

**For Farcaster DMs:**
Use Neynar API: `POST https://api.neynar.com/v2/farcaster/message/direct` with the sender FID and recipient FID.

**Output regardless of channel:**
Write `outreach_log.json`:
```json
[
  {
    "wallet": "0x...",
    "identity": { ... },
    "contactVia": "twitter",
    "handle": "@someone",
    "messageSent": true,
    "timestamp": "2026-04-17T...",
    "messagePreview": "Hey — noticed your wallet..."
  }
]
```

---

### Task 5 — Custom Domain (Optional but Recommended)

The current Pages URL `sovereign-web-6rk.pages.dev` reads as a demo. If the user has a domain they want to use:
1. Add it in Cloudflare Pages → Custom domains
2. Update all hardcoded references in `sovereign-presale.html`, `sovereign-commercial.html`, and `worker.js` success/cancel URLs

If no domain is available, skip this task and note it in the summary.

---

## Credentials Needed From the User

Before starting, ask the user for the following. Do not proceed with Tasks 1–2 without them:

1. **Stripe Secret Key** — `sk_live_...` or `sk_test_...` (test mode is fine to verify the flow first)
2. **Resend API Key** — from resend.com dashboard
3. **Sending email address** — what should the key delivery email come from
4. **Neynar API Key** (optional) — for Farcaster identity/DM. Skip if not available.
5. **Twitter API credentials** (optional) — for DM sending. Skip if not available; fall back to `outreach_ready.txt`.

---

## Execution Order

1. Get credentials from user
2. Create Stripe products and capture price IDs
3. Update `worker.js` with `/checkout` and `/webhook/stripe` endpoints
4. Add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` as Worker secrets
5. Deploy updated worker: `wrangler deploy` from `sovereign-worker/`
6. Register Stripe webhook pointing to the live worker URL
7. Update `sovereign-presale.html` to use the new checkout flow
8. Deploy updated pages: `wrangler pages deploy` from `monad-mev/`
9. Test end-to-end with a Stripe test card (`4242 4242 4242 4242`)
10. Verify key delivery email arrives and key authenticates against the live API
11. Run wallet identity lookup on all 50 wallets in `reports.json`
12. Send outreach to all wallets with identified contacts
13. Write summary of what was sent, to whom, and via what channel

---

## Success Criteria

- A test payment through Stripe results in an API key in the inbox within 60 seconds and that key returns HTTP 200 from the live `/evaluate` endpoint
- All wallets in `reports.json` have been checked for ENS/Twitter/Farcaster identity
- Every wallet with an identified contact has received the outreach message
- `outreach_log.json` exists and accounts for all 50 wallets (sent or skipped with reason)
- `reports_enriched.json` exists with updated identity blocks

---

## File Reference

```
C:\Users\crisc\Dev\agents\monad-mev\
├── sovereign-presale.html          ← pre-sale page (edit for Stripe)
├── sovereign-commercial.html       ← landing page
├── sovereign-worker\
│   ├── src\worker.js               ← live worker (add /checkout + /webhook/stripe)
│   ├── wrangler.toml               ← KV binding + env vars
│   ├── provision-key.mjs           ← manual key provisioning (keep, still useful)
│   └── arb-scout\
│       ├── scout.py                ← wallet scout
│       ├── reports.json            ← 50 wallet reports (input for identity lookup)
│       └── reports_enriched.json  ← output of identity lookup (create this)
```

---

## Notes

- The worker uses `env.SOVEREIGN_API_KEYS` for KV access. Secrets added via `wrangler secret put` are available as `env.SECRET_NAME`.
- Cloudflare Workers do not have Node.js `crypto` — use `crypto.subtle` (Web Crypto API) for HMAC verification. Example for Stripe signature: `crypto.subtle.importKey` + `crypto.subtle.sign`.
- KV writes are eventually consistent. The key will be available within ~1 second of the webhook completing.
- The worker's TIERS constant must stay in sync with what Stripe charges. If you add a new price, update both.
- Do not store Stripe keys in `wrangler.toml` — use `wrangler secret put` only.
- Python is at `C:\Users\crisc\AppData\Local\Programs\Python\Python313\python.exe`. Use full path if running scripts from Desktop Commander.
- When running wrangler from Desktop Commander, set `cwd` to the user's home directory or the project directory to avoid the `C:\Windows\System32\.wrangler\cache` permission error.
