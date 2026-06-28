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
| `gnosis.plurality.snapshot` | `gnosis.plurality` |
| `dove.signal.tier*` | `dove.signals` |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `KAFKA_ENABLED` | No | Set to `true` to enable Kafka forwarding |
| `KAFKA_BROKERS` | If Kafka enabled | Comma-separated broker addresses |
| `KAFKA_CLIENT_ID` | No | Client ID for this producer (default: `sovereign-bus`) |
| `KAFKA_MAX_RETRIES` | No | Per-send retry attempts (default `3`) |
| `KAFKA_INITIAL_BACKOFF_MS` | No | Initial backoff in ms (default `100`, doubles each attempt) |
| `KAFKA_MAX_BACKOFF_MS` | No | Max backoff in ms (default `5000`) |

## Production Hardening (P9)

The bridge implements a real `kafkajs` producer with:

- **Idempotent producer** with `acks=all` and `maxInFlightRequests=5`
- **Bounded exponential backoff** with configurable ceiling
- **Dead-letter routing** — events that exhaust all retries are forwarded to `<topic>.dlq` with full diagnostic headers (`dlq-reason`, `dlq-source-topic`, `dlq-source-error`, `dlq-ts`)
- **Lazy `kafkajs` import** — the package builds even when `kafkajs` is not installed; the import is only attempted when `KAFKA_ENABLED=true`
- **Graceful shutdown** — `detach()` flushes, disconnects, and clears subscriptions
- **Connection observability** — logs `producer.connect`, `producer.disconnect`, `producer.network.request_timeout`
- **Structured headers** — every message carries `event-type`, `event-layer`, `correlation-id`, and (when present) `event-hash`
- **Testable port** — all Kafka calls go through a `KafkaProducerLike` interface; the test suite injects a mock producer and runs in 162ms with no broker required

### Topic map (read-only, exposed via `KafkaBridge.getTopicMap()`)

| SignalEventType | Kafka Topic | DLQ Topic |
|---|---|---|
| `price.updated` | `monad.price` | `monad.price.dlq` |
| `spread.detected` | `signals.spread` | `signals.spread.dlq` |
| `oracle.regime.classified` | `risk.evaluation` | `risk.evaluation.dlq` |
| `trade.approved` | `portfolio.approved` | `portfolio.approved.dlq` |
| `trade.executed` | `execution.monad` | `execution.monad.dlq` |
| `system.health` | `system.health` | `system.health.dlq` |
| `hepar.audit.completed` | `hepar.audit.completed` | `hepar.audit.completed.dlq` |
| `gnosis.score.computed` | `gnosis.score` | `gnosis.score.dlq` |
| `gnosis.plurality.snapshot` | `gnosis.plurality` | `gnosis.plurality.dlq` |
| `dove.signal.tier1/2/3` | `dove.signals` | `dove.signals.dlq` |
| `data-rail.activated` | `data-rail.lifecycle` | `data-rail.lifecycle.dlq` |
| `emergence.claim.submitted` | `emergence.claims` | `emergence.claims.dlq` |
| `revenue.routed` | `revenue.router` | `revenue.router.dlq` |

### Tests

```bash
pnpm test       # 7/7 pass in ~160ms, no broker required
```

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
