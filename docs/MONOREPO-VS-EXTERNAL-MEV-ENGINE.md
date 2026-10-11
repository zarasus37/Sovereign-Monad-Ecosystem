# Monorepo vs. External MEV Engine — 2026-10-11

> **Origin:** `docs/P0_MONADMEV_DECISION_2026-10-11.md` flagged that the
> "MEV" in `@sovereign/monad-mev` (now `@sovereign/loop`) is a historical
> label, and that the actual cross-chain MEV engine is a separate repo.
> This doc captures the relationship so future sessions don't waste time
> looking for MEV bots in this monorepo or treating the monorepo package
> as a MEV engine.

## The two artifacts

### 1. `@sovereign/loop` (this monorepo)

- **Path:** `monad-ecosystem/packages/loop/`
- **GitHub:** `https://github.com/zarasus37/Sovereign-Monad-Ecosystem.git`
- **What it is:** A TypeScript library implementing the Sovereign
  Execution Loop — bounded-agency trade execution (Capital Mandate,
  Capacity Ceiling, Shadow Markout, Router B yield).
- **Charter role:** §3 sovereignty-as-architectural-property
  primitive. Vectors 5.1–5.3.
- **Status:** `alpha → graduate by 2027-01-06` (per
  `docs/LIVE_PACKAGES.md`).
- **Consumed by:** the external MEV engine (see below), `gate-acl`,
  `execution-truth-core`, the Azure `python-engine` deployment.

The package's **Python "truth oracle"** (`loop/python/shadow_markout_api.py`)
is a **placeholder** — it has `# TODO: Wire your existing
shadow_markout_hardened.py logic here` and uses simple heuristics. The
TS gate is real; the oracle is a mock. Production risk is concentrated
in this single file until it's ported or explicitly pinned.

### 2. The cross-chain MEV arbitrage engine (separate repo)

- **Path:** `C:\Users\crisc\Dev\agents\monad-mev\` (local-only, on this
  developer's machine; **not in this monorepo**)
- **What it is:** 15-microservice cross-chain MEV engine —
  Monad testnet ↔ Ethereum mainnet arbitrage. Kafka + ZooKeeper +
  Streamlit dashboard. 4-layer pipeline (Market Intelligence → Risk /
  Decision → Execution → Feedback).
- **Status:** Phase 1–3 complete, Phase 4 (mainnet transition) pending.
  Backtest: 100% win rate on 48 trades, +36.48% on $100 starting
  capital.
- **Reference doc:** `monad-ecosystem/packages/risk-engine/MEV-ENGINE-REFERENCE.md`
  (208 lines, describes every container, env var, RPC failover path,
  and known issue as of 2026-03-17).
- **Consumes:** `@sovereign/loop` (this monorepo) as its TypeScript
  client library for trade execution. The engine orchestrates
  market-agent / spread-scanner / risk-engine / portfolio-manager
  services and **calls into the library** for the actual guarded-trade
  primitive.

## Why are they split?

The library (`@sovereign/loop`) is a **reusable sovereign primitive**.
It could be consumed by any number of product surfaces (the engine, a
direct user-facing wallet, a research backtester, etc.). The engine is
**one product surface that happens to consume it**.

Putting the engine in the monorepo would force every Sovereign
contributor to also maintain 15 Docker containers, Kafka, and the
Monad/Ethereum RPC plumbing. The monorepo's `pnpm validate` would
expand from a few minutes to ~20 minutes (the engine build is heavy).
That's the wrong cost-shape for a sovereign-organ library repo.

The cost of the split is **two places to look for the engine** when
debugging. This doc and the rename (`@sovereign/monad-mev` →
`@sovereign/loop`) is the disambiguation.

## The empty `monad-mev-archive/` directory

`monad-ecosystem/legacy/monad-mev-archive/` exists but is **empty**
(0 files, 0 subdirs). It was created as a planned freeze location
for the historical MEV work but was never populated. The historical
MEV bots live in the separate engine repo, not in this monorepo.

**Action item** (deferred to a follow-up PR):
- Remove `monad-ecosystem/legacy/monad-mev-archive/` as a fossil.
- Or repurpose it: if the engine is ever brought into the monorepo
  via git subtree, this is the right landing spot for a frozen copy.

## For the next session

- Looking for the **bounded-agency execution library** →
  `monad-ecosystem/packages/loop/` (this monorepo).
- Looking for the **cross-chain arbitrage engine** →
  `C:\Users\crisc\Dev\agents\monad-mev\` (separate repo on this
  machine; cross-repo refactor requires explicit authorization).
- Looking for "MEV archive" in this monorepo → not here. The
  `monad-mev-archive/` directory is empty; see above.

— Mavis (2026-10-11)
