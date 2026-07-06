# Legacy / Non‑Sovereign Components

> This inventory implements `docs/CHARTER.md` §3.1 (Legacy components and remediation).
>
> Effective date of the charter: **2026‑07‑06**  
> Remediation deadline for components in this file: **2027‑07‑06** (12 months), unless a sooner date is noted.

## What this file is

A component is listed here if it was present in the main branch before the charter effective date and does **not** satisfy the sovereignty criteria in `docs/CHARTER.md` §3:

1. Holds and manages its own resources under well‑defined keys/contracts.
2. Bears its own operational costs via its own flows, not hidden human subsidies.
3. Can continue operating, within its constraint envelope, even if its original human creator becomes inactive.
4. Control surfaces (admin keys, kill switches, overrides) are explicit, narrow, and justified in terms of safety and LOGOC.

The list is not exhaustive. It focuses on the clearest current cases so that maintainers can:

- see where the “old world” ends and the sovereign core begins,
- decide per component whether to **remediate**, **isolate**, or **archive**, and
- track deadlines so §3.1 cannot drift indefinitely.

---

## Inventory

### 1. `monad-ecosystem/legacy/monad-mev-archive/`

**What it is:** The old `monad-mev` workspace rehomed under `legacy/`. Contains arbitrage bots, market agents, bridge execution bots, alert rules, and activation-decision code from before the Sovereign Monad architecture.

**Why it is non‑sovereign:**

- Human‑operated MEV tooling, not agents with on‑chain identity or constraint envelopes.
- No self‑funded cost centers; assumes human‑subsidized compute, RPC, and wallet keys.
- Cannot continue if the human operator steps away.
- Control surfaces (private keys, bot configuration) are implicit and human‑centralized.

**Chosen path:** **Archive**

**Action:** Keep under `legacy/` for historical reference. Do not import into active builds. Review for permanent deletion or conversion into documented case studies by the deadline.

**Deadline:** 2027‑07‑06

**Tags applied:** `LEGACY_NON_SOVEREIGN` marker added to `monad-ecosystem/legacy/README.md` or directory note.

---

### 2. `archive/infrastructure/`

**What it is:** Legacy deployment surfaces:

- `api/` — Azure Function telemetry endpoint (`function_app.py`).
- `dashboard/` — Default Vite React dashboard that pointed to old `monad-mev/` paths.

**Why it is non‑sovereign:**

- Centralized human‑operated infrastructure.
- No on‑chain identity, cost accounting, or autonomous operation model.
- `dashboard/` references paths that no longer exist in the active tree.
- Control surfaces (Azure keys, deployment credentials) are not documented in the repo.

**Chosen path:** **Archive**

**Action:** Keep under `archive/infrastructure/`. These are historical artifacts, not part of the active sovereign runtime. Review for deletion or rewrite as sovereignty‑compliant observability surfaces by the deadline.

**Deadline:** 2027‑07‑06

---

### 3. `archive/legacy-workspaces/`

**What it is:** Prior workspace merges, including the old `legacy-monad-ecosystem-workspace` tree (`capital_router`, `cognitive_agents`, `compiler`, `runtime_defense`, `state_registry`, etc.) and `monad-mev-diagnostics-2026-05` / `monad-mev-legacy-2026-06` snapshots.

**Why it is non‑sovereign:**

- Pre‑dates the `@sovereign/types` + `@sovereign/bus` contract layer.
- No unified agent identity, personality frame, or constraint envelope model.
- Human‑centric Python scaffolds with local `.runtime_state` directories rather than on‑chain or shared state.

**Chosen path:** **Archive**

**Action:** Preserve as historical reference under `archive/legacy-workspaces/`. Do not promote back to active workspace without a full charter review and sovereignty redesign.

**Deadline:** 2027‑07‑06

---

### 4. `monad-ecosystem/packages/organs/pneuma/public-activation-core/`

**What it is:** A scaffold package described as a “local readiness surface for production/private and broader public activation.”

**Why it is non‑sovereign:**

- Scaffold‑only: no real implementation, missing `tsconfig.json`, currently excluded from monorepo builds.
- No agent identity, resource ownership, or operational envelope.
- “Activation” framing is human‑gated and ceremonial rather than sovereignty‑driven.

**Chosen path:** **Isolate / remediate or archive**

**Action:** Either:

- a) rebuild it as a real sovereignty‑compliant activation gate with documented keys, cost accounting, and constraint envelope, or
- b) archive it under `archive/` if no active owner emerges.

Because the package is currently broken, the deadline is sooner than the general 12‑month window.

**Deadline:** 2027‑01‑06

---

### 5. `monad-ecosystem/packages/risk-engine/`

**What it is:** Monte Carlo‑based risk evaluator for Base/Arbitrum cross‑chain arbitrage opportunities. Emits `risk.opportunity-evaluation` and retains MEV‑era references (`MEV-ENGINE-REFERENCE.md`, `MEV_LICENSING_BUILD_GUIDE.md`).

**Why it is non‑sovereign:**

- Designed as a tool that approves/rejects opportunities for human‑operated arb bots, not as a risk oracle serving sovereign agents.
- No on‑chain identity or cost center for the engine itself.
- Legacy references frame the system around MEV extraction rather than agent decompression and constraint envelopes.

**Chosen path:** **Remediate or archive**

**Action:** Refactor into a true Oracle / risk‑gnosis organ that:

- consumes `@sovereign/types` signals,
- serves agent constraint envelopes rather than human‑approved trades,
- documents any human override surfaces and justifies them under LOGOC.

If no owner takes this on by the deadline, archive the MEV‑specific artifacts and replace with a sovereignty‑first risk oracle design.

**Deadline:** 2027‑07‑06

---

### 6. `monad-ecosystem/packages/x402-bridge/`

**What it is:** QuickNode X402 payment‑protocol client wrapper (`pyproject.toml`, Python source, tests). Bridges external payment infrastructure.

**Why it is non‑sovereign:**

- External dependency bridge, not a sovereign agent.
- Smoke test is blocked on funding, so operational cost accounting and failure boundaries are not yet validated.
- No documented constraint envelope or on‑chain identity for the bridge itself.

**Chosen path:** **Remediate or archive**

**Action:** Either:

- a) remediate to expose explicit cost accounting, retry/failure policy, and a bounded operational envelope tied to a sovereign agent, or
- b) archive if the integration cannot be made sovereignty‑compliant.

**Deadline:** 2027‑07‑06

---

### 7. Scaffold‑only organ packages

**What they are:** A group of packages under `monad-ecosystem/packages/` that currently contain little or no implementation beyond a placeholder `index.ts`, empty `src/`, or README/config stubs. Examples include:

- `data-rail-governance/`
- `data-rail-router/`
- `emergence-accumulator-core/`
- `emergence-baseline-core/`
- `emergence-claim-core/`
- `population-expansion-core/`
- `reward-ledger-core/`
- `lightverify-core/`

**Why they are non‑sovereign:**

- No operational runtime, so sovereignty criteria cannot yet be evaluated.
- Placeholder packages risk becoming fake sovereignty if they are documented or marketed as active organs before they have constraint envelopes and cost centers.

**Chosen path:** **Isolate / remediate**

**Action:** Each placeholder must either:

- graduate to a real implementation that satisfies §3 before being treated as active, or
- be explicitly tagged as `LEGACY_NON_SOVEREIGN` / `SCAFFOLD` and removed from the active mental model.

This inventory does not enumerate every empty package individually because their status may change quickly; maintainers should audit them during each phase gate.

**Deadline:** Per‑package, no later than 2027‑07‑06.

---

## Remediation statuses

| Status | Meaning |
|---|---|
| `archive` | Historical material kept for reference; not part of active architecture. |
| `isolate` | Kept in tree but fenced off from active builds, docs, and governance flows. |
| `remediate` | Actively being redesigned to satisfy §3; deadline applies. |
| `pending-review` | No owner or path chosen; must be resolved before deadline. |

---

## How to update this file

- When a component is remediated, change its status to `remediated`, link to the PR, and remove its `LEGACY_NON_SOVEREIGN` markers.
- When a component is archived, change its status to `archived` and note the commit.
- When a new pre‑charter non‑compliant component is discovered, add it with status `pending-review` and a deadline no later than 2027‑07‑06.
- All updates require a Steward Council review if they change a chosen path or extend a deadline.

---

## Related

- `docs/CHARTER.md` §3, §3.1 — Sovereignty as an architectural property; legacy remediation
- `docs/REPO_STRUCTURE_MAP.md` — Active vs. legacy/archive layout
- GitHub issue #7 — Tag `LEGACY_NON_SOVEREIGN` components and plan remediation or archival
