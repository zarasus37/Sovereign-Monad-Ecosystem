# The Sovereign

**Unified Theotechnological Gnostic Ecosystem** — Layered Monorepo (v2.4.0)

> **Phase 1 Complete** — Root foundation established (2026-06-01).  
> This is now the **canonical working copy**. The previous `C:\Users\crisc\Dev\agents\sovereign-monad` mirror will be updated in Phase 6.

This repository unifies three conceptual pillars into a single, maintainable monorepo:

| Pillar                    | Location                  | Responsibility                              | Tech Stack          |
|---------------------------|---------------------------|---------------------------------------------|---------------------|
| **Theo-Techno-Cosmo**     | `theo-techno-cosmo/`      | Philosophy, theology, LOGOC, Llull Wheels   | Markdown, PDF, research code |
| **Gnostic Engine**        | `gnostic-engine/`         | Volumetric 4D runtime, API, dashboard       | Python (uv)         |
| **Monad Ecosystem**       | `monad-ecosystem/`        | Agents, Hepar, control-center, contracts    | TypeScript, Motoko, Solidity |

## New Unified Directory Structure (Post-Phase 1)

```
The_Sovereign/
├── .gitignore                  # Comprehensive (Phase 1)
├── pnpm-workspace.yaml
├── package.json                # Root scripts + workspaces
├── pyproject.toml              # (Phase 3) uv workspace for Python
├── README.md
├── docs/                       # All canonical specifications
│   └── SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.3.0.md
├── theo-techno-cosmo/          # Philosophical pillar (mostly immutable)
│   ├── Wheel/
│   ├── THE COUNCILE/
│   ├── plex/
│   └── notes/
├── gnostic-engine/             # Engine pillar (being converted to proper package)
│   ├── src/
│   ├── api/
│   ├── dashboard/
│   └── ...
├── monad-ecosystem/            # Economic/agentic pillar (true monorepo)
│   ├── packages/               # Promoted stable packages (gnosis-*, hepar-*, organ-*)
│   ├── control-center/         # ICP/Motoko (moved here)
│   ├── agents/
│   ├── contracts/
│   ├── scripts/
│   └── tests/
├── scripts/                    # Root orchestration
│   ├── bootstrap.ps1
│   └── sync-canonical.ps1      # (Phase 6)
└── shared/                     # Cross-pillar types & schemas (future)
```

## Quick Start

```powershell
# One-time setup
pnpm install
.\scripts\bootstrap.ps1

# Development
pnpm dev
```

See `scripts/bootstrap.ps1` for full environment setup (uv + pnpm).

## Philosophy of This Structure

- **Explicit pillars** — Each of the three original projects keeps its identity and integrity.
- **Thin root** — Only coordination, tooling, and shared concerns live at the top level.
- **No more dumping grounds** — The old `monad-mev/` sprawl will be tamed in Phase 2.
- **Single-root VS Code** — One workspace, proper IntelliSense, unified Git history.

---

**Next Phases (roadmap)**
- Phase 2: Rehome & prune `monad-ecosystem/agents/monad-mev/`
- Phase 3: Convert `gnostic-engine/` to proper Python package + remove "Succor" references
- Phase 4: Polish `theo-techno-cosmo/` onboarding
- Phase 5: Cross-layer integration & shared types
- Phase 6: Update MOF header + sync discipline

See the Master Operating File in `docs/` for the full axioms, architecture, and execution instructions.

This structure enables the Sovereign vision: **compression → authentic decompression** across philosophy, engine, and economics.
