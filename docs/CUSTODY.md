# CUSTODY — Key & Secret Management Procedure

> **Source:** `docs/ISSUES/testnet-custody-review.md` (the tracking
> ticket) + the existing `keyCustody.ts` (the production code path).
> This document is the **canonical procedure** that the Steward
> Council must sign off on before any `CARDIA_FUNDING_LIVE=true` flip
> on production.
>
> **Why this exists:** `pnpm testnet:cycle` and the testnet deploy
> workflow pass `BOOTSTRAP_PRIVATE_KEY` as a GitHub Actions secret.
> That's a real private key that can sign USDC transfers on the
> testnet. Whoever holds it controls the funds of the bootstrap
> source wallet. Without a written procedure, "deliberate custody
> review" is subjective and ad-hoc.

## 1. The two boundaries

There are **two distinct custody boundaries** in the testnet → production flow:

```
┌────────────────────────────────────────────────────────────────┐
│  TESTNET (custody level 1)                                    │
│  - GitHub Actions secret: BOOTSTRAP_PRIVATE_KEY (testnet key)  │
│  - GitHub Actions secret: SOVEREIGN_API_TOKEN (testnet token)  │
│  - The testnet key signs testnet USDC transfers ONLY.          │
│  - Testnet USDC has no real-world value.                       │
│  - Compromise = lost testnet funds, NOT a real-money incident. │
└────────────────────────────────────────────────────────────────┘
                              │
                              │  Deliberate crossover
                              │  (operator action, see §5)
                              ▼
┌────────────────────────────────────────────────────────────────┐
│  PRODUCTION (custody level 2)                                  │
│  - Azure Key Vault: BOOTSTRAP-DEPLOYER-KEY (the prod secret)   │
│  - Secret name, not the key bytes themselves.                  │
│  - Fetched at host startup via `keyCustody.ts` (managed        │
│    identity preferred, service principal fallback).            │
│  - Compromise = real-money incident. Steward Council            │
│    escalation. Key rotation within hours.                      │
└────────────────────────────────────────────────────────────────┘
```

**Critical rule:** the testnet key is **NEVER** the production key.
A testnet compromise must not be able to sign production transfers.
This is enforced by the fact that the two keys live in different
storage systems (GitHub Secrets vs Azure Key Vault) with different
access paths (PR-time env injection vs Container-App startup with
managed identity).

## 2. The security matrix

| Secret | Testnet storage | Production storage | Testnet rotation | Production rotation | Failure mode |
|---|---|---|---|---|---|
| `BOOTSTRAP_PRIVATE_KEY` | GitHub Actions secret `BOOTSTRAP_PRIVATE_KEY` (workflow env) | Azure Key Vault secret `BOOTSTRAP-DEPLOYER-KEY` (fetched at startup) | Every successful cycle, OR after 30 days, OR immediately on incident | Monthly, OR immediately on incident | Engine signs USDC transfers; if leaked, attacker can drain the bootstrap wallet up to its balance |
| `SOVEREIGN_API_TOKEN` | GitHub Actions secret `SOVEREIGN_API_TOKEN` (workflow env) | Azure Container App env var `SOVEREIGN_API_TOKEN` (set once at deploy, rotated via `az containerapp update`) | Every cycle (cheap to rotate) | Quarterly | Attacker can hit any host route that requires auth (Cardia trigger, gate-acl, etc.). Doesn't move money directly. |
| `SOVEREIGN_PRINCIPAL_ID` | GitHub Actions secret `SOVEREIGN_PRINCIPAL_ID` | Azure Container App env var | Static (no rotation) | Static | Identifies the host's principal; rotating is a code change, not a secret rotation. |
| `STABLECOIN_CONTRACT` | GitHub Actions secret `STABLECOIN_CONTRACT` (testnet USDC address) | Azure Container App env var `STABLECOIN_CONTRACT` (mainnet USDC address) | Static (testnet USDC is a known constant) | Static (mainnet USDC is a known constant) | Wrong address = funding goes to a non-existent contract. Verify against the canonical Monad testnet/mainnet USDC contract. |
| `MONAD_RPC_URL` | GitHub Actions secret `MONAD_RPC_URL` (testnet RPC) | Azure Container App env var `MONAD_RPC_URL` (mainnet RPC) | Static (use a public testnet RPC) | Static (use a paid/owned mainnet RPC for production) | Wrong endpoint = engine can't sign; the audit step would fail closed. |
| `TESTNET_WALLET` | GitHub Actions secret `TESTNET_WALLET` (the wallet to fund in testnet cycles) | N/A — this is a testnet-only artifact | Static per cycle | N/A | Wrong address = funding goes to wrong wallet. The wallet is funded, not drained. |
| `AZURE_CREDENTIALS` | GitHub Actions secret `AZURE_CREDENTIALS` (Service Principal JSON for `testnet-infrastructure-rg`) | GitHub Actions secret `AZURE_CREDENTIALS` (a DIFFERENT Service Principal for prod RG) | Every 90 days, OR immediately on incident | Every 90 days, OR immediately on incident | Attacker can push images to ACR, update the Container App, exfiltrate logs. Doesn't directly sign funding. |
| `KEY_VAULT_NAME` | N/A (Azure Key Vault not used in testnet cycle) | Azure Container App env var `KEY_VAULT_NAME` (e.g. `sovereign-kv-20260721`) | N/A | Static (the vault name is part of the prod infra) | Wrong name = host falls back to `BOOTSTRAP_PRIVATE_KEY` env var, which we set to fail-fast in prod. The misconfig fails the host's `isKeyCustodyConfigured()` check at boot. |
| `REDIS_URL` | N/A unless testnet uses Redis (current cycle uses in-memory fallback) | Azure Container App env var `REDIS_URL` | N/A | Per session; rotate per session if compromised | Wrong Redis = funding engine uses in-memory nonces (degraded mode). Not a real-money risk, but two-instance deployment could double-spend nonces. |
| `Hepar API URL` | N/A (Hepar in `HEPAR_AUDIT_MODE=local` for testnet) | Azure Container App env var `HEPAR_API_URL` (hepar-service in prod) | N/A | Static | Wrong URL = Hepar gate fails closed; engine returns AUDIT_FAILED. |

## 3. Access matrix (who can touch what)

| Person / role | GitHub Secrets | Azure Key Vault | Container App env vars | Local `.env` files |
|---|---|---|---|---|
| Founder (xKryptic) | full | full | full (via `az containerapp update`) | full |
| Steward Council member | read-only (per default GitHub permissions) | none (vault uses managed identity, not user creds) | none (RBAC: Contributor or higher on the resource group) | n/a |
| CI runner | read-only (env at workflow time) | none (uses managed identity, not user creds) | none | none |
| Anyone with the testnet private key | can sign testnet USDC transfers | n/a | n/a | n/a |
| Anyone with the prod private key | can sign real USDC transfers | can sign real USDC transfers | n/a | n/a |

**The contract:** the only way to move real money is to hold either
`BOOTSTRAP_PRIVATE_KEY` (testnet) or the Key Vault secret
`BOOTSTRAP-DEPLOYER-KEY` (production). Both have tightly scoped
ownership; both are auditable.

## 4. Generation procedure (one-time, per environment)

**Testnet:**
```bash
# Generate a fresh key — DO NOT reuse any prior key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Address: 0x<derive the address from the same key via ethers>
# Fund with testnet MON (for gas) + testnet USDC (for funding)
# Add to GitHub repo secrets as BOOTSTRAP_PRIVATE_KEY
# Add the wallet address as TESTNET_WALLET
```

**Production:**
```bash
# Generate a fresh key — different from testnet
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Store in Azure Key Vault as BOOTSTRAP-DEPLOYER-KEY
#   (az keyvault secret set --vault-name sovereign-kv-20260721 \
#    --name BOOTSTRAP-DEPLOYER-KEY --value <hex-key>)
# The host fetches this at startup via keyCustody.ts
# Assign Managed Identity to the Container App:
#   az containerapp identity assign --name cardia-testnet-host \
#   --resource-group testnet-infrastructure-rg \
#   --user-assigned <mi-resource-id>  # if user-assigned; omit for system-assigned
# Grant the MI "Key Vault Secret User" role:
#   az role assignment create --assignee <mi-principal-id> \
#   --role "Key Vault Secret User" --scope /subscriptions/.../vaults/sovereign-kv-20260721
```

## 5. Testnet → production crossover

This is the only place where custody gets touched. **This must be
deliberate, written, and Steward-Council-signed.**

1. **Generate a fresh production key** (see §4). The production
   key is **never** the testnet key, ever, for any reason.
2. **Store in Key Vault** (see §4).
3. **Run a dry-run testnet cycle** with `CARDIA_FUNDING_LIVE=true`
   and the testnet key — verify the engine's audit pass rate is
   honest, not 100%.
4. **Run a small live testnet cycle** (1 USDC transfer) — verify
   the ERC-20 lands on the test wallet.
5. **Run a full TIER_1 testnet cycle** (15000 USDC) — verify the
   amount, audit trace, and txHash all match the engine's response.
6. **Steward Council sign-off** — record the decision in
   `docs/COUNCIL_DECISIONS.md` with the date, deciding party, and
   a hash of the production key fingerprint (not the key itself).
7. **Promote to production**:
   - `CARDIA_FUNDING_LIVE=true` on the production Container App
   - The host reads `KEY_VAULT_NAME` and fetches
     `BOOTSTRAP-DEPLOYER-KEY` from Key Vault at boot
   - The first production cycle runs against the production key
8. **Audit log entry** for each production transfer in
   `docs/AUDIT-LOG/<YYYY-MM-DD>-<mandateId>.md` capturing the
   mandate ID, status, txHash, amount, principal, and the
   workflow run URL.

## 6. Incident response (key compromise)

If a testnet or production key is suspected compromised:

1. **Testnet:** rotate the GitHub secret immediately. New key
   generation + new wallet funding + new testnet cycles. Cost:
   ~30 minutes.
2. **Production (escalation):** **THIS IS A REAL-MONEY INCIDENT.**
   1. **Immediately** set `CARDIA_FUNDING_LIVE=false` on the
      production Container App:
      `az containerapp update --name <prod> --resource-group <rg> --set-env-vars CARDIA_FUNDING_LIVE=false`
   2. Disable the leaked key in Azure Key Vault (set enabled=false)
   3. Generate a fresh key, store in Key Vault, redeploy the host
   4. Re-enable `CARDIA_FUNDING_LIVE=true`
   5. Steward Council: emergency review, public statement, key
      fingerprint posted in `docs/COUNCIL_DECISIONS.md`
   6. Audit all transfers between the suspected compromise time
      and the disable time — anything not expected is a loss

## 7. Audit log

Every transfer (testnet or production) should be logged. Format
(drops in `docs/AUDIT-LOG/`):

```markdown
# YYYY-MM-DD HH:MM — <mandateId>

- **Environment:** testnet | production
- **Status:** TX_BROADCAST | TX_CONFIRMED | TX_SYNTHESIZED | AUDIT_FAILED | ...
- **Amount:** $15000 USD
- **principalWallet:** 0x<wallet>
- **txHash:** 0x<hash> (omit for dry-run)
- **blockNumber:** 12345 (omit for dry-run)
- **auditTrace:**
  - hepar:audit:...
  - gate-acl:verify:...
  - cardia-activation-core:executeFunding
  - bus:emit:sovereign.cardia.funding.events
- **Workflow run:** https://github.com/<org>/<repo>/actions/runs/<id>
- **Operator:** <name>
- **Notes:** <any deviations, manual interventions>
```

## 8. What this doc does NOT cover

- **Multi-sig key management** — overkill for the current scale. Re-evaluate
  if/when the project grows.
- **Hepar oracle integrity** — the oracle (Python) is its own trust
  boundary; see `docs/ISSUES/python-oracle-port.md`.
- **Compilation of funding Mandate from wallet-bind events** —
  that's engine code, not custody.
- **CI runner hardening** — assumes GitHub Actions is reasonably
  secure. If the threat model changes, this section expands.
