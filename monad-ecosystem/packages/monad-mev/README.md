# @sovereign/monad-mev

**Vector 5.2 — Capacity Ceiling Enforcer** for Meshaleach Tier-1 capital after Cardia funding.

## CapacityCeilingMonitor

Tracks remaining allocation (default **$15,000** USDC base units), rolling realized slippage, and gates proposed trades:

| Rolling avg slippage | Decision |
|----------------------|----------|
| `< warning` (1%) | Full size (capped by remaining) |
| `warning … densityFloor` | **Throttled** size (linear factor → 0 at floor) |
| `≥ C-DENSITY-FLOOR` (2%) | **Halt** new trades |
| Remaining `< $500` | **CAPACITY_EXHAUSTED** (bus + Kafka topic) |

```ts
import { CapacityCeilingMonitor } from '@sovereign/monad-mev';

const ceiling = new CapacityCeilingMonitor({
  principalWallet: '0x…',
  initialAllocationUsd: 15_000,
});

const decision = ceiling.checkCeiling(2_500);
if (!decision.allowed) throw new Error(decision.reason);
const size = decision.throttledSize ?? 2_500;

// after fill:
ceiling.recordTradeOutcome({
  tradeId: '…',
  notionalUsd: size,
  realizedSlippage: 0.008,
  pnlUsd: 12.5,
});
```

## Events

Topic: `sovereign.capacity.ceiling.events` (`CAPACITY_CEILING_TOPIC`)

Kafka emit only when `KAFKA_ENABLED=true` (same honesty pattern as Cardia / gate-acl).  
`CAPACITY_EXHAUSTED` / density halt also emit on `@sovereign/bus` when loadable.

## Scripts

```powershell
pnpm --filter @sovereign/monad-mev test
pnpm --filter @sovereign/monad-mev typecheck
```
