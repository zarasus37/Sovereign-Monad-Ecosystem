# Repository Structure Map

This repository is the unified workspace for the Sovereign Monad ecosystem.

The current tree contains active work, legacy/archive material, and generated or local-environment artifacts. This file separates those layers so the repo can stay unified without pretending every folder has the same status.

## Active Pillars

These are the canonical working surfaces for the ecosystem:

- `monad-ecosystem/`
  - agents
  - control-center
  - packages
    - `sovereign-types` — canonical telemetry/signal types
    - `sovereign-bus` — event backbone
    - `hepar-core`, `gnosis-evaluator`, `risk-engine`, `data-rail-core` — organ packages
    - **`ttcl`** — Theo-Techno-Cosmological Language types (Peirce-aware `Sign<M,T>` with compile-time type gates)
    - **`logoc`** — LOGOC (Logico-Ontological Gnostic Operations Corpus): Peirce 66-class manifold + deterministic classifier v1
  - contracts
  - scripts
  - tests
- `gnostic-engine/`
  - volumetric 4D processing engine work
  - API / dashboard surfaces
- `theo-techno-cosmo/`
  - TTCL / LOGOC / philosophical and doctrinal materials

## Canonical Docs

These files define system-level truth and should be treated as primary references:

- `docs/OPEN_FIRST.md`
- `docs/PROJECT_STATE.md`
- `docs/PROJECT_STATE.json`
- `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md`
- `docs/ECOSYSTEM_BUILD_MAP.md`
- `docs/BUILD_EXECUTION_FLOW.md`
- `docs/CANONICAL_SYNC_DISCIPLINE.md`
- `docs/LICENSE.md`
- `docs/LICENSING.md`

## Legacy And Archive

These areas preserve older names, prior attempts, or completed work that should not be confused with the active shape of the repo:

- `archive/legacy-workspaces/`
- `archive/generated/`
- `archive/sandboxes/`
- `monad-ecosystem/legacy/`
- older `Succor` naming that still appears in archived docs and manifests
- earlier `v2.4.0` references inside historical reports and snapshots

## Generated Or Local-Only

These folders are workspace artifacts, not product architecture:

- `node_modules/`
- `.stale-node_modules-*`
- `gnostic-engine/.venv*`
- `gnostic-engine/__pycache__/`
- `.pytest_cache/`
- `archive/generated/notebooklm-manifest-export/`
- `.smartroute/`
- `tmp_import_test.py`

## Cleanup Direction

The long-term target is:

1. keep the three active pillars under one unified root
2. use `docs/OPEN_FIRST.md` as the entry order for new sessions
3. quarantine legacy material under `legacy/` or `archive/`
4. keep generated and local-only artifacts out of the mental model
5. use the MOF and companion docs to define the authoritative operating state
6. run `pnpm check:layout` before committing structural changes (if `ripgrep`/`rg` is unavailable the legacy-path scan is skipped with a warning, but the top-level guard still runs)

