# @sovereign/bus

**Sovereign Monad internal typed event bus.**

The nervous system of the ecosystem. Every layer emits and consumes events
through this bus. Local mode: in-process, append-logged. Production mode:
drops transparently to Kafka via the bridge.

---

## Quick Start

```typescript
import { sovereignBus } from '@sovereign/bus';
import type { HeparAuditResult } from '@sovereign/types';

// Emit a typed event
sovereignBus.emit('hepar.audit.completed', 'intelligence', auditResult);

// Subscribe to events
const unsubscribe = sovereignBus.on<HeparAuditResult>(
  'hepar.audit.completed',
  (event) => {
    console.log(event.payload.score.overall);
  }
);

// Unsubscribe when done
unsubscribe();
```

---

## Architecture

```
[Package] → bus.emit(type, layer, payload)
                ↓
         [EventBus.dispatch()]
          /            \
   [Listeners]    [JSONL Log]
                  logs/signal-stream.jsonl

                    ↓ (if KAFKA_ENABLED=true)
              [KafkaBridge]
                    ↓
           [Kafka cluster / topics]
```

---

## Canonical Kafka Topic Map (MOF §Layer 2)

| SignalEventType | Kafka Topic |
|---|---|
| `price.updated` | `monad.price` |
| `spread.detected` | `signals.spread` |
| `oracle.regime.classified` | `risk.evaluation` |
| `trade.approved` | `portfolio.approved` |
| `system.health` | `system.health` |
| `hepar.audit.completed` | `hepar.audit.completed` |
| `gnosis.score.computed` | `gnosis.score` |
| `dove.signal.tier*` | `dove.signals` |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `KAFKA_ENABLED` | No | Set to `true` to enable Kafka forwarding |
| `KAFKA_BROKERS` | If Kafka enabled | Comma-separated broker addresses |
| `KAFKA_CLIENT_ID` | No | Client ID for this producer (default: `sovereign-bus`) |

---

## Log Format

Events are appended to `logs/signal-stream.jsonl` as newline-delimited JSON:

```jsonc
{"id":"uuid","correlationId":"uuid","timestamp":"2026-06-19T...","layer":"intelligence","source":"hepar-defi-auditor","type":"hepar.audit.completed","payload":{...},"hash":"sha256hex"}
```

---

## Build

```powershell
pnpm build     # Compiles TypeScript to dist/
pnpm test      # Runs vitest test suite
```
