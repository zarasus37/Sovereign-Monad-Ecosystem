# @sovereign/monad-mev

**Vectors 5.1–5.3** — Shadow Markout, Capacity Ceiling, Sovereign Execution Loop.

## Execution loop (Axiom 7)

```
Cardia fund → Shaliah wallet
     → EIP-712 CapitalMandate (bounded agency)
     → CapacityCeiling (C-DENSITY-FLOOR)
     → Shadow Markout gate
     → Trade
     → routeYield 50/40/10 (Router B)
     → Principal / Shaliah treasury / Ecosystem vault
```

```ts
import {
  signCapitalMandate,
  executeGuardedLiveTrade,
  CapacityCeilingMonitor,
} from '@sovereign/monad-mev';
import { Wallet } from 'ethers';

const shaliah = new Wallet(process.env.SHALIAH_KEY!);
const mandate = await signCapitalMandate(shaliah, {
  engineOperator: process.env.ENGINE_OPERATOR!,
  amountAllocatedUsd: 15_000,
});

const result = await executeGuardedLiveTrade(
  {
    poolAddress: '0x…',
    amountUsd: 1_000,
    isBuy: true,
    assetPair: 'ETH/USDC',
    tokenAddress: process.env.STABLECOIN_CONTRACT,
    status: 'PENDING',
    auditTrace: [],
  },
  mandate,
  { privateKey: process.env.ENGINE_KEY },
  { ceiling: new CapacityCeilingMonitor({ initialAllocationUsd: 15_000 }) },
);
```

## Env

```powershell
# Treasuries (Router B)
$env:PRINCIPAL_TREASURY = "0x…"
$env:SHALIAH_TREASURY = "0x…"
$env:ECOSYSTEM_VAULT = "0x…"
$env:YIELD_ROUTER_LIVE = "true"   # else dry-run synthetic hashes

$env:MONAD_CHAIN_ID = "101010"
$env:KAFKA_ENABLED = "false"
```

## Modules

| Path | Role |
|------|------|
| `loop/mandateSigner.ts` | EIP-712 CapitalMandate (Shaliah) |
| `loop/mandateVerifier.ts` | Expiry / allocation / signature |
| `loop/yieldRouter.ts` | 50/40/10 BigInt split |
| `capacityCeiling.ts` | Rolling slippage envelope |
| `shadowMarkoutGate.ts` | Fail-closed shadow API |
| `executionEngine.ts` | Full guarded loop |

## Scripts

```powershell
pnpm --filter @sovereign/monad-mev test
pnpm --filter @sovereign/monad-mev typecheck
```
