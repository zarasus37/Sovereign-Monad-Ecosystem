# @sovereign/host

**UMS Vector 4.3** — Express host that mounts gate-acl HTTP adapters and the Cardia funding SSE stream so the Control Center frontend can reach live organs.

## Routes

| Method | Path | Adapter |
|--------|------|---------|
| `POST` | `/api/v1/gate-acl/promote-pl` | `promotePlHttp` |
| `POST` | `/api/v1/gate-acl/bind-wallet` | `bindWalletHttp` |
| `GET` | `/api/v1/cardia/funding/stream/:wallet` | Cardia SSE |
| `GET` | `/health` | Pulse (kafka / redis / live_funding flags) |

## Run (local)

```powershell
# From repo root
pnpm --filter @sovereign/host start

# Env (optional)
$env:PORT = "3001"
$env:FRONTEND_URL = "http://localhost:5173"
$env:KAFKA_ENABLED = "false"   # default — honest local synthesis
# $env:REDIS_URL = "redis://localhost:6379"
# $env:CARDIA_FUNDING_LIVE = "true"  # only with Bootstrap secrets
```

Control Center Vite proxies:

- `/api/v1/gate-acl` → `http://localhost:3001`
- `/api/v1/cardia` → `http://localhost:3001`

Frontend can use same-origin `/api/v1/...` (empty `VITE_GATE_ACL_URL`) or set:

```
VITE_GATE_ACL_URL=http://localhost:3001
```

## Azure

Export `createSovereignApp()` (no `listen`) and wrap with your Function App HTTP bridge. See `src/azure-functions.ts`.

**Honesty:** process-local `PLLedger` / `PrincipalWalletRegistry` reset on cold start. Durable store before multi-instance production.

## Mock Hepar (Vector 4.4 local forensics)

```powershell
pnpm --filter @sovereign/host mock-hepar
# POST http://localhost:3002/api/v1/hepar/audit-address
```

Cardia:

```powershell
$env:HEPAR_API_URL = "http://localhost:3002/api/v1/hepar"
$env:HEPAR_AUDIT_MODE = "http"
```

## Next

Live capital ops — production Hepar organ URL + key custody; funding status UI.
