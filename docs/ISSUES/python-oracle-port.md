# Issue: Port the Python shadow markout oracle

> **RESOLVED 2026-10-16.** The oracle behind the TS gate is real logic, not
> heuristics. The stub is gone. See § Resolution below for what shipped, what
> changed shape, and the one behavior change an operator must know about.

> **Source:** `docs/PROJECT_STATE.md` § "What did NOT change in the
> gap" — "Python oracle at `loop/python/shadow_markout_api.py` is still
> a TODO stub. The TS gate (`assessHalt`) is real; the oracle behind
> it is the heuristic in the stub. Real `shadow_markout_hardened.py`
> lives in the external MEV engine at `C:\Users\crisc\Dev\agents\monad-mev\`
> and has not been ported."
>
> **Why it matters:** The Hepar audit client in
> `@sovereign/cardia-activation-core` calls out to a Python oracle
> for the funding flow's last-mile risk verdict. Currently the oracle
> returns heuristic verdicts. **The TS gate is production-grade; the
> oracle behind it is the open production risk** for the wired
> funding engine.

## Correction to the original issue text (2026-10-16)

This ticket described the wiring inaccurately in three places. The paths
below are the verified ones; anyone reading the original text should
rely on this section.

| Original ticket said | Actually |
|---|---|
| stub lives at `organs/cardia/cardia-activation-core/python/` | `packages/loop/python/` |
| `heparAuditClient.ts` consumes the oracle | `loop/src/shadowMarkoutGate.ts` consumes it. `heparAuditClient.ts` is the Hepar forensic organ client and never references markout |
| endpoint is `/audit` | endpoint is `POST /api/v1/shadow/evaluate` |

The Hepar organ and the shadow-markout oracle are two separate organs.
Hepar is wired into `cardia-activation-core`; the oracle is wired into
`@sovereign/loop`'s execution engine. Conflating them would have put the
port in the wrong package.

## Problem

`monad-ecosystem/packages/organs/cardia/cardia-activation-core/python/shadow_markout_api.py`
is a TODO stub. It uses simple heuristics (price staleness > 60s,
sells > $10k = adverse selection, trades > $50k = capacity exceeded)
and returns 200 PASS for normal trades. The TS-side Hepar audit
client in `heparAuditClient.ts` calls this oracle and treats the
response as gospel — the funding engine proceeds when the oracle
says PASS.

The real oracle logic lives in the external MEV engine repo at
`C:\Users\crisc\Dev\agents\monad-mev\` (Windows path on the
developer's machine). The repo also has `docs/MONOREPO-VS-EXTERNAL-MEV-ENGINE.md`
documenting the relationship.

## Success criteria

- `loop/python/shadow_markout_api.py` runs the real
  `shadow_markout_hardened.py` logic (or its port equivalent).
- The TS-side `heparAuditClient.auditAddressForFunding()` consumes
  the real oracle and applies its verdict in `executeFunding()`.
- A vitest test in
  `monad-ecosystem/tests/integration/shadow-markout-oracle.test.ts`
  covers the integration: given a known oracle input, the TS gate
  applies the right decision.
- The "TODO" comment in the stub file is removed.
- The "Honest gate" section in `PROJECT_STATE.md` is updated to
  reflect this resolution.

## Action items

- [ ] **Locate `shadow_markout_hardened.py` in the external engine
  repo** (`C:\Users\crisc\Dev\agents\monad-mev\` or wherever it
  currently lives). The function name in the engine repo may be
  slightly different; the *behavior* is what's needed.
- [ ] **Read the existing `shadow_markout_api.py` interface** to
  understand the contract the TS side expects (request/response
  shape, error handling, latency). Likely a small FastAPI/Flask
  wrapper around the real logic.
- [ ] **Port the real logic** into the existing FastAPI skeleton in
  `shadow_markout_api.py`. Maintain the same `/audit` and `/shadow`
  endpoints so the TS client doesn't need to change.
- [ ] **Add an integration test** that exercises the round-trip:
  - `shadow_markout_hardened.py` returning a verdict
  - `shadow_markout_api.py` wrapping it via HTTP
  - `heparAuditClient.ts` consuming the response
  - The funding flow reacting correctly
- [ ] **Update the **Honest gate** section** of `PROJECT_STATE.md` to
  reflect that the oracle is now real. Re-link to the integration
  test.
- [ ] **(Optional, deeper)** Consider whether the oracle should live
  inside the Sovereign monorepo as a Python package
  (`packages/python-shadow-markout/` or similar) instead of being
  copied from the engine repo. This is a structural call — discuss
  with the founder before doing it.

## Related

- `monad-ecosystem/packages/organs/cardia/cardia-activation-core/python/shadow_markout_api.py` — the stub
- `monad-ecosystem/packages/organs/cardia/cardia-activation-core/src/heparAuditClient.ts` — the TS client
- `docs/MONOREPO-VS-EXTERNAL-MEV-ENGINE.md` — engine repo location + boundary
- `docs/P0_MONADMEV_DECISION_2026-10-11.md` — the engine/library distinction
- `C:\Users\crisc\Dev\agents\monad-mev\` (external) — where `shadow_markout_hardened.py` lives

## Resolution (2026-10-16)

### Source of the port

The live file at `C:\Users\crisc\Dev\agents\monad-mev\` is outside this
agent's sandbox. A frozen snapshot exists in-repo at
`archive/legacy-workspaces/monad-mev-legacy-2026-06/scripts/`:

- `shadow_markout_hardened.py` — `sha256:95391b2b05e8d34ed546bb998af264d4f270b2b626868566c22c2b1058d9d6de` (410 lines)
- `monad_price_fetcher.py` — `sha256:dacb94e46ce0b51539a0c2bb0e6fc12cb75d9398408e2bcbacc6ed5e69213f04`

Operator-confirmed as the port source. **The sha is pinned in three
places** — `SOURCE_SHA256` in the ported module, the gate config
fingerprint folded into every audit id, and an assertion in the
integration test — so drift from the live file is detectable rather than
silent. If the live file has changed since 2026-06, re-diff before
trusting production verdicts.

### What shipped

Three files under `packages/loop/python/`:

1. **`shadow_markout_hardened.py`** — the ported post-fill harness, near-verbatim.
2. **`shadow_markout_gate.py`** — new. The synchronous pre-trade verdict logic that
   replaces the heuristics. Zero third-party deps.
3. **`shadow_markout_api.py`** — rewritten. Same endpoints, real logic, TODOs removed.

### Why two modules, not one

The hardened analyzer cannot serve the TS gate. It is a **post-fill**
harness: it awaits T+15s and T+60s realized prices, accumulates trades,
then reports whether alpha retained. `shadowMarkoutGate.ts` calls the
oracle with a **2000ms timeout** and aborts the trade on overrun
(`SHADOW_TIMEOUT_MS`). Wiring the async analyzer behind a synchronous
pre-trade call would fail every trade by timeout.

So the doctrine was carried forward to the only moment a verdict can still
stop a trade:

| hardened doctrine | pre-trade observable that carries it |
|---|---|
| retention ≥ gate_threshold | slippage + uncertainty budget vs declared edge |
| retention < 0.70 ⇒ adverse selection | slippage/uncertainty exceeds the edge |
| capacity_ceiling_usd | notional vs learned (from observations) then static ceiling |
| Pyth-driven realized price | Pyth publishTime + confidence band |

`shadow_markout_gate.py` imports `GATE_THRESHOLD` and
`ADVERSE_SELECTION_RETENTION` from `shadow_markout_hardened.py` so the two
cannot drift apart.

### Check order and defaults

Each default matches the pre-port stub's decision boundary, so the port
does not silently tighten or loosen the gate:

| Check | Default | Replaces |
|---|---|---|
| Pyth age | 60s | stub's 60s staleness |
| notional ceiling | $50,000 | stub's $50,000 hard cap |
| conf band | 100bps | *(new — stub read `conf` and ignored it)* |
| clock skew | 5s | *(new)* |
| slippage | 10bps base + 0.001bps/USD impact | stub's fixed 0.1%/3%/5% |
| retention gate | 0.80 | *(new)* |

All env-overridable (`SHADOW_MAX_PRICE_AGE_S`, `SHADOW_MAX_NOTIONAL_USD`,
`SHADOW_MAX_CONF_BPS`, `SHADOW_GATE_THRESHOLD`, …). `GET /api/v1/shadow/config`
reports the active values and the pinned provenance.

### Real defects fixed along the way

1. **snake_case / camelCase mismatch.** The stub serialized
   `expected_slippage`, `shadow_profit_usd`, `audit_id`; the TS gate reads
   `expectedSlippage`, `shadowProfitUsd`, `auditId`. `verdict` matched by
   coincidence, so PASS/FAIL gating *worked* — while slippage and profit
   arrived `undefined` on every live trade. `executionEngine.ts` then computed
   `Math.max(0, undefined)` → **NaN gross yield**. Now round-trip tested.
2. **Future `publishTime` accepted as fresh.** The stub computed
   `age = now - publishTime` and only checked the upper bound, so a
   future-dated feed read as *very* fresh and passed. Now rejected.
3. **Fabricated profit.** The stub returned a hardcoded `amount * 0.002`
   (+0.2%) "expected profit" on every passing trade. There is no alpha model
   behind that number. See the behavior note below.
4. **Collision-prone audit ids.** `f"shadow-{pool[-6:]}-{int(time.time())}"`
   is not reproducible and collides within a second on the same pool. Now a
   SHA-256 over request + config fingerprint + verdict.
5. **Broken container build.** `loop/python/Dockerfile` and `docker-compose.yml`
   both still referenced `packages/monad-mev/python/`, deleted by the
   `@sovereign/loop` rename. The python-engine image could not build.
   Paths corrected.

### ⚠ Behavior change an operator must know

**`shadowProfitUsd` is now 0 unless the caller declares an edge.**

The oracle has no alpha model and will not manufacture a profit number.
`executionEngine.defaultProfit()` returns `Math.max(0, shadowProfitUsd)`, and
yield routing is gated on `grossYield > 0`. **So Router B (50/40/10) yield
routing now no longer fires on a default-constructed trade.**

This is the correct outcome — the old number was invented — but it is a
functional change, not a refactor. To restore yield routing, the caller must
supply its own edge model:

- Python: send `expected_edge_bps` in the POST body, or
- TS: inject `calculateProfit` into `executeGuardedLiveTrade` deps

**Not yet done:** wiring an edge model on the TS side. Flagged as follow-up.

### Honest limits of the port

- Retention cannot be *measured* before a fill. The pre-trade check is a
  **bound** on expected slippage, not an observation of alpha.
- The post-fill harness still needs `monad_price_fetcher.py`, which remains
  in the external engine repo. Until it is wired, `shadow_markout_hardened`
  runs on its stub fetcher — which is why the port added `gate_pure` /
  `price_source`: a run with no realized price is now *reported as impure*
  instead of silently scaling PnL by synthetic 0.95/0.90 multipliers and
  reporting `gate_passed: true`.
- A wide Pyth confidence band is mapped to `FAIL_STALE_PRICE`. `ShadowVerdict`
  has five members and none means "price unusable"; this is the least-wrong
  existing verdict, not a precise one.

### Verification

`monad-ecosystem/tests/integration/shadow-markout-oracle.test.ts` — 33 tests
across four layers:

1. gate logic (batch, no deps)
2. hardened harness: retention, adverse selection, capacity ceiling,
   `gate_pure` guard
3. **HTTP round-trip** — a real `uvicorn` process driving the real
   `shadowMarkoutGate.ts`, which is the layer that catches the wire-format bug
4. `executeGuardedLiveTrade` landing on the right terminal status per verdict

### Follow-ups

- [ ] Wire an edge model TS-side so Router B yield routing can be restored
- [ ] Port `monad_price_fetcher.py` so the hardened harness is RPC-backed
      (currently the only file still sourced from the external repo)
- [ ] Add `POST /api/v1/shadow/observe` so the post-fill harness is reachable
      over HTTP; today it is a library + CLI only
- [ ] Re-diff against the live `shadow_markout_hardened.py` if the operator
      confirms the external file moved after 2026-06

### Related

- `monad-ecosystem/packages/loop/python/shadow_markout_hardened.py` — ported post-fill harness
- `monad-ecosystem/packages/loop/python/shadow_markout_gate.py` — new sync pre-trade gate
- `monad-ecosystem/packages/loop/python/shadow_markout_api.py` — FastAPI surface
- `monad-ecosystem/packages/loop/src/shadowMarkoutGate.ts` — the real TS consumer
- `monad-ecosystem/packages/loop/src/executionEngine.ts` — applies the verdict
- `monad-ecosystem/tests/integration/shadow-markout-oracle.test.ts` — verification
- `docs/MONOREPO-VS-EXTERNAL-MEV-ENGINE.md` — engine repo boundary
- `docs/P0_MONADMEV_DECISION_2026-10-11.md` — the engine/library distinction

## Priority

**Shipped 2026-10-16.** Blocks `CARDIA_FUNDING_LIVE=true` no longer on the
ground that the oracle is a heuristic. It still blocks on the other four
"Honest gate" preconditions.

## Out of scope

- Refactoring the oracle to live inside the monorepo as its own Python
  package (separate structural decision, unchanged)
- Replacing FastAPI with another framework
- Building a GraphQL or gRPC interface (REST is fine for now)
