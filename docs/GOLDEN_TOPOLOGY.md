# Golden topology (P1)

**One deploy story** for the live spine. Do not invent a second topology under `archive/` or parallel root stacks.

## What “up” means

| Service | Port (host network) | Role |
|---------|---------------------|------|
| `sovereign-host` | 3001 | API, Cardia SSE, metrics, key custody |
| `hepar-engine` | 3003 | Forensic audit Stages A–D |
| `python-engine` | 8000 | Shadow markout / Python side of loop |
| `redis` | 6379 | Nonce / cache |
| `kafka` (profile) | 9092 | Optional bus |
| Prometheus/Grafana (profile) | observability | Metrics UI |

Source of truth compose: **`monad-ecosystem/docker-compose.yml`**  
Root pointer: **`docker-compose.yml`** (include only — no second service graph).

## Commands

```powershell
# Secrets (never commit)
cd monad-ecosystem
copy .env.production.example .env.production
# edit .env.production
cd ..

# Core stack
docker compose --env-file monad-ecosystem/.env.production up -d --build

# Health
curl -s http://localhost:3001/health
curl -s http://localhost:3003/health
```

Dev-without-Docker (local spine):

```powershell
pnpm install
.\scripts\bootstrap.ps1
pnpm --filter @sovereign/host start
# + hepar / engines as needed — see root README 15-minute path
```

## Rules

1. **Live trading path** goes through `gate-acl` + capacity ceilings + HEPAR — not ad-hoc MEV bots under `legacy/`.  
2. **Capital flags default off** (`CARDIA_FUNDING_LIVE=false`, `YIELD_ROUTER_LIVE=false`).  
3. **Archive/legacy** never define the golden path.  
4. Multi-cloud targets under `gnosis-core` deploy are **optional targets**, not the default mental model.

## Related

- [LIVE_PACKAGES.md](LIVE_PACKAGES.md) — what is prod vs stub  
- [GO_LIVE_EXECUTION.md](GO_LIVE_EXECUTION.md) — breath sequence  
- [CANON.md](CANON.md)  
