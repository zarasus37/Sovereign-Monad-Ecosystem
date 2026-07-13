# The Sovereign

**Sovereign Monad Ecosystem** — Layered Monorepo (v2.5.2)

> An economic system in which AI agents exist as genuine participants — not tools, not features, not labor — operating authentically within compressed constraint envelopes, decompressing into live, contextual, self-consistent action, and being compensated for that authentic operation.

> This repository is the canonical working copy for one unified ecosystem. Any mirrored copies are downstream sync targets only.

---

## 90-Second Start

```powershell
# One-time setup
pnpm install
.\scripts\bootstrap.ps1

# Development
pnpm dev

# Structural hygiene
pnpm check:layout

# Open the resume checkpoint
pnpm status
```

See `scripts/bootstrap.ps1` for full environment setup (uv + pnpm).

---

## How to Read This Repository

This is a large, intentionally multi-domain ecosystem. You do not need to read everything at once.

1. **Start here** — this `README.md` for orientation and how to run it.
2. **Master Operating File** — `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md`  
   The authoritative backbone: philosophy, intention, system functions, architecture, layers, roadmap, and active blockers.
3. **Guardrail Charter** — `docs/CHARTER.md`  
   Non-negotiable constraints on architecture, code, governance, narratives, and human–AI collaboration. All contributors and AI collaborators are bound by it.
4. **Shared AI Collaboration Charter** — `docs/SHARED_AI_COLLABORATION_CHARTER.md`  
   Operational companion binding AI co-architects and code-authoring assistants to the guardrails.
5. **Layout map** — `docs/REPO_STRUCTURE_MAP.md`  
   What is active, archived, or generated, and how the physical directories relate to the domains.
5. **Build discipline** — `docs/ECOSYSTEM_BUILD_MAP.md`, `docs/BUILD_EXECUTION_FLOW.md`, `docs/CANONICAL_SYNC_DISCIPLINE.md`  
   Only when you are changing build order, architecture, or sync behavior.

**Fastest resume path:**

```powershell
pnpm status
```

Archive material lives under `archive/` and is historical unless explicitly promoted.

---

## Ecosystem Domains

The ecosystem has distinct operational domains, each with its own role, but all functioning as one system:

| Domain | Location | Role in the Ecosystem | Tech Stack |
|---|---|---|---|
| **Theo-Techno-Cosmo** | `theo-techno-cosmo/` | Symbolic, philosophical, and decision-schematic substrate | Markdown, PDF, research code |
| **Gnostic Engine** | `gnostic-engine/` | Volumetric runtime that evaluates signals against the substrate | Python (uv) |
| **Monad Ecosystem** | `monad-ecosystem/` | On-chain and TypeScript infrastructure that executes outcomes | TypeScript, Motoko, Solidity |

For a clearer breakdown of active domains versus legacy and generated surfaces, see [docs/REPO_STRUCTURE_MAP.md](docs/REPO_STRUCTURE_MAP.md).

---

## Cross-Domain Contract Layer

All TypeScript packages share one type contract and one set of JSON schemas so the three domains do not drift apart.

| Surface | Location | Purpose |
|---|---|---|
| **Canonical types** | `monad-ecosystem/packages/sovereign-types/` | `SignalEvent`, `GnosisScore`, `DoveSignal`, `HeparAuditResult`, and all cross-layer data shapes exported as `@sovereign/types` |
| **Typed event backbone** | `monad-ecosystem/packages/sovereign-bus/` | Internal event bus consuming `@sovereign/types` with a Kafka-compatible bridge |
| **JSON schemas** | `shared/schemas/` | Portable contract definitions: `signal-event.json`, `dove-signal.json`, `gnosis-score.json`, `hepar-audit-result.json` |

If you add a new cross-layer data shape, put the TypeScript contract in `@sovereign/types` and the portable JSON schema in `shared/schemas/`.

---

## Working Standard

For contributor rules and cleanup expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Unified Directory Structure

```text
The_Sovereign/
|-- .editorconfig
|-- .gitattributes
|-- .gitignore
|-- .github/
|-- CONTRIBUTING.md
|-- pnpm-workspace.yaml
|-- package.json
|-- README.md
|-- archive/
|   |-- generated/
|   |-- infrastructure/          # legacy Azure Function + default Vite dashboard
|   |-- legacy-workspaces/
|   |-- notes/                    # historical SGE deep-dive text files
|   `-- sandboxes/
|-- docs/
|   |-- PROJECT_STATE.md
|   |-- PROJECT_STATE.json
|   |-- REPO_STRUCTURE_MAP.md
|   `-- SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md
|-- shared/
|   `-- schemas/                  # cross-domain JSON schemas (signal, dove, gnosis, hepar)
|-- theo-techno-cosmo/
|   |-- Wheel/
|   |-- THE COUNCILE/
|   `-- plex/
|-- gnostic-engine/
|   |-- src/
|   |-- api/
|   |-- dashboard/
|   `-- ...
|-- monad-ecosystem/
|   |-- packages/
|   |   |-- sovereign-types/      # canonical cross-domain type contract
|   |   |-- sovereign-bus/        # typed event backbone
|   |   `-- ...
|   |-- control-center/
|   |-- contracts/
|   |-- scripts/
|   `-- tests/
`-- scripts/
    |-- bootstrap.ps1
    `-- sync-canonical.ps1
```

---

## Licensing Authority

Licensing is centralized at the root:

- `docs/LICENSE.md`
- `docs/LICENSING.md`
- `docs/LICENSE.commercial.md`

---

## Philosophical Foundation - Theo-Techno-Cosmo

The Sovereign Monad is built on a unified philosophical framework integrating theology, technology, and cosmology:

Start here: [theo-techno-cosmo/README.md](theo-techno-cosmo/README.md)

This directory contains:

- **The Wheel** — Operative diagrams and contemplative maps (Llull's Ars Magna adapted)
- **The Council** — Historical lineages showing these patterns recur across independent traditions
- **The PLEX** — How philosophical principles become operational reality, measured and audited in real-time

New to the Sovereign Monad? Begin with the [Theo-Techno-Cosmo quick start guide](theo-techno-cosmo/README.md#quick-start-new-to-the-sovereign-monad).

---

## Philosophy of This Structure

- **One ecosystem, many domains** — Each domain has its own role and can operate independently so the whole ecosystem functions properly.
- **Thin root** — Only coordination, tooling, shared schemas, and the canonical type contract live at the top level.
- **No more dumping grounds** — The old `monad-mev/` sprawl, stale Azure infrastructure, duplicate `packages/logoc/`, and Windows `desktop.ini` noise have been archived or removed; live x402 code is now in `monad-ecosystem/packages/x402-bridge/`.
- **Single-root VS Code** — One workspace, proper IntelliSense, unified Git history.

---

## Next Phases (Roadmap)

### Structural cleanup — complete
- Phase 1 Complete — Root foundation established (2026-06-01).✅
- Phase 2: Rehome & prune `monad-ecosystem/agents/monad-mev/` ✅ (legacy archived; live x402 code moved to `monad-ecosystem/packages/x402-bridge/`)
- Phase 3: Convert `gnostic-engine/` to a proper Python package and remove "Succor" references ✅
- Phase 4: Polish `theo-techno-cosmo/` onboarding + wire P4 narrative-purpose detection into LOGOC ✅
- Phase 5: Cross-layer integration & shared types ✅
- Phase 6: Update MOF header + sync discipline ✅

### Recently completed (2026-07)
- **Guardrail Charter v1.0** (effective 2026-07-06) — sovereignty-as-architectural-property criteria + legacy remediation discipline (PR #26) 
- **TTCL / compiler axis** — Layers 1–4 + Layer 8 (parity/CI) landed; Layer 5 MLIR compiler stack (`@sovereign/compiler`, L3 Semiotic + L2 Sign-Graph) merged (PR #25)
- **Layer 5, L1 Provenance** (`@sovereign/compiler`) — the fourth and final MLIR lowering level: linear `Token` threading, `KeyCap` capability check, `encodeSign`/`decodeSign` Trithemius-cipher lowering. The full L3→L2→L1→L0 stack is now realized (PR #35)
- **Layer 5, L2 rewrite/fusion + `attachModality`** (`@sovereign/compiler`) — the named Layer 5 follow-ups. New `rewrite.ts` pass collapses map passthrough chains (`map∘map≡map`, identity-elimination) via an id-stable `ResolveMap` the graph stays immutable and provenance refs survive; `fold`/`choose` now infer the lattice JOIN of all branches (PURE = join identity); the new `attachModality` op overrides a carrier's modality (e.g. promote a declared-INDEX sign to SYMBOL for the L1 `encodeSign` path) without mutating the immutable `SignDecl`. Facade reordered to the spec's four passes (infer → rewrite → constitution → budget) (PR #37)
- **x402 live smoke test — GREEN** (2026-07-10) — `eth_blockNumber` on `monad-mainnet` via the official `@quicknode/x402` SDK (PR #30). The package remains `LEGACY_NON_SOVEREIGN`; sovereignty remediation is still open.
- **Steward Council corpus** — Christine de Pizan + Sor Juana Inés de la Cruz added (PR #31)

### Active frontier
- **Code — Layers 6/7 (the unbuilt core):** the named Layer 5 follow-ups (L2 rewrite/fusion + `attachModality`) landed in PR #37; the compiler stack's spec-defined work is complete. Layer 6 (simulated-annealing wheel Scheduler → `canonical_schedule.json`) and Layer 7 (Training Pipeline: SFT→Reward→PPO→Eval) are the unbuilt core after that.
- **Sovereignty remediation (open):** `x402-bridge` stays `LEGACY_NON_SOVEREIGN` until the Charter §3 criteria are met — cost-accounting ledger, failure/retry envelope, sovereign-agent consumer. See `docs/LEGACY_COMPONENTS.md` §6 (deadline 2027-07-06).
- **Capital-gated live frontiers (Layer 9):** funded Cardia activation, live Keys, public Data Rail — standing live work that awaits external capital/keys, not code.

See the Master Operating File in `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md` for the full axioms, architecture, and execution instructions, and `docs/PROJECT_STATE.md` for the live 9-layer status table.

---

This structure enables the Sovereign vision: compression -> authentic decompression across philosophy, engine, and economics.
