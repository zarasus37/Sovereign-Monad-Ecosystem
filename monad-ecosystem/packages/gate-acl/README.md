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
pnpm demo                       # generic in-memory slice
pnpm closed-loop                # Agent 0 (NEO-300+SD3) × principal:cris-colon (scripted)
pnpm closed-loop:interactive    # YOU answer the three gates (server verifies)
pnpm paper:demo                 # tier-1 LOGOC paper protocol → PL toward tier 2
pnpm paper:session              # journal session + PL/mandate snapshot
pnpm paper:interactive          # open / close / review (real journaling)
pnpm test
pnpm build
```

### Tier-1 paper protocol (toward tier 2)

Fixed **$10k** synthetic capital · **1% risk** on allowed setups · Rules: defined setup, pre-set stop/target, no revenge size.

**Allowed `setup_tag` only:**
- `liq_sweep_ema_reversal`
- `failed_break_trendline_fade`
- `session_liquidity_zone_fade`

**Price-logic fields:** `trend_context`, `liquidity_zone_type`, `liquidity_zone_price`, `liquidity_event`, `mm_behavior_hypothesis`, `structure_notes`  
(e.g. sweep + retest near zone, stop beyond sweep extreme, EMA stack bias).

Each closed process-valid trade emits a **LOGOC_trade_event** (+~3 PL). Daily review (+5 PL).

### Tier-2 live risk envelope (hard gate)

Same EMA/liquidity setups as tier 1, plus non-negotiable capital bounds:

| Bound | Value (on $500 ceiling) |
|--------|-------------------------|
| Capital ceiling | **$500** |
| Per-trade risk | **≤ 0.5%** ($2.50) preferred & enforced |
| Daily loss limit | **3×** per-trade max (**$7.50**) |
| Max live trades / day | **5** |

Gate rejects `live_execute` when daily loss or trade count is hit — same hardness as setup validity.  
**Fail-closed:** missing `perTradeRiskUSD` or `liveDailyStats` on tier-2 `live_execute` is an automatic reject (no capital-only bypass).  
Journal `risk_envelope` + daily_review `live_daily_stats` make adherence auditable (TTCL covenant).

```powershell
pnpm paper:demo
pnpm paper:interactive   # status | open | close | review | seed | live-check | quit
```

### Closed loop with Agent 0 (you)

Agent 0 = **Cristobal Colon** (`xkryptic-agent-0-genesis`) with full **IPIP-NEO-300 + SD3**
encoding from `emergence-claim-core` registration. Bound to **principal:cris-colon**.

1. Impartation prior loads (psychometrics do **not** raise PL by themselves).
2. You (or scripted CI) pass: comprehension → override → domain task (server-verified).
3. Mandate reissues to **tier 1 paper**.
4. Live execute → **rejected**; paper execute → **approved** + executor runs.

Fixture: `fixtures/agent-0-profile.json`

### Kafka + Redis runtime

```powershell
$env:KAFKA_BROKERS = "localhost:9092"
$env:REDIS_URL = "redis://localhost:6379"
$env:GATE_ACL_SIGNING_SECRET = "<strong-secret>"
$env:GATE_ACL_REQUIRE_SECRET = "1"   # hard throw if secret missing
$env:KAFKA_ENABLED = "true"          # PL promote bridge real emit
pnpm start
```

| Env | Purpose |
|---|---|
| `KAFKA_BROKERS` | comma-separated brokers (default `localhost:9092`) |
| `KAFKA_ENABLED` | `true` → `promotePl` broadcasts to Kafka |
| `REDIS_URL` | mandate store; if unset → `InMemoryMandateStore` + warning |
| `GATE_ACL_SIGNING_SECRET` | HMAC key for mandates |
| `GATE_ACL_REQUIRE_SECRET` | `1` or `NODE_ENV=production` → refuse dev fallback |
| `GATE_ACL_EXECUTE_ON_APPROVE` | `1` → run Executor in the gate process after approve |

### PL promote bridge (UMS Vector 3)

Client **claims** task completion; server **verifies** and may broadcast. Never `verifiedBy: client`.

```ts
import { promotePl, promotePlHttp, PLLedger } from '@sovereign/gate-acl';

const ledger = new PLLedger();
const out = await promotePl(
  {
    principalId: 'principal:…',
    taskId: 'archon-comprehension-gate',
    taskPayload: { kind: 'archon', gatesPassed: 2 },
  },
  { ledger, kafkaEnabled: process.env.KAFKA_ENABLED === 'true' },
);
// Topics: pl.events · sovereign.pl.ledger.events · pl.state.updated
// HTTP adapter: promotePlHttp(body, { ledger }) → { status, json }
```

## Secrets

Set `GATE_ACL_SIGNING_SECRET` for anything beyond local demo. Unset falls back to a **dev string** and logs a warning. Use `GATE_ACL_REQUIRE_SECRET=1` once past local testing.

## Thresholds

Tier cutoffs `25 / 55 / 80` in `plLedger.ts` are **placeholders** so the 3-event demo crosses tier 1. Calibrate from real HCD / competence data before live capital.

## Kafka

See [`schemas/topics.md`](./schemas/topics.md).
