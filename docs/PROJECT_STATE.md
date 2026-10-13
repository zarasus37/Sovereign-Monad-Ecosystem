# PROJECT STATE

## Sovereign Monad Ecosystem — Implementation Status

> **Last Updated: 2026-10-13** (was 2026-10-11 — 2-day re-entry, now testnet-wired)
> **Status: re-entry complete; engine mounted on host; awaiting testnet deploy.** Vectors 1–6 still "complete" per the 2026-07-21 closeout. What changed in the re-entry is **hygiene + testnet wiring**, not features.

---

## What happened in the gap (2026-07-21 → 2026-10-11)

The repo sat idle for 3 months while I (xKryptic) worked on other projects (Compounding Cockpit, etc.). The 2026-10-11 session was a **hygiene / re-entry pass**, not a feature push. Specifically:

| What | Why |
|---|---|
| Workspace moved `C:\Users\crisc\OneDrive - …\The_Sovereign\` → **`C:\dev\sovereign`** | OneDrive's cloud file provider became unreliable + Node's `\\?\` reads + pnpm-store hydration fail under OneDrive (same failure that drove Compass to `C:\dev\compass` on 2026-10-02). Canonical local clone of `https://github.com/zarasus37/Sovereign-Monad-Ecosystem.git` is at HEAD `0651669`. |
| **Toolchain upgrade: pnpm 9.6.0 → 12.11.2** | The pinned 9.6.0 was 3 majors behind. New install/build now uses 12.11.2 across the workspace + CI. |
| **13 fake-sovereignty stubs archived** to `monad-ecosystem/legacy/stub-2026-10-11/` | The 2026-10-11 stub walk (`docs/P0_STUB_WALK_2026-10-11.md`) audited all 30 packages in `monad-ecosystem/packages/`. 5 were 200-300 byte template scaffolds (`organ-runtime`, `gnosis-security-engine`, `lightverify-core`, `population-expansion-core`, `population-growth-core`). 8 were empty placeholders (no `src/`; the README was aspirational, the code never existed). 13 moved to `legacy/`. The empty `monad-mev-archive/` directory was confirmed empty (not "56+ archived MEV bots" as prior reviews said). |
| **`@sovereign/monad-mev` → `@sovereign/loop`** | The package implements the **Sovereign Execution Loop** (Capital Mandate, Capacity Ceiling, Shadow Markout, Router B 50/40/10), not a MEV engine. "MEV" was a historical label. Decision doc: `docs/P0_MONADMEV_DECISION_2026-10-11.md`. The 12-byte shim at `packages/monad-mev/` re-exports `loop/` for one release; drop the shim after that. The actual cross-chain MEV engine lives at `C:\Users\crisc\Dev\agents\monad-mev\` (separate repo, separate machine) and consumes this library. |
| **MOF slimmed: 3,089 → 2,006 lines** | Three high-traffic sections extracted: `docs/mof-axioms.md` (Foundational Axioms), `docs/mof-system-model.md` (High-Level System Model), `docs/mof-layers.md` (Layer Detail, 12 layers). The MOF remains the canonical authoritative file; the extracted docs are navigable copies. |
| **Garden → constraint pack PoC** | `scripts/garden-to-constraint-pack.mjs` reads a `*GNOSIS EVENT EXTRACTION.txt` and emits a constraint pack under `shared/constraints/v0.1.0-gardens/`. PoC = Aristotle (9 events, all in `theological.json`, severity=soft). 7/7 tests pass. Charter pack (v1.1.0) still loads alongside. The implicit doctrine "a garden is the source of a constraint pack" moves from aspirational to compilable. |
| **Phase 2 Shadow Market library coverage** | 16 vitest tests in `monad-ecosystem/tests/integration/shadow-market.test.ts`. Tests the deck, halt assessment, and aggregate directly — no Vite, no Playwright, no DOM. The "halt literacy flaky" Playwright symptom is now clearly a UI/timing problem, not a logic problem. |
| **3 pre-existing build bugs fixed** | `sovereign-types` was missing `@types/node` (build was failing on `merkle-commit.ts:7` — `Cannot find module 'node:crypto'`). Three integration test files (`schedule-schema-drift`, `zkp-phase0-schemas`, `scheduler`) couldn't resolve `ajv` because it was only in `sovereign-types` devDeps, not hoisted to root. `sovereign-host`'s `declare module 'express-serve-static-core'` augmentation broke under TS 5.6 with the new `@types/express` resolution. |
| **`pnpm validate` now green end-to-end** | **256/256 integration tests pass in 17 files (6.95s).** Was failing at multiple pre-existing points before this pass. Layout + numerics + sign-types + ttcl-artifacts + temple-grid + council + schedule-schema + build + typecheck + test:integration all pass. |

---

## What did NOT change in the gap (honest)

- **Corpus still 250 pairs** (Stage 2 floor). No new pairs added. The 250-pair guide floor remains the ceiling, not a stepping stone.
- **`CARDIA_FUNDING_LIVE=false`** — safe default unchanged. No testnet cycles run. No custody review.
- **Python oracle** at `loop/python/shadow_markout_api.py` is **still a TODO stub**. The TS gate (`assessHalt`, `aggregatePhase2`) is real; the oracle behind it is the heuristic in the stub. Real `shadow_markout_hardened.py` lives in the external MEV engine at `C:\Users\crisc\Dev\agents\monad-mev\` and has not been ported.
- **No new vectors shipped.** Vectors 1–6 are still the 2026-07-21 closeout. The P0 hygiene pass didn't advance the roadmap; it closed the fake-sovereignty surface and made the workspace actually buildable.
- **Meshaleach Phase 2 automation** — the library is now covered by tests, but the end-to-end Playwright walk is unchanged. The UI walk still depends on a Vite dev server + Playwright + the 2.5s deck tick alignment. Flaky in the original sense; less risky now that the underlying logic is verified.
- **Stage 2 8B GPU training** — still capital-gated. The 250-pair corpus is locked; the GPU run to scale to a real Shaliah hasn't happened.

---

## 2026-10-13 session delta (added on top of the 2026-10-11 re-entry)

Two days after the re-entry, a follow-up session continued the same path. The Cardinal finding of the day: the **Cardia funding engine is real and substantial** — it was buried in `monad-ecosystem/packages/organs/cardia/cardia-activation-core/` and never wired into the host. The follow-up wired it.

| What | Why |
|---|---|
| **`organs/` investigation resolved** | Initial audit said "investigate" but the shallow scan missed the deeper structure. Full investigation: `cardia-activation-core` is a substantial 50+ KB implementation of the Cardia funding engine (Vector 3.3) — Hepar-gated, Redis-locked, PL-tracked. Promoted to LIVE_PACKAGES as `alpha → graduate by 2027-01-06`. Two duplicate stubs (`organs/execution-truth-core`, `organs/organ-runtime`) archived. Decision: `docs/P0_ORGANS_RESOLUTION_2026-10-13.md`. |
| **`cardia-activation-core` engine wired into `@sovereign/host`** | New route: `POST /api/v1/cardia/funding/trigger`. Auth: bearer required, principalId from auth context (clients cannot pick a different principal). Gated by `CARDIA_FUNDING_LIVE=true`; returns 503 SERVICE_DISABLED when off (default — engine mounted but inactive). Maps engine statuses (`TX_SYNTHESIZED`/`TX_BROADCAST`/`TX_CONFIRMED`/`AUDIT_PASSED`) to HTTP. Pre-existing tsconfig bug fixed: `cardia-activation-core` was missing `declaration: true` so downstream consumers were getting `any`. |
| **Meshaleach UI walk wired + CI job** | `scripts/run-meshaleach-walk.mjs` orchestrator starts Vite + runs the Playwright walk + tears it down. `pnpm walk:meshaleach` script. `.github/workflows/meshaleach-walk.yml` runs weekly + on push to consumer-surface paths. **Fixed a script bug along the way:** the walk's regex was `text=/SYSTEM_REFUSED|.../i` but the rendered DOM is `<span class='text-yellow-500'>⚠ REFUSED</span>` — the regex matched nothing, so Phase 2 always got 0 halts. Replaced with `page.locator("span.text-yellow-500")`. Walk now completes end-to-end: halts 3, RESTORE COMMUNICATION MODULE, PL 50, bind enabled. |
| **Testnet cycle script** | `scripts/testnet-cycle.mjs` + `pnpm testnet:cycle`. Runs the walk, hits the funding trigger, prints pass/fail verdict with audit trace + testnet-explorer link. Exits 0 on pass, 1 on fail, 2 on setup error. SKIP_WALK=1, EXPECTED_TX=1, etc. for variants. The 4-step testnet runbook collapses to one command. |
| **Monorepo-root `Dockerfile` + testnet deploy workflow** | Replaces the broken package-scoped Dockerfile (`pnpm@9.6.0`, hardcoded, won't build the workspace). New Dockerfile uses `pnpm@12.11.2` (matches `packageManager` field), multi-stage Alpine, non-root `nodeapp` user, `PORT=3001`/`EXPOSE 3001`. `.github/workflows/testnet-deploy.yml` builds the image, pushes to `testnet-registry.azurecr.io/cardia/sovereign-host`, updates the `cardia-testnet-host` Container App, and runs `pnpm testnet:cycle` as the verification step. The old `monad-ecosystem/packages/sovereign-host/Dockerfile` is removed. |
| **3 issue tracking tickets** | `docs/ISSUES/testnet-port-mapping.md` (ACA `targetPort` must be 3001, not 8080), `docs/ISSUES/python-oracle-port.md` (port the real oracle from the external engine repo), `docs/ISSUES/testnet-custody-review.md` (document the testnet → production custody procedure before any `CARDIA_FUNDING_LIVE=true` flip). |
| **Layout allowlist update** | `scripts/verify-layout.mjs` ALLOWED_TOP_LEVEL now includes `Dockerfile` so the new monorepo-root Dockerfile doesn't fail the layout guard. |

### What changed in "What did NOT change" since 2026-10-11

- **Meshaleach Phase 2 automation** — the walk was flaky in 2026-10-11 because of a script-bug regex match, not a library/logic problem. The 16 vitest tests prove the library; the script is now fixed; the CI walk is wired. Phases 1, 2, 3, 4 all complete in the run, PL 50, bind enabled.
- **`@sovereign/cardia-activation-core` is now mounted on the host** (was buried in `organs/`). The trigger route exists. The default `CARDIA_FUNDING_LIVE` is still `false` — the engine is reachable but inactive until the operator flips the flag.

---

## Current state (resumable from here, 2026-10-13)

### Vectors (unchanged from 2026-07-21)

| Vector | Description | Status |
|---|---|---|
| 1.x | Shaliah Onboarding Arc | ✓ COMPLETE |
| 2.x | Gate-ACL + Wallet Bind | ✓ COMPLETE |
| 3.x | Cardia Funding Engine | ✓ COMPLETE |
| 4.x | Control Center UI + SSE | ✓ COMPLETE |
| 5.x | MEV Engine + Shadow Gate | ✓ COMPLETE (the **library**; the engine is in a separate repo) |
| 6.x | Infrastructure + First Breath | ✓ COMPLETE |

### Live packages (post-stub-walk)

| Package | Status | Notes |
|---|---|---|
| `@sovereign/ttcl` `@sovereign/gate-acl` `@sovereign/types` `@sovereign/bus` `@sovereign/host` `@sovereign/hepar-service` `@sovereign/logoc` `@sovereign/hcd-monitor` `@sovereign/shaliah-onboarding` | **prod** | spine |
| `@sovereign/loop` (was `monad-mev`) | **alpha → graduate by 2027-01-06** | real sovereign execution primitives; Python oracle is the open risk |
| `monad-mev` shim | **deprecated** | re-exports `@sovereign/loop`; drop after one release |
| `@sovereign/x402-bridge` | **alpha** | remediated 2026-07-13 |
| `@sovereign/gnosis-core` `@sovereign/scheduler` `@sovereign/compiler` `@sovereign/gnosis-training-data` | **alpha** | real code, separate review needed |
| `hepar-defi-auditor` `gnosis-evaluator-core` `emergent-protocol-core` `execution-truth-core` | **alpha → graduate by 2027-01-06** | real code, tests pending |
| `cardia-funding-stream` `shaliah-telemetry-bus` `hepar-core` `risk-engine` | **alpha → graduate by 2027-04-06** | |
| `prometheus` `grafana-provisioning` | **ops** | golden topology |
| 13 archived stubs | **legacy** | `monad-ecosystem/legacy/stub-2026-10-11/` |

### Infrastructure (unchanged)

- **Frontend**: Vite + React (Control Center)
- **Backend**: Express + Node.js (Docker)
- **Forensics**: TS Microservice (Docker — `hepar-service`)
- **Analytics**: FastAPI + Python (Docker) — **note: the python `shadow_markout_api.py` is a stub**
- **Cache**: Redis (Docker)
- **Event Bus**: Kafka (optional profile)
- **Key Custody**: Azure Key Vault (managed identity)
- **Observability**: Prometheus + Grafana (optional profile)

### Go-Live (Azure Container Apps — last confirmed 2026-07-21, not re-checked 2026-10-11)

| Resource | Status |
|---|---|
| `sovereign-host` | **Running** (last confirmed 2026-07-21) — `https://sovereign-host.wittycoast-d4ae00a3.eastus2.azurecontainerapps.io` · `/health` ALIVE |
| `hepar-service` | **Running** |
| `sovereign-redis` | **Running** |
| `sovereign-grafana` | **Running** |
| `monad-mev` (Azure deployment) | **Running** (now superseded by `@sovereign/loop`; the running service should be re-deployed from the new package) |
| Key Vault | `sovereign-kv-20260721` · managed identity |
| Kafka | **Off** in current host env |
| Live capital | **`CARDIA_FUNDING_LIVE=false`** |

> **Honest note:** the Azure status above is from the 2026-07-21 closeout. After 3 months the live state of these services is **unknown**. The `monad-mev` service is now superseded by `@sovereign/loop` and should be re-deployed; before that, the Azure running image is a tombstone of a thesis that was renamed.

---

## Resume guide (when picking up cold)

1. **Read first**: `docs/CANON.md` → `docs/CHARTER.md` → this file.
2. **Run**: `pnpm install` → `pnpm check:layout` → `pnpm validate` (full chain). Should be green in <2 minutes.
3. **Per-package work**: `pnpm --filter @sovereign/<name> test`. The vitest alias is wired, so per-package tests work without a global build.
4. **The MOF** (`docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md`) is the canonical operating file. The 3 high-traffic sections were extracted to `docs/mof-{axioms,system-model,layers}.md` for navigability. The MOF body is now 2,006 lines.
5. **Council gardens** live in `theo-techno-cosmo/THE COUNCILE/`. To compile one into a soft-severity constraint pack: `node scripts/garden-to-constraint-pack.mjs --garden <path> --out shared/constraints/v0.1.0-gardens-<name> --key <name>`.

---

## Open threads (next moves, in priority order)

| When | What | Why |
|---|---|---|
| **This week** | Re-deploy the `monad-mev` Azure service from the new `@sovereign/loop` package, or delete the deployment. | Half-keeping the renamed package while the old one runs is the worst option. |
| **This week** | ~~Run the Playwright walk end-to-end~~ — closed 2026-10-13 (commit `a43e017`); CI weekly + push-triggered, library tests prove the logic. | Walk infra: `.github/workflows/meshaleach-walk.yml`. Script: `pnpm walk:meshaleach`. |
| **This week** | Verify Azure Container App `cardia-testnet-host` has `targetPort=3001` (not 8080). Spec: `docs/ISSUES/testnet-port-mapping.md`. | Dockerfile exposes 3001; ACA must match. |
| **This week** | Port `shadow_markout_hardened.py` from `C:\Users\crisc\Dev\agents\monad-mev\` into `loop/python/shadow_markout_api.py`. Spec: `docs/ISSUES/python-oracle-port.md`. | The TS gate is real; the oracle behind it is the open production risk. |
| **This week** | Document testnet custody procedure (testnet key + production crossover). Spec: `docs/ISSUES/testnet-custody-review.md`. | Required before any `CARDIA_FUNDING_LIVE=true` flip on production. |
| **This month** | Run the first real testnet cycle via `pnpm testnet:cycle` against the deployed testnet host. | The script exists; the wiring is complete. The 3 open issues above are operator-side preconditions. |
| **This month** | Walk the 8 alpha packages (`hepar-defi-auditor`, `gnosis-evaluator-core`, `emergent-protocol-core`, `execution-truth-core`, `cardia-funding-stream`, `shaliah-telemetry-bus`, `hepar-core`, `risk-engine`) and graduate the ones that have tests. | The 2027-01-06 and 2027-04-06 deadlines are on the books; we're 9 months out from 2027-07-06 (Charter §3.1). |
| **Q1 2027** | Stage 2 8B GPU training run. | The pipeline is built and waiting. 250 pairs → ~2700 corpus plan is documented. Capital-gated. |
| **2027-07-06** | Charter §3.1 deadline. Walk the legacy inventory, make the per-component decision. | |

---

## Honest gate (revised 2026-10-13)

**`CARDIA_FUNDING_LIVE=true` moves real capital. Default false until:**
1. **Verify the Azure deployment** — the new `testnet-deploy.yml` workflow builds + pushes the image; the live state of `cardia-testnet-host` after deploy is unverified. The first `pnpm testnet:cycle` after the workflow's first run is the proof. See `docs/ISSUES/testnet-port-mapping.md` for the inbound-port check.
2. **Port the python oracle** at `loop/python/shadow_markout_api.py` from the external engine repo. The TS gate is real; the oracle is the open production risk. See `docs/ISSUES/python-oracle-port.md`.
3. **Run 3 testnet cycles** in this order:
   - **Cycle 1 (dry-run):** `CARDIA_FUNDING_LIVE=true` with no real chain. Verify the audit pass rate is honest, not 100%.
   - **Cycle 2 (small live):** real transfer of 1 USDC to the test wallet. Verify the ERC-20 lands on chain.
   - **Cycle 3 (full TIER_1):** real transfer of 15000 USDC. Verify the amount, audit trace, and txHash all match the engine's response.
4. **Custody review** — see `docs/ISSUES/testnet-custody-review.md`. The procedure must be written and the Steward Council must sign off in `docs/COUNCIL_DECISIONS.md` (or similar).
5. **Production crossover** — the production key is a fresh key, never the testnet key, stored in Azure Key Vault (managed identity), not env var.

Do not flip the flag under any other conditions.

---

## What NOT to do (the anti-list)

- Do not add new stub packages. The 13 that were archived are the floor; new placeholders are fake sovereignty by definition.
- Do not rename `@sovereign/loop` back to `monad-mev`. The "MEV" label was the wrong call.
- Do not remove the shim before the next release ships. Backward compatibility is cheap; surprise breakage is not.
- Do not promise that the trained Shaliah is here. The 250 pairs are a floor. A trained model on those pairs has not been run.
- Do not write "highlights" or "what's next" in a way that papers over the 3-month gap. The gap is real. The session that closed it is real too.

---

*"The organism has a body and a breath procedure. Capital still waits on deliberate custody. Three months of silence are now followed by a hygiene pass, not a feature push. The next feature push is owed before the next checkpoint."*
