# Kafka Topics — PL → ACL Gate

All topics keyed by `principalId` (ensures per-principal ordering, no
cross-principal race on tier changes).

| Topic | Producer | Consumer(s) | Payload |
|---|---|---|---|
| `pl.events` | comprehension-gate svc, override-verifier svc, task-verifier svc, **PL promote bridge** | `pl-ledger` service | `PLEvent` |
| `pl.state.updated` | `pl-ledger` service | `gate-acl` service | `PLState` (post-recompute) |
| `sovereign.pl.ledger.events` | **PL promote bridge** (server only) | Cardia, Hepar, Dove, multi-organ | `PlLedgerKafkaEvent` (onboarding awards + auditTrace) |
| `intent.raised` | agent decision layer | `gate-acl` service | `IntentRaised` |
| `execution.approved` | `gate-acl` service | executor | `ExecutionApproved` |
| `execution.rejected` | `gate-acl` service | quarantine consumer, audit log | `ExecutionRejected` |
| `mandate.reissued` | `gate-acl` service | executor (mandate cache), audit log | `ACLMandate` |

## Flow

```
comprehension-gate / override-verifier / task-verifier
        │  (server-verified only — never client-writable)
        ▼
   pl.events  ──▶ pl-ledger (append-only, computes decayed score)
        │
        ▼
 pl.state.updated ──▶ gate-acl service
                          │ if score crosses tier threshold:
                          ▼
                    mandate.reissued (new signed ACLMandate, short TTL)

agent decision layer
        │
        ▼
   intent.raised ──▶ gate-acl service
                          │ verify: signature, TTL, tier, capital, tools
                          ├─ PASS ▶ execution.approved ──▶ executor
                          └─ FAIL ▶ execution.rejected ──▶ quarantine
```

## Non-negotiables encoded in topic design

- `pl.events` has **no client-facing producer credential**. Only verifying
  services (comprehension-gate, override-verifier, task-verifier) hold the
  producer key. A frontend cannot emit a `GateEvent` directly.
- `execution.approved` is checked against the mandate **at consume time** by
  the executor (re-verify signature + TTL), not trusted from the gate
  service's decision time. Closes the TOCTOU window where PL decays or
  mandate expires between approval and execution.
- `mandate.reissued` always carries a fresh `expiresAt`. There is no
  "permanent tier" — every mandate is a short-lived, re-derived grant.

## In-repo package

Runnable in-memory slice (no Kafka): `@sovereign/gate-acl`

```powershell
cd monad-ecosystem/packages/gate-acl
pnpm install
pnpm demo
pnpm test
pnpm build
```

### Live wiring (Kafka + Redis)

| Module | Role |
|---|---|
| `kafkaBus.ts` | `KafkaBusProducer`, `consumeIntentRaised`, `TOPICS` |
| `redisMandateStore.ts` | `RedisMandateStore` (TTL = mandate.expiresAt) |
| `plLedgerService.ts` | `pl.events` → recompute → `pl.state.updated` |
| `mandateService.ts` | `pl.state.updated` → issue → Redis → `mandate.reissued` |
| `gateIntentService.ts` | `intent.raised` → gate → approved/rejected |
| `shaliahAgentPath.ts` | `ShaliahIntentEmitter` + `PlEventEmitter` |
| `main.ts` | wires consumers |

```powershell
$env:KAFKA_BROKERS = "localhost:9092"
$env:REDIS_URL = "redis://localhost:6379"
$env:GATE_ACL_SIGNING_SECRET = "<strong-secret>"
# After local testing, force hard fail without secret:
$env:GATE_ACL_REQUIRE_SECRET = "1"
pnpm start
```

**Multi-domain:** `mandateService` still issues **per-domain** on each `pl.state.updated`. Use `MandateIssuer.issueUnionFromPLs` when a principal snapshot is available; see TODO in `mandateService.ts`.
