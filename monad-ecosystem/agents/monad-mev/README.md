# Sovereign Monad (Unified Workspace)

This is the consolidated repository for the Sovereign Monad ecosystem, incorporating both the **Phase 1a smart contracts (Hardhat)** and the **Monad-MEV Forensic Stack / HEPAR pipeline**.

## Canonical Modules & Materials
*   `contracts/` — Canonical Solidity smart contracts including `DoveCore.sol`.
*   `hepar_mcts_engine/` — Institutional-grade multi-agent forensic simulation stack.
*   `sovereign-site/` — High-performance user interface for ecosystem control.
*   `scripts/` & `test/` — Hardhat contract build, preflight, deployment, and testing harnesses.

---
# Sovereign Monad (Unified Workspace)

This is the consolidated repository for the Sovereign Monad ecosystem, incorporating both the **Phase 1a smart contracts (Hardhat)** and the **Monad-MEV Forensic Stack / HEPAR pipeline**.

## Canonical Modules & Materials
*   `contracts/` — Canonical Solidity smart contracts including `DoveCore.sol`.
*   `hepar_mcts_engine/` — Institutional-grade multi-agent forensic simulation stack.
*   `sovereign-site/` — High-performance user interface for ecosystem control.
*   `scripts/` & `test/` — Hardhat contract build, preflight, deployment, and testing harnesses.

---
# Sovereign Repo Overview

Sovereign is a cross-chain arbitrage and market-monitoring repository. The repo currently contains:

- Base/Arbitrum dry-run deployment artifacts
- legacy Monad/Ethereum reference packages
- a standalone demo package
- API, billing, and license-service commercialization scaffolds

Canonical project status does not live in this repo. Use the separate `sovereign-monad` repo for current phase, blocker state, and what is or is not live: `https://github.com/zarasus37/sovereign-monad`.

## Source Of Truth

- Canonical status and active master phase: `https://github.com/zarasus37/sovereign-monad`
- Local mirrored MOF for workspace use: `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md`
- Local mirrored build map for workspace use: `docs/ECOSYSTEM_BUILD_MAP.md`
- Local mirrored sync discipline for workspace use: `docs/CANONICAL_SYNC_DISCIPLINE.md`
- Local mirrored candidate standard kernel v0: `docs/CANDIDATE_STANDARD_KERNEL_V0.md`
- Cortical control overlay reference: `docs/CORTICAL_OVERLAY_MODEL.md`
- Base/Arbitrum repo migration notes: `docs/MIGRATION-BASE-ARB.md`
- Service and topic flow artifacts: `ARCHITECTURE.md`
- Proposed funded operating envelope: `docs/GUARDED-LIVE-PROFILE.md`
- Base/Arbitrum deployment artifact entrypoint: `docker-compose.mainnet.yml`
- Commercialization guide: `risk-engine/MEV_LICENSING_BUILD_GUIDE.md`

Refresh all local canonical mirrors from the canonical repo with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-canonical-mirrors.ps1
```

Normal rule:

- refresh mirrors after completed phase/step truth changes
- batch routine mirror updates to once per day when practical

Verify the active runtime, game-control, and speech packages with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-active-packages.ps1
```

Materialize the local GameFi source config after on-chain source registration with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init-gamefi-bootstrap-config.ps1
```

## Repo Runtime Artifacts

- Base side: `base-market-agent`
- Arbitrum side: `arbitrum-market-agent`
- Spread path: `spread-scanner -> opportunity-constructor -> risk-engine -> portfolio-manager`
- Execution artifact: `arb-bot` with `DRY_RUN=true`
- Observability: `model-feedback-logger`, `alert-rules`, `monitoring/dashboard.py`
- Risk-engine sanity tooling: deterministic stress matrix with report output at `risk-engine/artifacts/stress-matrix.json`

These are repo artifacts. They should not be read as proof that the broader program has advanced phases.

## Base/Arbitrum Pipeline Artifact

```text
Layer 1: Market Intelligence
base-market-agent        -> market.base.price-snapshot
arbitrum-market-agent    -> market.arbitrum.price-snapshot
spread-scanner           -> market.spread.signal
stress-monitor           -> market.stress-signal

Layer 2: Risk / Decision
opportunity-constructor  -> risk.opportunity-candidate
risk-engine              -> risk.opportunity-evaluation

Layer 3: Execution
portfolio-manager        -> execution.execution-plan
arb-bot                  -> execution.execution-result

Layer 4: Feedback / Observability
model-feedback-logger    -> JSONL event logs
monitoring/dashboard.py  -> Streamlit dashboard
```

## Quick Start

If you are exercising the Base/Arbitrum artifact path:

```bash
copy .env.example .env
docker compose -f docker-compose.mainnet.yml up -d --build
start http://localhost:8501
docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String 'base-arb-mev-mainnet'
```

## Agent 0 Shadow Paper Trading

For pre-live evaluation, capture `execution.execution-plan` and run the deterministic markout analyzer:

```bash
python monitoring/agent0_paper_trade.py --logs-dir monitoring/logs
```

Outputs:

- `monitoring/logs/agent0-paper-trades.csv`
- `monitoring/logs/agent0-paper-summary.json`

This computes "would-have" PnL using logged plan entry/exit prices and future market mids at each horizon. It does not submit swaps.

Typical repo-level validation thresholds:

- `DRY_RUN=true`
- `MIN_SPREAD_BPS=12`
- `MIN_LIQUIDITY_10BPS_USD=750`
- `MIN_CAPACITY_USD=3000`
- `MIN_SIZE_USD=250`
- `RISK_FIXED_COST_BPS=8`
- `RISK_MIN_EFFECTIVE_SPREAD_BPS=12`
- `MAX_SINGLE_TRADE_PERCENT=10`
- `MAX_SLIPPAGE_BPS=50`

Current repo-local package signal:

- `risk-engine`: `28` passing tests, including deterministic stress-matrix regression coverage

If this route is resumed toward funded use, the guarded-live profile should be activated only after wallet funding, preflight checks, and explicit operator review.

## Commercial Surfaces In Repo

- Buyer demo: `demo-package/`
- Starter/Pro API: `templates/api/`
- Billing scaffold: `templates/billing/`
- License-service scaffold: `templates/license-service/`
- Combined commercial stack: `templates/commercial-stack/`
- High-fidelity DeFi gaming lifecycle monitor: `gamefi-control-core/`
- High-fidelity DeFi gaming lifecycle API: `gamefi-control-api/`
- High-fidelity DeFi gaming control UI: `gamefi-control-frontend/`
- Organ coordination runtime: `organ-runtime/`
- Shared ecosystem state API: `ecosystem-state-api/`
- Internal ecosystem dashboard: `ecosystem-dashboard/`
- Platform builder infrastructure: `platform-builder/`
- Controlled expansion framework: `expansion-control/`
- Keys scaffold and delegation policy: `keys-core/`
- DAO scaffold and governance workflow: `dao-core/`
- Keys NFT metadata and collection policy scaffold: `keys-nft-core/`
- Narrative packaging scaffold: `narrative-core/`
- Dove drift-signaling integration scaffold: `dove-integration-core/`
- Gnosis evaluation scaffold: `gnosis-evaluator-core/`
- Data Rail preparation scaffold: `data-rail-core/`
- Data Rail routing scaffold: `data-rail-router/`
- Data Rail internal reward ledger scaffold: `reward-ledger-core/`
- Data Rail governance scaffold: `data-rail-governance/`
- Data product bundle scaffold: `data-product-core/`
- LightVerify commercial certification scaffold: `lightverify-core/`
- Population growth scaffold: `population-growth-core/`
- Rights review scaffold: `rights-review-core/`
- Externalization readiness scaffold: `externalization-readiness-core/`
- Activation decision scaffold: `activation-decision-core/`
- Population expansion scaffold: `population-expansion-core/`
- Emergence observation scaffold: `emergence-observer-core/`
- Emergence baseline scaffold: `emergence-baseline-core/`
- Emergence accumulation scaffold: `emergence-accumulator-core/`
- Emergent protocol discovery scaffold: `emergent-protocol-core/`
- Emergence claim artifact scaffold: `emergence-claim-core/`
- Emergence historical-record scaffold: `emergence-history-core/`
- Internal reward ledger surface: `reward-ledger-core/`
- Speech I/O gateway: `speech-gateway/`
- Runtime execution-truth closure surface: `execution-truth-core/`
- Funded `Cardia` activation surface: `cardia-activation-core/`
- Production/public activation surface: `public-activation-core/`

Current local zero-capital sovereign state:

- the structural zero-capital frontier is complete at the current expected local layer level
- DAO, Keys NFT, Narrative, Dove integration, Gnosis evaluation, Data Rail productization prep, LightVerify commercial certification, and emergent protocol discovery now all exist as locally verified surfaces
- local externalization remains under explicit activation-decision discipline and is still `review`, not activated

- thresholds are met on the current verified local sample (`9` events, `9` actors, `4` actor classes, `5` surfaces, `5` outcomes)
- the rights review queue is resolved with `0` open cases
- externalization readiness is structurally `ready` in local analysis mode
- activation-decision discipline is now implemented, and the current local posture is `review`, not activated
- the next local expansion target is `16` events across `12` actors, including a `gnosis` surface event and a clean `rejected` outcome
- emergence observation is `observable`, longitudinal accumulation is `review_ready` at `5/8` windows, and emergent protocol discovery now has a local pattern-extraction surface
- bounded local emergence claim and history artifacts now exist, but they remain evidence scaffolding only and do not create a live recognition layer or operating-surface authority
- `lightverify-core` now provides a bounded local commercial certification artifact with a binary public `LightVerified` seal, internal scorecard, and no runtime execution authority

These auxiliary artifacts exist in the repo. Their presence does not override canonical status in the MOF.

## Current Capital-Gated Frontier

These surfaces now exist locally, but they are not live-complete:

- live Phase 1a deployment proof completed on 2026-04-18 in `sovereign-monad` and the bootstrap approved source is now registered on Monad mainnet
- `execution-truth-core/` tracks runtime execution-truth closure and currently reports `staged`
- `cardia-activation-core/` tracks funded `Cardia` activation and currently reports `ready_for_funding`
- `public-activation-core/` tracks production/public activation and currently reports `blocked`

Current shared-state summary:

- `phase1aLiveProofRecorded: true`
- `bootstrapSourceRegistered: true`
- `executionTruthStatus: staged`
- `cardiaActivationStatus: ready_for_funding`
- `publicActivationStatus: blocked`

## Funnel Direction

The beginning-of-project funnel should not depend on MonadSpin alone.

Current intended opening posture:

- bootstrap approved-source inflow
- API and licensing revenue
- agent-native revenue from ecosystem-native agents
- MonadSpin high-fidelity DeFi gaming revenue later as an additional rail

The first ecosystem-native agent set is specified as a six-function organ cluster:

- `Cardia` for capital circulation
- `Pneuma` for external exchange
- `Hepar` for opportunity filtering
- `Cortex` for research synthesis
- `Synapse` for signal routing
- `Vox` for narrative expression

Current accepted upgrade tracks:

- Agent 0 should use shadow-paper markout review for the first 50 to 100 would-have trades before any funded authority discussion.
- Monad Matrix should be developed as a High-Fidelity DeFi Gaming / gamified environment rail
- The first six organs should be held to institutional-depth implementation standards, with analysis-mode outputs first and live authority gated later.

See:

- `docs/FUNNEL_DIVERSIFICATION_PLAN.md`
- `docs/AGENT_NATIVE_REVENUE_RAIL.md`
- `docs/FIRST_ORGAN_SET.md`
- `docs/BUILD_EXECUTION_FLOW.md`
- `docs/ECOSYSTEM_UPGRADE_INTEGRATION_STATUS_2026-04-30.md`

## Immediate Post-Deploy Operator Path

Once the live Phase 1a deployment succeeds in `sovereign-monad`, use:

- `docs/POST_PHASE1A_NEXT_STEPS.md`

That document covers:

- post-deploy verification
- bootstrap source registration
- local GameFi source config materialization
- GameFi control stack bring-up
- active package verification

## Legacy Reference Material

- `docker-compose.yml`, `docker-compose.testnet.yml`, and `docker-compose.prod.yml`
- `monad-market-agent`, `eth-market-agent`
- `monad-arb-bot`, `eth-arb-bot`, `bridge-exec-bot`

Do not use those paths as the source of truth for canonical project status.

