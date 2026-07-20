# Final Sequence: The Breath — Go-Live Execution

Deploy `sovereign-net` and run the first Meshaleach capital path **only when capital and custody are deliberately ready**.

**Honesty first:** Completing this checklist boots the organism. Setting `CARDIA_FUNDING_LIVE=true` with a funded Bootstrap wallet moves **real** stablecoins. Default all live flags to `false` until Key Vault + pulse check pass.

---

## 0. Preconditions

| Check | Notes |
|-------|--------|
| Repo on branch with Vectors 4–6.3 | Host, Cardia, Hepar client, Redis nonces, loop, metrics |
| Azure Key Vault (or equivalent) | Secret name: **`BootstrapPrivateKey`** |
| VM Managed Identity or SP | Role: **Key Vault Secrets User** (get secret) |
| Funded Bootstrap Source wallet | Only after testnet dry cycles |
| Frontend deploy | `FRONTEND_URL` must match CORS origin |
| Operator has `az` CLI | For vault injection |

---

## 1. Cloud provisioning (physical terrain)

SSH into production Linux (e.g. Azure Ubuntu 22.04, AWS `t3.medium`+).

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git curl
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"   # re-login after
```

Clone:

```bash
git clone https://github.com/zarasus37/Sovereign-Monad-Ecosystem.git
cd Sovereign-Monad-Ecosystem
```

Compose file lives under **`monad-ecosystem/`**:

```bash
cd monad-ecosystem
```

---

## 2. Key Vault injection (securing the breath)

**From a secure operator machine (not the app logs):**

```bash
az keyvault secret set \
  --vault-name "your-sovereign-vault" \
  --name "BootstrapPrivateKey" \
  --value "0xYOUR_PRIVATE_KEY"
```

On the compute resource:

1. Enable **system-assigned managed identity** (VM / Container Apps).
2. Grant that identity **Key Vault Secrets User** on the vault.
3. Set `KEY_VAULT_NAME=your-sovereign-vault` in `.env.production`.
4. Leave `BOOTSTRAP_PRIVATE_KEY` **unset** in production.

Code path: `packages/sovereign-host/src/lib/keyCustody.ts` → `getBootstrapWallet()`.

---

## 3. Production environment

```bash
cp .env.production.example .env.production
nano .env.production
```

Minimum live flips (after dry-run on testnet):

| Variable | Staging / first boot | Live capital |
|----------|----------------------|--------------|
| `CARDIA_FUNDING_LIVE` | `false` | `true` |
| `YIELD_ROUTER_LIVE` | `false` | `true` |
| `KAFKA_ENABLED` | `true` (with profile) | `true` |
| `KAFKA_BROKERS` | `kafka:9092` | same or managed |
| `REDIS_URL` | `redis://redis:6379` | same or managed |
| `KEY_VAULT_NAME` | set | set |
| `MONAD_RPC_URL` | testnet | mainnet only when ready |
| Treasuries + `STABLECOIN_CONTRACT` | real 0x addresses | real |

Never commit `.env.production`.

---

## 4. Final boot

```bash
cd monad-ecosystem

# Full nervous system (host + python + redis + kafka)
docker compose --env-file .env.production --profile with-kafka up -d --build

# Optional organism dashboards
docker compose --env-file .env.production --profile observability up -d

docker compose logs -f sovereign-host
```

Expected log lines:

```text
[Sovereign Host] Listening on port 3001
[Sovereign Host] Kafka Enabled: true
[Observability] Kafka consumer live …
```

If Key Vault is configured and live funding will run:

```text
[Key Custody] Fetching bootstrap key from Azure Key Vault...
[Key Custody] Bootstrap wallet address: 0x…
```

---

## 5. Pulse check

```bash
curl -s http://localhost:3001/health | jq .
curl -s http://localhost:3001/metrics | head
```

**Healthy pulse (example):**

```json
{
  "status": "ALIVE",
  "service": "@sovereign/host",
  "kafka": true,
  "redis": true,
  "live_funding": true,
  "metrics": true,
  "key_custody": {
    "configured": true,
    "keyVaultName": "your-sovereign-vault",
    "authType": "managed-identity"
  }
}
```

| Field | Meaning |
|-------|---------|
| `kafka: true` | `KAFKA_ENABLED=true` (broker connectivity is separate — check logs) |
| `redis: true` | `REDIS_URL` is set (ping is best-effort in logs on boot) |
| `live_funding: true` | Cardia will attempt real transfers when path completes |
| `key_custody.configured` | Vault name + MI or SP present |

---

## 6. First live Meshaleach (operator ritual)

1. Open `FRONTEND_URL` (Control Center).
2. Complete **Broken Genesis** → **Shadow Market** → **Archon Gate**.
3. Reach live activation; **BIND WALLET** (EIP-191).
4. Confirm host logs: promote-pl / bind-wallet / PL ledger / Cardia / Hepar / nonce / tx.

Ideal log spine:

```text
[Wallet Bind] …
[Cardia Consumer] Wallet Bind detected…
[Hepar Client] … PASS …
[NonceManager] Allocated nonce: N
[Cardia Engine] Signing… TX_BROADCAST… TX_CONFIRMED…
```

If Hepar is unavailable: **fail-closed** — no signature (Axiom 6).

---

## 7. Observation

| Surface | URL |
|---------|-----|
| Pulse | `GET /health` |
| Metrics | `GET /metrics` → Prometheus :9090 |
| Grafana | :3000 — dashboard `Sovereign Monad — Organism Observability` |
| Host logs | `docker compose logs -f sovereign-host` |

---

## Rollback / kill switches

```bash
# Soft: stop live capital without tearing the stack
# In .env.production set CARDIA_FUNDING_LIVE=false YIELD_ROUTER_LIVE=false
# then: docker compose --env-file .env.production up -d sovereign-host

# Hard: stop the organism
docker compose --profile with-kafka --profile observability down
```

Rotate Bootstrap key in Key Vault; restart host so cache invalidates (or redeploy).

---

## Known honest gaps (do not over-claim)

1. **Dockerfile monorepo build** must resolve workspace packages (`@sovereign/gate-acl`, `types`, …). If `--build` fails, run host via Node on the VM (`pnpm --filter @sovereign/host start`) with the same env until images are repaired.
2. **PL ledger / registry** are still process-local unless you attach durable stores — multi-replica requires Redis/Cosmos-backed mandates.
3. **Cardia organ consumer** may need a dedicated process if not co-mounted in host; verify wallet-bind → funding path in your deploy topology before mainnet capital.
4. **Testnet first.** Mainnet RPC + `CARDIA_FUNDING_LIVE=true` is irreversible capital risk.

---

## Related

- `monad-ecosystem/.env.production.example`
- `monad-ecosystem/docker-compose.yml`
- `packages/sovereign-host/src/lib/keyCustody.ts`
- Vector 6.3 metrics: `GET /metrics`
