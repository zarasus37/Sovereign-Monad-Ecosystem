# cardia-activation-core

Local readiness surface + **Funding Engine** (UMS Vector 3.3) for funded `Cardia` activation.

## Funding Engine

After wallet bind (`taskId: wallet-bind-tier1-activation`, PL ≥ 50):

1. **Hepar forensic audit** on principal wallet — **fail-closed** (Vector 4.4)
2. **Dry-run** by default (`TX_SYNTHESIZED`) — no private key required
3. **Live** only when secrets set:

```powershell
$env:CARDIA_FUNDING_LIVE = "true"
$env:MONAD_RPC_URL = "https://…"
$env:BOOTSTRAP_PRIVATE_KEY = "0x…"   # Bootstrap Source — never commit
$env:STABLECOIN_CONTRACT = "0x…"     # USDC (6 decimals)
$env:REDIS_URL = "redis://localhost:6379"   # Vector 4.2 atomic nonces
# Hepar gate (Vector 4.4)
$env:HEPAR_AUDIT_MODE = "http"              # or "local" stub (default when URL unset)
$env:HEPAR_API_URL = "http://localhost:3002/api/v1/hepar"
$env:HEPAR_API_KEY = "…"                    # optional Bearer
$env:KAFKA_ENABLED = "true"
$env:KAFKA_BROKERS = "localhost:9092"
# Local deny list (local mode / mock server):
# $env:HEPAR_AUDIT_FAIL_ADDRESSES = "0xbad…"
```

### Hepar gate (Vector 4.4)

| Mode | Behavior |
|------|----------|
| `HEPAR_AUDIT_MODE=local` (default if `HEPAR_API_URL` unset) | Process-local rules; honest staging |
| `HEPAR_AUDIT_MODE=http` or `HEPAR_API_URL` set | POST `/audit-address`; **fail-closed** on timeout/error |
| Verdict ≠ `PASS` | `AUDIT_FAILED` — no signature, capital held |

Mock organ for local HTTP mode:

```powershell
pnpm --filter @sovereign/host mock-hepar   # :3002
```

### Redis nonce (Vector 4.2)

`RedisNonceManager` allocates bootstrap nonces via atomic `INCR`.  
Without `REDIS_URL`, falls back to in-process memory (not multi-instance safe).

On live boot: `bootstrapCardiaOrgan()` → connect Redis → `syncWithChain()` → start PL consumer.

```ts
import { bootstrapCardiaOrgan, nonceManager } from '@sovereign/cardia-activation-core';
await bootstrapCardiaOrgan();
// or: pnpm start:organ
```

Topics:
- consume: `sovereign.pl.ledger.events`
- emit: `sovereign.cardia.funding.events`

```ts
import {
  handlePlLedgerMessage,
  executeFunding,
  mandateFromWalletBind,
} from '@sovereign/cardia-activation-core';

// Consumer path (wallet-bind → funding)
handlePlLedgerMessage(walletBindEvent);

// Direct dry-run
await executeFunding(mandateFromWalletBind({ principalWallet: '0x…' }));
```

### Honesty

| Mode | Behavior |
|------|----------|
| Default dry-run | Hepar local/http pass → `TX_SYNTHESIZED` + local log |
| Live | ERC-20 `transfer` from Bootstrap Source after Hepar `PASS` |
| Hepar fail / unavailable | `AUDIT_FAILED` — no signature (fail-closed) |

This package previously only exposed readiness gates; funding execution is opt-in live.
