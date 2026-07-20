# cardia-activation-core

Local readiness surface + **Funding Engine** (UMS Vector 3.3) for funded `Cardia` activation.

## Funding Engine

After wallet bind (`taskId: wallet-bind-tier1-activation`, PL ≥ 50):

1. **Hepar audit** on principal wallet (hard fail → escrow hold)
2. **Dry-run** by default (`TX_SYNTHESIZED`) — no private key required
3. **Live** only when secrets set:

```powershell
$env:CARDIA_FUNDING_LIVE = "true"
$env:MONAD_RPC_URL = "https://…"
$env:BOOTSTRAP_PRIVATE_KEY = "0x…"   # Bootstrap Source — never commit
$env:STABLECOIN_CONTRACT = "0x…"     # USDC (6 decimals)
$env:KAFKA_ENABLED = "true"
$env:KAFKA_BROKERS = "localhost:9092"
# Optional deny list:
# $env:HEPAR_AUDIT_FAIL_ADDRESSES = "0xbad…"
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
| Default | Hepar mock pass → `TX_SYNTHESIZED` + local log |
| Live | ERC-20 `transfer` from Bootstrap Source after Hepar pass |
| Hepar fail | `AUDIT_FAILED` — no signature |

This package previously only exposed readiness gates; funding execution is opt-in live.
