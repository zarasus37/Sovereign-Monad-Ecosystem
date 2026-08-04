# Live packages — STATUS map (P1)

Statuses are **honest engineering maturity**, not marketing.

| Status | Meaning |
|--------|---------|
| **prod** | Real `src/`, tests or active production path, CI-relevant |
| **alpha** | Real code, incomplete tests or single-surface |
| **stub** | Thin `index.ts` / scaffold — roadmap only; do not depend for critical path |
| **ops** | Config/provisioning assets, not app logic |
| **legacy** | Frozen under `monad-ecosystem/legacy/` or archive — do not extend |

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
| `monad-mev` | `@sovereign/monad-mev` | **alpha** | Shadow markout / loop support — prefer gate-acl for product paths |
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
| `hepar-defi-auditor` | alpha | Related to HEPAR domain |
| `hepar-core` | **stub→legacy prefer hepar-service** | Prefer `@sovereign/hepar-service` |
| `cardia-funding-stream` | alpha | Cardia path; live capital gated |
| `data-rail-core` | alpha | Data rail |
| `data-rail-router` / `data-rail-governance` | stub | Scaffold |
| `risk-engine` | alpha | Thin |
| `organ-runtime` | stub | Scaffold |
| `organs` | ops/alpha | Fixture/test surface |
| `shaliah-telemetry-bus` | alpha | Telemetry |
| `execution-truth-core` | stub | Scaffold |
| `gnosis-evaluator-core` | stub | Scaffold |
| `gnosis-security-engine` | stub | Scaffold |
| `lightverify-core` | stub | Scaffold |
| `population-*-core` | stub | Scaffold |
| `emergence-*-core` | stub | Scaffold |
| `reward-ledger-core` | stub | Scaffold |
| `public-activation-core` (if present) | stub | Often excluded from root build |
| `prometheus` / `grafana-provisioning` | **ops** | Golden topology profiles |

## Legacy (do not extend)

| Path | Status |
|------|--------|
| `monad-ecosystem/legacy/**` | **legacy** |
| `archive/**` | **legacy** (frozen; see P0 hygiene) |

## Contributor rule

- New critical-path code → **prod/alpha spine packages only**.  
- Need a stub? Promote status in this file when it grows real `src/` + tests.  
- CI should not treat stubs as failures for “empty package” — but **do not** list stubs as production features in external narrative.

## Related

- [GOLDEN_TOPOLOGY.md](GOLDEN_TOPOLOGY.md)  
- [P0_MONOREPO_HYGIENE.md](P0_MONOREPO_HYGIENE.md)  
- [CANON.md](CANON.md)  
