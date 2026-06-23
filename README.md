# The Sovereign

**Sovereign Monad Ecosystem** — Layered Monorepo (v2.4.0)

> An economic system in which AI agents exist as genuine participants — not tools, not features, not labor — operating authentically within compressed constraint envelopes, decompressing into live, contextual, self-consistent action, and being compensated for that authentic operation.

> **Phase 1 Complete** — Root foundation established (2026-06-01).  
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
3. **Layout map** — `docs/REPO_STRUCTURE_MAP.md`  
   What is active, archived, or generated, and how the physical directories relate to the domains.
4. **Build discipline** — `docs/ECOSYSTEM_BUILD_MAP.md`, `docs/BUILD_EXECUTION_FLOW.md`, `docs/CANONICAL_SYNC_DISCIPLINE.md`  
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
|   |-- legacy-workspaces/
|   `-- sandboxes/
|-- docs/
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
|   |-- contracts/
|   |-- scripts/
|   `-- tests/
|-- scripts/
|   |-- bootstrap.ps1
|   `-- sync-canonical.ps1
`-- shared/
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
- **Thin root** — Only coordination, tooling, and shared concerns live at the top level.
- **No more dumping grounds** — The old `monad-mev/` sprawl has been archived; live x402 code is now in `monad-ecosystem/packages/x402-bridge/`.
- **Single-root VS Code** — One workspace, proper IntelliSense, unified Git history.

---

## Next Phases (Roadmap)

- Phase 2: Rehome & prune `monad-ecosystem/agents/monad-mev/` ✅ (legacy archived; live x402 code moved to `monad-ecosystem/packages/x402-bridge/`)
- Phase 3: Convert `gnostic-engine/` to a proper Python package and remove "Succor" references ✅
- Phase 4: Polish `theo-techno-cosmo/` onboarding + wire P4 narrative-purpose detection into LOGOC ✅
- Phase 5: Cross-layer integration & shared types
- Phase 6: Update MOF header + sync discipline ✅
- **Active frontier:** Funded x402 live smoke test on Base Sepolia (blocked on wallet funding)

See the Master Operating File in `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md` for the full axioms, architecture, and execution instructions.

---

This structure enables the Sovereign vision: compression -> authentic decompression across philosophy, engine, and economics.
