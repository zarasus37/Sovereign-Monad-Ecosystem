# Phase 2 Migration Plan — monad-ecosystem Reorganization

**Date**: 2026-06-01  
**Status**: In Progress  
**Goal**: Transform `monad-ecosystem/agents/monad-mev/` from a sprawling "everything" dump into a clean, maintainable monorepo under `monad-ecosystem/packages/`.

---

## Current Situation

- `monad-ecosystem/packages/` already contains:
  - `gnosis-security-engine/`
  - `hepar-defi-auditor/`
  - `organ-runtime/`
  - `organs/`

- The vast majority of active development artifacts still live in:
  - `monad-ecosystem/agents/monad-mev/`

- Many subdirectories inside `monad-mev/` are:
  - Experimental / stub implementations (`*-core/`)
  - One-off research spikes
  - Contain nested `.git/`, `.venv/`, `node_modules/`, test outputs

- `STATUS.md` and `HEPAR_CORE_STATUS.md` indicate that most packages are "scaffold-complete" or in stub mode. Only a few are considered bounded production artifacts (`lightverify-core`, `emergence-claim-core`, `hepar-core`).

---

## Recommended Strategy

**Do NOT** attempt a big-bang move of 50+ directories.

Instead:

1. **Promote only high-confidence packages** that are referenced in the MOF or have clear completion summaries.
2. **Archive the rest** into `monad-ecosystem/legacy/monad-mev-archive/`.
3. **Clean** obvious junk (nested git/venv/node_modules) during the move.
4. Update all internal imports/references after each batch.

---

## Tier 1 — Promote Immediately (High Confidence)

Based on MOF mentions + completion summaries:

- `lightverify-core/`
- `emergence-claim-core/`
- `emergence-history-core/`
- `hepar-core/` (if not already inside organ-runtime)
- `gnosis-core/`
- `gnosis-evaluator-core/`
- `risk-engine/`
- `reward-ledger-core/`

## Tier 2 — Promote After Review

- `data-rail-*`
- `emergence-*-core` family
- `execution-truth-core/`
- `population-*-core/`

## Tier 3 — Archive (Experimental / One-off)

Everything else (`activation-decision-core/`, `boundary-stress-monitor/`, `cardia-activation-core/`, most `*-bot/`, `demo-package/`, etc.).

---

## Execution Log (Phase 2)

**2026-06-01 – Batch 1 (Tier 3 Archive)**
- Created `monad-ecosystem/legacy/monad-mev-archive/`
- Moved 8 experimental packages:
  - `activation-decision-core/`
  - `arb-bot/`
  - `boundary-stress-monitor/`
  - `Breakdown and visual/`
  - `bridge-agent/`
  - `cardia-activation-core/`
  - `demo-package/`
  - `dove-integration-core/`

**2026-06-01 – Batch 2 (Tier 1 Promotion)**
- Promoted to `monad-ecosystem/packages/`:
  - `lightverify-core/`
  - `gnosis-core/`
  - `risk-engine/`

**2026-06-01 – Batch 3 (Tier 1 Promotion – Second Wave)**
- Promoted to `monad-ecosystem/packages/`:
  - `emergence-claim-core/`
  - `emergence-history-core/`
  - `reward-ledger-core/`

**2026-06-01 – Batch 4 (Final Tier 1 Promotion)**
- Promoted to `monad-ecosystem/packages/`:
  - `gnosis-evaluator-core/`
  - `hepar-core/`

**Tier 1 Promotion Phase: COMPLETE**

- Updated `pnpm-workspace.yaml` and root `package.json` with comments.
- All Tier 1 packages are now in the clean `packages/` directory.

---

## Current Package Count

- `monad-ecosystem/packages/`: **22 packages**
- Archived (legacy): **56+ packages** (including review-based items)

**Tier 1 + Tier 2 organization is now complete.**

**2026-06-01 – Tier 3 Archiving (Batches 1–3)**
- Archived **40 experimental packages** total to `legacy/monad-mev-archive/`.
- `agents/monad-mev/` now mostly contains documentation, a few infrastructure folders (`config/`, `contracts/`, `deployments/`, `scripts/`), and junk.

**Tier 3 Archiving: Largely Complete.**

**Review-Based Archiving Executed (2026-06-01)**:
- Archived from `agents/monad-mev/` based on review:
  - `orchestrator.py`
  - Test scripts: `api_test.py`, `test_stage_c_v3.py`, `verify_key.py`
  - Package files: `package.json`, `package-lock.json`
  - `local.settings.json`
  - `tmp/`

**Junk Cleaning Completed** on both `legacy/monad-mev-archive/` and `agents/monad-mev/`.

**Tier 1 is now fully complete.**

**2026-06-01 – Tier 2 Promotion (First Batch)**
- Promoted to `monad-ecosystem/packages/`:
  - `emergence-accumulator-core/`
  - `emergence-baseline-core/`
  - `emergence-observer-core/`
  - `data-rail-core/`
  - `execution-truth-core/`

**2026-06-01 – Tier 2 Promotion (Final Batch)**
- Promoted to `monad-ecosystem/packages/`:
  - `data-rail-governance/`
  - `data-rail-router/`
  - `population-expansion-core/`
  - `population-growth-core/`
  - `emergent-protocol-core/`

**Tier 2 Promotion Phase: COMPLETE**

All Tier 2 packages have been organized into `packages/`. We can now decide whether to continue with Tier 3 archiving or move to cleaning junk in the legacy folder.

*This document will continue to be updated as Phase 2 progresses.*

Would you like me to:
- Create the `legacy/` folder and move Tier 3 items?
- Promote the first 3–4 Tier 1 packages?
- Generate a detailed file-by-file mapping first?

---
*This document will be updated as Phase 2 progresses.*