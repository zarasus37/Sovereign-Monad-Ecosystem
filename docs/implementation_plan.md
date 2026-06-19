# The Sovereign — Unified System Integration Plan
## Goal: One Fluent, Institutional-Grade System

This plan turns the current structurally organized but partially disconnected monorepo
into a single organism where every layer **talks to every other layer** and every line
of code meets institutional-grade standards.

---

## Current Reality Assessment

### What Is Working
| Component | Status |
|---|---|
| Root monorepo scaffold (pnpm, scripts, layout guard) | ✅ Solid |
| `gnostic-engine` Python package (volumetric 4D, Pulfrich, API) | ✅ Built |
| `monad-ecosystem/packages/*` — 22 TypeScript packages exist | ✅ Scaffolded |
| `control-center` frontend (Vite + React, Tailwind) | ✅ Builds |
| `control-center` backend (ICP Motoko canister) | ✅ Built |
| Phase 1a contracts (DoveCore, RevenueSinkTreasury, etc.) | ✅ Deployed on Monad mainnet |
| Hepar DeFi auditor — Stages A–D | ✅ Live at Advisory Tier |
| Agent 0 profile, behavioral claim on-chain | ✅ Mined |

### Critical Integration Gaps (The Real Work)
| Gap | Impact |
|---|---|
| **No shared type contract** — packages use ad-hoc types with no cross-package schema | Every layer invents its own signal shape |
| **No runtime event bus** — packages don't publish/subscribe to each other | Kafka map exists in docs; nothing is wired locally |
| **Gnostic Engine ↔ Control Center disconnected** — Python API exists, frontend has no live feed | Dashboard shows no live gnosis data |
| **22 packages have no integration tests** — only isolated unit tests per package | No proof the system works end-to-end |
| **monad-mev agent crash-looping** — QuickNode daily limit blocker | MEV engine cannot prove mainnet execution |
| **`hepar-core` is docs-only** — only a README and stages dir, no actual src | Core audit organ has no code |
| **`data-rail-core` has no activation record** — readiness met, externalization not triggered | Revenue rail is dormant |
| **`control-center` is excluded from root pnpm workspace** — builds are manual | Not part of the unified build |
| **No `.env` discipline** — config scattered across individual packages | No unified secrets/config layer |
| **`theo-techno-cosmo` is documentation only** — no programmatic integration | Philosophy layer has no machine-readable interface |
| **Multiple `.stale-node_modules-*` dirs at root** — garbage left from migrations | Build noise, potential conflicts |
| **Stale `.venv`, `.venv.broken`, `.venv2`** in gnostic-engine | Environment uncertainty |

---

## Open Questions

> [!IMPORTANT]
> **Q1 — Integration Priority:** There are two distinct integration tracks:
> - **Track A**: Make the local analysis stack a genuinely connected system (shared types, event bus, live dashboard)
> - **Track B**: Close the mainnet execution gap (resolve monad-mev crash loop, funded Cardia activation)
>
> Which track do you want executed first, or both in parallel?

> [!IMPORTANT]
> **Q2 — Control Center Role:** The control-center uses ICP (Motoko canister as backend). Should the control center remain ICP-native, or should the backend be migrated/supplemented with a Node.js/Python bridge so it can consume live data from the gnostic-engine and hepar organs directly?

> [!IMPORTANT]
> **Q3 — Shared Types Strategy:** Should shared types live in:
> - A new `monad-ecosystem/packages/sovereign-types` TypeScript package (cleanest, one source of truth)
> - A root-level `shared/` directory (already referenced in README structure map but not created)
> - Both (types package for TS, shared/ for cross-language JSON schemas)

> [!WARNING]
> **Q4 — Cleanup Scope:** There are 5 stale `.stale-node_modules-*` directories at root and broken `.venv` directories in gnostic-engine. Safe to delete these fully?

---

## Proposed Changes — Phased Execution

This is divided into **5 execution phases**, each independently verifiable.

---

### Phase A — Foundation Cleanup & Shared Types

**Goal:** Remove noise, establish the type contract every layer will speak.

---

#### [DELETE] `.stale-node_modules-20260612*` (×5 at root)
Stale artifact directories from the June 12 migration. Safe to remove.

#### [DELETE] `gnostic-engine/.venv.broken`, `gnostic-engine/.venv2`
Broken/redundant Python virtual environments.

#### [NEW] `monad-ecosystem/packages/sovereign-types/`
New TypeScript package: **the single type contract for the entire ecosystem**.

Exports:
- `SignalEvent` — canonical event envelope (layer, agent, timestamp, payload, hash)
- `AgentProfile` — personality vector, role, risk envelope
- `GnosisScore` — Stokes-Mueller coherence output (depth, truth, width, tilt)
- `DoveSignal` — tier (1/2/3), layer, observable, drift flag
- `HeparAuditResult` — stage A–D output with severity, contract address, findings
- `OracleRegime` — regime classification, posture, confidence interval
- `RevenueEvent` — routing event with destination, amount, token, tx hash
- `EmergencePattern` — pattern claim, confidence, evidence window

#### [NEW] `shared/schemas/`
JSON Schema versions of all `sovereign-types` for cross-language use
(Python gnostic-engine can validate against these; Motoko canister can reference).

---

### Phase B — Internal Event Bus (Local Wiring)

**Goal:** Packages publish and consume events. The system has a nervous system.

---

#### [NEW] `monad-ecosystem/packages/sovereign-bus/`
Lightweight in-process event bus for local development / analysis mode.
- `EventBus` class with typed `emit()` / `on()` / `off()`
- Uses `sovereign-types.SignalEvent` as the envelope
- Persists events to `logs/signal-stream.jsonl` (append-only, rotatable)
- Drop-in compatible with Kafka topic map from MOF Section 6.2 (same topic names)

#### [MODIFY] Each of the 5 Advisory Tier organs (`hepar-defi-auditor`, `gnosis-evaluator-core`, `risk-engine`, `data-rail-core`, `emergent-protocol-core`)
- Import `sovereign-bus` and `sovereign-types`
- Emit typed `SignalEvent` on every meaningful state transition
- Subscribe to relevant upstream signals (e.g. risk-engine subscribes to `signals.spread`)

#### [NEW] `monad-ecosystem/packages/sovereign-bus/src/kafka-bridge.ts`
When `KAFKA_ENABLED=true`, forwards all bus events to real Kafka topics.
Keeps local dev clean while preserving the real Kafka path.

---

### Phase C — Gnostic Engine ↔ Control Center Live Feed

**Goal:** The dashboard shows real data from the Python engine.

---

#### [MODIFY] `gnostic-engine/src/gnostic_engine/api/routes.py`
- Add `/api/v1/gnosis/stream` — Server-Sent Events endpoint streaming `GnosisScore` JSON
- Add `/api/v1/dove/signals` — returns latest N `DoveSignal` events
- Add `/api/v1/hepar/latest` — proxies latest `HeparAuditResult` from the organ bus
- Add `/api/v1/health` — liveness probe with version, uptime, engine state
- Validate all outputs against `shared/schemas/` JSON schemas

#### [MODIFY] `monad-ecosystem/control-center/src/frontend/`
- Add `src/services/gnostic-api.ts` — typed client for all gnostic-engine endpoints
- Add `src/services/hepar-api.ts` — typed client consuming hepar audit results
- Connect `GnosisScore` stream → live dashboard panel (replaces any mock/static data)
- Connect `DoveSignal` feed → Dove monitor panel
- Add `src/hooks/useSignalStream.ts` — React hook for SSE consumption with reconnect logic

#### [MODIFY] `monad-ecosystem/control-center/pnpm-workspace.yaml` + root `pnpm-workspace.yaml`
- Normalize control-center into root workspace so `pnpm build` covers it

---

### Phase D — Hepar-Core & Package Code Completion

**Goal:** No package directory is docs-only. All 22 packages have real source.

---

#### [MODIFY] `monad-ecosystem/packages/hepar-core/`
- Currently only has `README.md` and `stages/` — no `src/`, no `package.json` proper
- Add `src/index.ts` exporting the Stage A–D audit orchestrator
- Wire to `hepar-defi-auditor` (which has the actual stage implementations)
- Emit `HeparAuditResult` events to `sovereign-bus`

#### [MODIFY] `monad-ecosystem/packages/data-rail-core/`
- Add `src/activator.ts` — activation gate that checks readiness thresholds
  and writes an activation record to `logs/data-rail-activation.json`
- Add `src/bundler.ts` — bundles behavioral signal windows into exportable products
- Emit `DataRailActivated` event on first successful activation

#### Audit remaining packages for empty/stub `src/`
Packages to verify all have non-trivial implementation:
`gnosis-security-engine`, `organ-runtime`, `population-expansion-core`,
`population-growth-core`, `execution-truth-core`, `lightverify-core`

---

### Phase E — Integration Tests & Build Validation

**Goal:** `pnpm test` at root proves the system works end-to-end, not just per-package.

---

#### [NEW] `monad-ecosystem/tests/integration/`
End-to-end integration test suite:
- `bus-flow.test.ts` — emit signal in risk-engine, verify it arrives in gnosis-evaluator
- `hepar-to-bus.test.ts` — run a Stage A audit, verify `HeparAuditResult` on bus
- `gnosis-api.test.ts` — call gnostic-engine `/api/v1/gnosis/stream`, parse `GnosisScore`
- `dove-signal-propagation.test.ts` — trigger drift condition, verify `DoveSignal` Tier 1
- `data-rail-activation.test.ts` — simulate sufficient signal windows, verify activation

#### [MODIFY] Root `package.json`
- Add `"test:integration": "vitest run monad-ecosystem/tests/integration/"`
- Add `"typecheck": "pnpm --recursive tsc --noEmit"` — catches cross-package type drift
- Add `"validate": "pnpm check:layout && pnpm typecheck && pnpm lint && pnpm test:integration"`

#### [MODIFY] `docs/PROJECT_STATE.md`
- Update after each phase completion
- Add integration test results table

---

## Code Quality Standards (Institutional Grade)

Every file produced or modified must meet:

| Standard | Requirement |
|---|---|
| **TypeScript** | `strict: true`, no `any`, explicit return types on all public functions |
| **Python** | Type annotations on all functions, `ruff` clean, no bare `except` |
| **Tests** | Every public function has at least one test. Integration tests for all cross-package flows |
| **Errors** | Typed error classes, never raw `throw new Error("string")` at boundary surfaces |
| **Logging** | Structured JSON logs with `level`, `timestamp`, `source`, `correlationId` |
| **Config** | All secrets from env vars, validated at startup with clear error if missing |
| **Docs** | Every package has a `README.md` with: purpose, API surface, events emitted/consumed |
| **No dead code** | No commented-out blocks, no `TODO` stubs in production paths |

---

## Verification Plan

### Automated
```powershell
pnpm validate   # layout + typecheck + lint + integration tests
```

### Manual
1. Start gnostic-engine API: `cd gnostic-engine && uv run python -m gnostic_engine`
2. Start control-center frontend: `cd monad-ecosystem/control-center/src/frontend && pnpm dev`
3. Verify dashboard shows live GnosisScore stream
4. Trigger a Hepar audit, verify result appears in control center
5. Verify `signal-stream.jsonl` captures all events in order
6. Run `pnpm check:layout` — must still pass

---

## Execution Order

```
Phase A (Cleanup + Types)     → 1 session
Phase B (Event Bus)           → 1-2 sessions
Phase C (Live Dashboard Feed) → 1-2 sessions
Phase D (Package Completion)  → 2-3 sessions
Phase E (Integration Tests)   → 1 session
```

Total: ~6-9 focused sessions to reach **one fluent, institutional-grade system**.
