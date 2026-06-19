# The Sovereign

**Unified Theotechnological Gnostic Ecosystem** - Layered Monorepo (v2.4.0)

> **Phase 1 Complete** - Root foundation established (2026-06-01).  
> This repository is the canonical working copy for one unified system. Any mirrored copies are downstream sync targets only.

This repository unifies three conceptual pillars into a single, maintainable monorepo:

| Pillar | Location | Responsibility | Tech Stack |
|---|---|---|---|
| **Theo-Techno-Cosmo** | `theo-techno-cosmo/` | Philosophy, theology, LOGOC, Llull Wheels | Markdown, PDF, research code |
| **Gnostic Engine** | `gnostic-engine/` | Volumetric 4D runtime, API, dashboard | Python (uv) |
| **Monad Ecosystem** | `monad-ecosystem/` | Agents, Hepar, control-center, contracts | TypeScript, Motoko, Solidity |

For a clearer breakdown of active pillars versus legacy and generated surfaces, see
[docs/REPO_STRUCTURE_MAP.md](docs/REPO_STRUCTURE_MAP.md).

## Open This First

If you are opening the root folder and need to know what matters immediately, read these first:

1. [docs/OPEN_FIRST.md](docs/OPEN_FIRST.md)
2. [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md)
3. [docs/REPO_STRUCTURE_MAP.md](docs/REPO_STRUCTURE_MAP.md)
4. [docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md](docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md)

If you are changing build order, sync discipline, or architecture, read these next:

1. [docs/ECOSYSTEM_BUILD_MAP.md](docs/ECOSYSTEM_BUILD_MAP.md)
2. [docs/BUILD_EXECUTION_FLOW.md](docs/BUILD_EXECUTION_FLOW.md)
3. [docs/CANONICAL_SYNC_DISCIPLINE.md](docs/CANONICAL_SYNC_DISCIPLINE.md)

Archive material lives under `archive/` and is historical unless explicitly promoted.

## Working Standard

For contributor rules and cleanup expectations, see [CONTRIBUTING.md](CONTRIBUTING.md).

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
|   |-- legacy-workspaces/
|   `-- sandboxes/
|-- docs/
|   |-- OPEN_FIRST.md
|   |-- PROJECT_STATE.md
|   |-- REPO_STRUCTURE_MAP.md
|   `-- SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md
|-- theo-techno-cosmo/
|   |-- Wheel/
|   |-- THE COUNCILE/
|   |-- plex/
|   `-- notes/
|-- gnostic-engine/
|   |-- src/
|   |-- api/
|   |-- dashboard/
|   `-- ...
|-- monad-ecosystem/
|   |-- packages/
|   |-- control-center/
|   |-- agents/
|   |-- contracts/
|   |-- scripts/
|   `-- tests/
|-- scripts/
|   |-- bootstrap.ps1
|   `-- sync-canonical.ps1
`-- shared/
```

## Quick Start

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

The canonical operating file for ecosystem status, architecture, roadmap, and blockers is
`docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md`.

Licensing authority is centralized at the root:
- `docs/LICENSE.md`
- `docs/LICENSING.md`
- `docs/LICENSE.commercial.md`

## Philosophical Foundation - Theo-Techno-Cosmo

The Sovereign Monad is built on a unified philosophical framework integrating theology, technology, and cosmology:

Start here: [theo-techno-cosmo/README.md](theo-techno-cosmo/README.md)

This directory contains:
- **The Wheel** - Operative diagrams and contemplative maps (Llull's Ars Magna adapted)
- **The Council** - Historical lineages showing these patterns recur across independent traditions
- **The PLEX** - How philosophical principles become operational reality, measured and audited in real-time

New to the Sovereign Monad? Begin with the [Theo-Techno-Cosmo quick start guide](theo-techno-cosmo/README.md#quick-start-new-to-the-sovereign-monad).

---

## Philosophy of This Structure

- **Explicit pillars** - Each of the three original projects keeps its identity and integrity.
- **Thin root** - Only coordination, tooling, and shared concerns live at the top level.
- **No more dumping grounds** - The old `monad-mev/` sprawl will be tamed in Phase 2.
- **Single-root VS Code** - One workspace, proper IntelliSense, unified Git history.

---

**Next Phases (roadmap)**
- Phase 2: Rehome & prune `monad-ecosystem/agents/monad-mev/`
- Phase 3: Convert `gnostic-engine/` to a proper Python package and remove "Succor" references
- Phase 4: Polish `theo-techno-cosmo/` onboarding
- Phase 5: Cross-layer integration & shared types
- Phase 6: Update MOF header + sync discipline

See the Master Operating File in `docs/` for the full axioms, architecture, and execution instructions.

This structure enables the Sovereign vision: compression -> authentic decompression across philosophy, engine, and economics.
