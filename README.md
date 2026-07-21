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
2. **Master Operating File** — `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md`  
   The authoritative backbone: philosophy, intention, system functions, architecture, layers, roadmap, and active blockers.
3. **Guardrail Charter** — `docs/CHARTER.md`  
   Non-negotiable constraints on architecture, code, governance, narratives, and human–AI collaboration. All contributors and AI collaborators are bound by it.
4. **Shared AI Collaboration Charter** — `docs/SHARED_AI_COLLABORATION_CHARTER.md`  
   Operational companion binding AI co-architects and code-authoring assistants to the guardrails.
5. **Theo-Techno-Cosmo (operational)** — `docs/THEO_TECHNO_COSMO.md`  
   Tripartite validity gates (sovereignty/refusal, structure, density). Machine packs: `shared/constraints/`. Runtime: `gnostic_engine.constraints`.
6. **Layout map** — `docs/REPO_STRUCTURE_MAP.md`  
   What is active, archived, or generated, and how the physical directories relate to the domains.
7. **Build discipline** — `docs/ECOSYSTEM_BUILD_MAP.md`, `docs/BUILD_EXECUTION_FLOW.md`, `docs/CANONICAL_SYNC_DISCIPLINE.md`  
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
| **Theo-Techno-Cosmo** | `theo-techno-cosmo/` (+ `docs/THEO_TECHNO_COSMO.md`, `shared/constraints/`) | Symbolic substrate **and** enforceable tripartite validity (T/X/C) | Markdown, PDF; versioned JSON packs; Python scorer in gnostic-engine |
| **Gnostic Engine** | `gnostic-engine/` | Volumetric runtime that evaluates signals against the substrate | Python (uv) |
| **Gnosis Training** | `gnosis-training/` | TTCL Layer 7 Training Pipeline (SFT→Reward→GRPO→Eval); real TRL wiring, dry-run GPU-verified 2026-07-14, real 8B run capital-gated | Python (uv) |
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
|   `-- SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md
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
- **Vector 1: Shaliah Onboarding Arc (The Broken Genesis)** — full onboarding flow landed: Phase 1 (Broken Genesis puzzle), Phase 2 (Shadow Market decoding), and Phase 3 (Archon Interrogation). Local PL ledger tracks progress through the gates.
- **Layer 6 Scheduler (εP + ζF)** — 45-letter-pair reconstruction and Llull's Fourth-Figure Tabula Generalis (84 cameras) structurally integrated into the `canonical_schedule.json` simulated-annealing objective.
- **Vector 3: Cardia Funding Engine & Kafka PL Bridge** — EIP-191 wallet bind triggers a sovereign.pl.ledger.event. The `gate-acl` consumes this and initiates the Cardia ERC-20 transfer ($15k simulation) via the Hepar forensic audit gate.
- **Vector 4: Operational Hardening** — Control Center UI with SSE real-time funding status panels, Redis-backed atomic nonce manager for multi-process safety, and the Express `@sovereign/host` mounted on a clean API structure.
- **Vector 5: MEV Gate & Router B** — Shadow Markout Gate (Pyth RPC + sandwich attack protection, fail-closed) + Capacity Ceiling Enforcer (C-DENSITY-FLOOR slippage throttle). Capital is bound via EIP-712 Sovereign Mandate, and MEV yield routes 50% principal / 40% Shaliah / 10% ecosystem via Router B. Vox Narrative drafted for public external framing.
- **Vector 6: The First Breath (Deployment Readiness)** — Dockerized the full topology (Express Host, Python MEV/Hepar Engine, Redis, Kafka). Added Azure KeyVault `keyCustody` integration, Prometheus observability stack with Grafana, and successfully ran the `first_breath.ts` end-to-end testnet simulation to generate `docs/FIRST_MESHALEACH_AUDIT.md`.
- **Gnosis Training (Stage 2)** — CPU-verified dry-run of the RewardTrainer locking `gnosis-v2.0-reward`; preference corpus at **76** human-judged pairs (UMS Vector 2 CAT9 `PP-042`…`071` + CCM doctrine `PP-072`…`076`; CAT9 **35**, T9/X17/C9).
- **x402-bridge sovereignty remediation** — the bridge is wrapped as a self-contained sovereign agent (`X402Agent`) with a cost-accounting ledger. 
- **Real Hepar Integration** — The legacy `hepar-core` typescript stack was extracted and resurrected as a standalone `@sovereign/hepar-service` microservice. It executes the full 4-stage pipeline (Static, Symbolic, Monte Carlo, Consensus) via Express at `POST /api/v1/hepar`. The python mock is retired, and `docker-compose.yml` natively wires the `hepar-engine` container to the host.

### Active frontier
- **Cloud Provisioning (The Final Breath)** — All infrastructure (Docker Compose, Prometheus, Azure KeyVault, Express endpoints, Python FastAPI) is merged to `main`. The only remaining step is for the architect to physically provision the cloud VM, inject the `BOOTSTRAP_PRIVATE_KEY` to the vault, set up `.env.production`, and run `docker compose --profile with-kafka up -d`.
- **Real 8B GPU Run** — The Stage 2 RewardTrainer works and is CPU-verified, but awaits real GPU capital (RunPod/AWS) to train the 8B parameter model properly.

See the Master Operating File in `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md` for the full axioms, architecture, and execution instructions, and `docs/PROJECT_STATE.md` for the live 9-layer status table.

---

This structure enables the Sovereign vision: compression -> authentic decompression across philosophy, engine, and economics.
