# STATUS

## Project

Sovereign Monad Ecosystem local implementation workspace in `monad-mev`.

This repo is a build-and-verification surface for the broader Sovereign Monad program. Canonical doctrine, build order, and blocker truth live in the mirrored MOF/build-map docs and in the canonical `sovereign-monad` repo.

The canonical resume point for this unified workspace is `docs/PROJECT_STATE.md` at the root of `The_Sovereign`.

## Current Read

- Local package surface is broad and mostly scaffold-complete at the current zero-capital expected level.
- Live Phase 1a deployment proof is complete and the bootstrap approved source is registered on Monad mainnet.
- Canonical mirrors have been updated to reflect the current emergence and LightVerify implementation state.
- `lightverify-core` exists as a bounded commercial certification artifact.
- `emergence-claim-core` and `emergence-history-core` exist as bounded evidence artifacts.
- Agent 0, High-Fidelity DeFi Gaming, and the six-organ institutional-depth upgrades are accepted ecosystem tracks now being finalized at specification level.
- These artifacts do not create live runtime authority, downstream governance authority, or public activation.

## Current Working Objective

Keep the Sovereign Monad ecosystem implementation, canonical mirrors, and local package surfaces synchronized while preserving the doctrine boundary:

- local build completion is not live completion
- runtime execution truth, funded `Cardia`, and public activation remain downstream of the completed Phase 1a live proof
- emergence and LightVerify stay bounded to their documented scope

## Immediate Priorities

1. Use the MOF and build map as the first read for any ecosystem-level decision.
2. Keep `lightverify-core`, `emergence-claim-core`, and `emergence-history-core` aligned with docs and state surfaces.
3. Finalize the Agent 0 shadow-paper markout rules, High-Fidelity DeFi Gaming spec, and six-organ institutional-depth calibrations before granting any live authority.
4. Preserve mirror sync discipline between `monad-mev` docs and canonical `sovereign-monad`.
5. Treat `monad-mev` as the implementation workspace and `sovereign-monad` as canonical status truth.

## Current Constraints

- `monad-mev` is a dirty worktree with intentional local changes and untracked package directories.
- `monad-mev` does not currently have a configured git `origin` remote.
- The presence of packages in this repo is not evidence of live deployment or production readiness.

## Standard Verification

Primary verification command:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-active-packages.ps1
```

Mirror resync command:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-canonical-mirrors.ps1
```

## Notes For Codex

- Read `AGENTS.md` first.
- For ecosystem truth, read `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md` and `docs/ECOSYSTEM_BUILD_MAP.md` before making broad claims.
- Do not infer live status from local scaffolds alone.

<!-- AUTO-STATUS:START -->
Generated: 2026-05-07 19:29:12 UTC

### Live Containers

No mainnet containers detected.

### Active Runtime Gates

```env
MIN_SPREAD_BPS=3
MIN_LIQUIDITY_10BPS_USD=750
MIN_CAPACITY_USD=3000
MIN_SIZE_USD=250
RISK_FIXED_COST_BPS=8
RISK_MIN_EFFECTIVE_SPREAD_BPS=12
DRY_RUN=false
MAX_SINGLE_TRADE_PERCENT=10
MAX_BRIDGE_EXPOSURE_PERCENT=25
MAX_SLIPPAGE_BPS=50
```
<!-- AUTO-STATUS:END -->










































