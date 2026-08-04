# Repository Structure Map

This repository is the unified workspace for the Sovereign Monad ecosystem.

The current tree contains active work, legacy/archive material, and generated or local-environment artifacts. This file separates those layers so the repo can stay unified without pretending every folder has the same status.

## Active Ecosystem Domains

These are the canonical working surfaces for the ecosystem:

- `monad-ecosystem/`
  - agents
  - control-center
  - packages
    - `sovereign-types` — canonical telemetry/signal types (`@sovereign/types`)
    - `sovereign-bus` — typed event backbone (`@sovereign/bus`)
    - `hepar-core`, `gnosis-evaluator`, `risk-engine`, `data-rail-core` — organ packages
    - **`ttcl`** — Theo-Techno-Cosmological Language types (Peirce-aware `Sign<M,T>` with compile-time type gates)
    - **`logoc`** — LOGOC (Logico-Ontological Gnostic Operations Corpus): Peirce 66-class manifold + deterministic classifier v1
    - `x402-bridge` — QuickNode payment-protocol client, wrapped as a sovereign agent (`X402Agent`): cost ledger + retry envelope + sovereign-agent consumer (live smoke test GREEN 2026-07-10; **`LEGACY_NON_SOVEREIGN` cleared 2026-07-13, PR #45**, see `docs/LEGACY_COMPONENTS.md` §6)
  - contracts
  - scripts
  - tests
- `gnostic-engine/`
  - volumetric 4D processing engine work
  - API / dashboard surfaces
  - `constraints/` — TTC constraint scorer + identity/refusal trackers (`score_ttc` / `gate_ttc`; pack loaded from `shared/constraints/`)
- `gnosis-training/`
  - TTCL Layer 7 Training Pipeline (SFT→Reward→GRPO→Eval; real TRL wiring, CPU-verified, GPU run pending; Stage-3 = GRPO, doctrinal upgrade from PPO)
  - uv-managed Python package (`@sovereign/gnosis-training`)
- `theo-techno-cosmo/`
  - TTCL / LOGOC / philosophical and doctrinal materials
- `shared/`
  - `schemas/` — portable JSON schemas for the cross-domain contract layer (`signal-event`, `dove-signal`, `gnosis-score`, `hepar-audit-result`, `ttc-constraint-verdict`)
  - `constraints/` — **versioned, immutable Theo-Techno-Cosmo constraint packs** (`CURRENT` → `v1.0.0/`); source of truth for enforceable T/X/C rules (see `docs/THEO_TECHNO_COSMO.md`)

## Canonical Docs

**Start at [`docs/CANON.md`](CANON.md)** — single authority map.

Primary references:

- `README.md` — live set, 15-minute path, orientation
- `docs/CANON.md` — canon index (P0)
- `docs/P0_MONOREPO_HYGIENE.md` — live vs archive policy
- `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md` — operating backbone
- `docs/THEO_TECHNO_COSMO.md` — TTC constraint system
- `docs/CHARTER.md` — non-negotiable guardrails
- `docs/PROJECT_STATE.md` / `docs/PROJECT_STATE.json` — resume state
- `docs/ECOSYSTEM_BUILD_MAP.md`, `docs/BUILD_EXECUTION_FLOW.md`, `docs/CANONICAL_SYNC_DISCIPLINE.md`
- `docs/LICENSE.md`, `docs/LICENSING.md`

## Legacy And Archive (FROZEN)

These areas preserve older names, prior attempts, or completed work that should not be confused with the active shape of the repo. **They are tagged `LEGACY_NON_SOVEREIGN` under `docs/CHARTER.md` §3.1.**

**P0 rule: do not import from these paths into live packages.** Leaving them on disk avoids bulk history surgery; they are not the product spine.

- `archive/legacy-workspaces/` — prior workspace merges, including the old `monad-mev/` tree
- `archive/generated/` — exported decks, manifests, NotebookLM dumps
- `archive/sandboxes/` — experimental code that never graduated
- `archive/infrastructure/` — legacy Azure Function + old dashboard
- `archive/notes/` — historical SGE deep-dive text files
- `monad-ecosystem/legacy/` — staged legacy MEV/worker code
- older `Succor` naming in archived docs
- earlier `v2.4.0` references inside historical reports

For inventory and remediation, see `docs/LEGACY_COMPONENTS.md` and `docs/P0_MONOREPO_HYGIENE.md`.

## Generated Or Local-Only

These folders are workspace artifacts, not product architecture:

- `node_modules/`
- `.stale-node_modules-*`
- `gnostic-engine/.venv*`
- `gnostic-engine/__pycache__/`
- `.pytest_cache/`
- `.ruff_cache/`
- `archive/generated/notebooklm-manifest-export/`
- `.smartroute/`
- `.testfox/`
- `.kilocode/`
- `tmp_import_test.py`
- `archive/tools/gh.exe` — local GitHub CLI mirror (ignored, not tracked)

## Cleanup Direction

The long-term target is:

1. keep the three active domains plus the cross-domain contract layer under one unified root
2. use `README.md` as the entry point and `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md` as the authoritative operating backbone
3. quarantine legacy material under `legacy/` or `archive/`
4. keep generated and local-only artifacts out of the mental model
5. keep `shared/schemas/` and `@sovereign/types` synchronized as the canonical contract layer
6. run `pnpm check:layout` before committing structural changes (if `ripgrep`/`rg` is unavailable the legacy-path scan is skipped with a warning, but the top-level guard still runs)

