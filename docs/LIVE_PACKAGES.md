# Live packages — STATUS map (P1)

Statuses are **honest engineering maturity**, not marketing.

| Status | Meaning |
|--------|---------|
| **prod** | Real `src/`, tests or active production path, CI-relevant |
| **alpha** | Real code, incomplete tests or single-surface |
| **stub** | Thin `index.ts` / scaffold — roadmap only; do not depend for critical path |
| **ops** | Config/provisioning assets, not app logic |
| **legacy** | Frozen under `monad-ecosystem/legacy/` or archive — do not extend |

> **2026-10-11 stub walk:** see [`P0_STUB_WALK_2026-10-11.md`](P0_STUB_WALK_2026-10-11.md) for the per-package audit that produced the table below. 13 packages + `public-activation-core` archived to `monad-ecosystem/legacy/stub-2026-10-11/`.

## Spine (import these)

| Package | npm name | Status | Notes |
|---------|----------|--------|-------|
| `ttcl` | `@sovereign/ttcl` | **prod** | Runtime, temple grid, constitution, tests |
| `gate-acl` | `@sovereign/gate-acl` | **prod** | Closed loop, paper, PL, wallet bind |
| `sovereign-types` | `@sovereign/types` | **prod** | Shared contracts (tests thin — schema-backed) |
| `sovereign-bus` | `@sovereign/bus` | **prod** | Typed event backbone |
| `sovereign-host` | `@sovereign/host` | **prod** | Express host / golden topology API |
| `hepar-service` | `@sovereign/hepar-service` | **prod** | Stages A–D microservice |
| `logoc` | `@sovereign/logoc` | **prod** | Classifier / manifold (TS + engine bridge) |
| `hcd-monitor` | `@sovereign/hcd-monitor` | **prod** | Human capability drift instrumentation |
| `shaliah-onboarding` | `@sovereign/shaliah-onboarding` | **prod** | Vector 1 door / FG path |
| `x402-bridge` | `x402-bridge` | **alpha** | Payment rail agent; live flags gated |
| `loop` | `@sovereign/loop` | **alpha → graduate by 2027-01-06** | Sovereign Execution Loop: Capital Mandate, Capacity Ceiling, Shadow Markout, Router B yield (50/40/10). Was `@sovereign/monad-mev`; renamed 2026-10-11 because the package implements bounded-agency execution, not a MEV engine. The MEV engine lives at `C:\Users\crisc\Dev\agents\monad-mev\` (separate repo) and consumes this library. See [`MONOREPO-VS-EXTERNAL-MEV-ENGINE.md`](MONOREPO-VS-EXTERNAL-MEV-ENGINE.md) and [`P0_MONADMEV_DECISION_2026-10-11.md`](P0_MONADMEV_DECISION_2026-10-11.md). **Risk:** `loop/python/shadow_markout_api.py` is a TODO stub — TS gate is real, oracle is mock. |
| `monad-mev` | `@sovereign/monad-mev` | **deprecated shim** | Re-exports `@sovereign/loop`. To be removed after one release. |
| `gnosis-core` | `@sovereign/gnosis-core` | **alpha** | Multi-target deploy surface; config sprawl risk |
| `scheduler` | `@sovereign/scheduler` | **alpha** | Layer 6 schedule — schema drift tracked historically |
| `compiler` | `@sovereign/compiler` | **alpha** | Tooling |
| `gnosis-training-data` | `@sovereign/gnosis-training-data` | **alpha** | Feedstock helpers (Python training is primary) |

## Python (not under packages/)

| Path | Status | Notes |
|------|--------|-------|
| `gnostic-engine/` | **prod** | LOGOC pipeline, constraints, tests |
| `gnosis-training/` | **prod** | Preference / reward / SFT; corpus on main |

## Organs & rails (mixed)

| Package | Status | Notes |
|---------|--------|-------|
| `hepar-defi-auditor` | **alpha → graduate by 2027-01-06** | Real Stage A–D wrap with TTC hard gate; tests pending |
| `hepar-core` | **stub → fold into `hepar-defi-auditor` by 2027-04-06** | Thin façade; nothing imports it (per 2026-10-11 audit) |
| `cardia-funding-stream` | **alpha → graduate by 2027-04-06** | SSE funding panel; live capital gated |
| `data-rail-core` | alpha | Data rail |
| `risk-engine` | **alpha → remediate-or-archive by 2027-07-06** (per `LEGACY_COMPONENTS.md §5`) | Monte Carlo; refactor to consume `@sovereign/types` signals |
| `organs` | **ops/alpha → investigate** | 17 src files, no `tsconfig.json` / `README.md` / `dist/`; inconsistent state (per 2026-10-11 audit) |
| `shaliah-telemetry-bus` | **alpha → graduate by 2027-04-06** | Shaliah telemetry routing |
| `execution-truth-core` | **alpha → graduate by 2027-01-06** | One-shot CLI validator for runtime execution-truth closure; real logic, no tests |
| `gnosis-evaluator-core` | **alpha → graduate by 2027-01-06** | Agent coherence / quarantine evaluator; real bus emissions, no tests |
| `emergent-protocol-core` | **alpha → graduate by 2027-01-06** | Pattern discovery / emergence.claim.submitted bus emissions |
| `prometheus` / `grafana-provisioning` | **ops** | Golden topology profiles |

> **Note:** the previous "Stub" sub-section (data-rail-router/governance, organ-runtime, gnosis-security-engine, lightverify-core, population-*-core, emergence-*-core, reward-ledger-core) was archived on 2026-10-11 to `monad-ecosystem/legacy/stub-2026-10-11/`. See [Legacy](#legacy-do-not-extend).

## Legacy (do not extend)

| Path | Status |
|------|--------|
| `monad-ecosystem/legacy/monad-mev-archive/**` | **legacy** (frozen; 56+ archived MEV bots) |
| `monad-ecosystem/legacy/stub-2026-10-11/**` | **legacy** (archived 2026-10-11; 13 fake-sovereignty stubs per `P0_STUB_WALK_2026-10-11.md`) |
| `archive/**` | **legacy** (frozen; see P0 hygiene) |

### Archived 2026-10-11 — fake-sovereignty stubs

Per the 2026-10-11 audit, the following packages were either pure template
scaffolds (200-300 byte boilerplate) or empty placeholders (no `src/`, only
README + `package.json` + config placeholders). None are imported by any
spine package. They were moved into `monad-ecosystem/legacy/stub-2026-10-11/`
and removed from the pnpm workspace.

| Package | Category | Why archived |
|---|---|---|
| `data-rail-router` | empty placeholder | README describes routing; no `src/`; `config/routes.json` is empty |
| `data-rail-governance` | empty placeholder | README describes gate logic; no `src/`; gate logic lives in `data-rail-core` |
| `emergence-accumulator-core` | empty placeholder | Aspirational README; no `src/` |
| `emergence-baseline-core` | empty placeholder | Aspirational README; no `src/` |
| `emergence-claim-core` | empty placeholder | 3.4 KB README describes live agent loop on `EmergenceRecorder.sol` with `live:agent` npm scripts — but no `src/`, no `dist/`; README is stale (describes code that has been removed during P0 hygiene) |
| `emergence-history-core` | empty placeholder | Aspirational README; no `src/` |
| `emergence-observer-core` | empty placeholder | Aspirational README; no `src/` |
| `reward-ledger-core` | empty placeholder | Reward accounting lives in `x402-bridge` (per `LEGACY_COMPONENTS.md §6`) |
| `organ-runtime` | template scaffold | 199 B: `console.log('[OrganRuntime] initialized.')` |
| `gnosis-security-engine` | template scaffold | 233 B: `console.log('[GnosisSecurityEngine] initialized.')` |
| `lightverify-core` | template scaffold | 211 B: `console.log('[LightverifyCore] initialized.')` |
| `population-expansion-core` | template scaffold | 245 B: `console.log('[PopulationExpansionCore] initialized.')` |
| `population-growth-core` | template scaffold | 233 B: `console.log('[PopulationGrowthCore] initialized.')` |

**Also archived (was already missing from disk):** `public-activation-core`
— was excluded from `pnpm build` via `pnpm --filter=!public-activation-core
--recursive build`. Per `LEGACY_COMPONENTS.md §4` had a deadline of
2027-01-06 to either rebuild or archive; no rebuild owner emerged, so
formally archived 2026-10-11.

## Contributor rule

- New critical-path code → **prod/alpha spine packages only**.  
- Need a stub? Promote status in this file when it grows real `src/` + tests.  
- CI should not treat stubs as failures for "empty package" — but **do not** list stubs as production features in external narrative.

## Related

- [GOLDEN_TOPOLOGY.md](GOLDEN_TOPOLOGY.md)  
- [P0_MONOREPO_HYGIENE.md](P0_MONOREPO_HYGIENE.md)  
- [P0_STUB_WALK_2026-10-11.md](P0_STUB_WALK_2026-10-11.md)  
- [P0_MONADMEV_DECISION_2026-10-11.md](P0_MONADMEV_DECISION_2026-10-11.md)  
- [MONOREPO-VS-EXTERNAL-MEV-ENGINE.md](MONOREPO-VS-EXTERNAL-MEV-ENGINE.md)  
- [CANON.md](CANON.md)  
