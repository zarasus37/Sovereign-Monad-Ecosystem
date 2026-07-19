# `@sovereign/gate-acl`

**Shaliah PL → ACL hard gate** — the load-bearing enforcement that *Principal Level caps Agent Capability Limit*.

Same spirit as Hepar `gateTtc`: **gate on the bus / executor path, not in the UI.**

## What it implements

| Piece | Role |
|---|---|
| `PLLedger` | Append-only PL events; score always re-derived with decay; rejects `verifiedBy: 'client'` |
| `MandateIssuer` | HMAC-signed `ACLMandate`, 15m TTL, tier from PL score |
| `GateAclService` | Checks signature, TTL, tier, domain, mode, capital, tools; `compile_constraints` requires tier 3 |
| `Executor` | Re-verifies mandate at **consume** time (TOCTOU close) |
| `InMemoryBus` | Topic names match Kafka design; swap later without changing gate logic |

## Minimal vertical slice

1. Principal starts **tier 0** (`observe`, `defi_execution`).
2. One comprehension gate + one valid override + one domain task → PL crosses tier-1 threshold.
3. Mandate reissued: **tier 1 / paper**.
4. Live trade intent → **rejected** (`tier_insufficient`).
5. Paper trade → **approved** → executor **executed**.

## Run

```powershell
cd monad-ecosystem/packages/gate-acl
pnpm install
pnpm demo          # in-memory vertical slice (no Kafka)
pnpm test
pnpm build
```

### Kafka + Redis runtime

```powershell
$env:KAFKA_BROKERS = "localhost:9092"
$env:REDIS_URL = "redis://localhost:6379"
$env:GATE_ACL_SIGNING_SECRET = "<strong-secret>"
$env:GATE_ACL_REQUIRE_SECRET = "1"   # hard throw if secret missing
pnpm start
```

| Env | Purpose |
|---|---|
| `KAFKA_BROKERS` | comma-separated brokers (default `localhost:9092`) |
| `REDIS_URL` | mandate store; if unset → `InMemoryMandateStore` + warning |
| `GATE_ACL_SIGNING_SECRET` | HMAC key for mandates |
| `GATE_ACL_REQUIRE_SECRET` | `1` or `NODE_ENV=production` → refuse dev fallback |
| `GATE_ACL_EXECUTE_ON_APPROVE` | `1` → run Executor in the gate process after approve |

## Secrets

Set `GATE_ACL_SIGNING_SECRET` for anything beyond local demo. Unset falls back to a **dev string** and logs a warning. Use `GATE_ACL_REQUIRE_SECRET=1` once past local testing.

## Thresholds

Tier cutoffs `25 / 55 / 80` in `plLedger.ts` are **placeholders** so the 3-event demo crosses tier 1. Calibrate from real HCD / competence data before live capital.

## Kafka

See [`schemas/topics.md`](./schemas/topics.md).
