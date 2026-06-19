# Project State

This is the canonical resume point for the Sovereign Monad ecosystem.

If you are picking up work in a fresh session, read this file first after `README.md` and `docs/OPEN_FIRST.md`.

## Canonical Source

- Root workspace: `C:\Users\crisc\OneDrive - Southern Careers Institute\My Drive\The_Sovereign`
- Authority chain:
  1. `README.md`
  2. `docs/OPEN_FIRST.md`
  3. `docs/PROJECT_STATE.md`
  4. `docs/REPO_STRUCTURE_MAP.md`
  5. `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.4.0.md`

## Current Snapshot

- The repo is structurally clean and organized into three active pillars:
  - `theo-techno-cosmo/`
  - `gnostic-engine/`
  - `monad-ecosystem/`
- The archive is separated under `archive/`.
- The root contract, build scripts, and layout guard are in place.
- The workspace currently validates successfully with `pnpm check:layout`, `pnpm build`, `pnpm test`, and `pnpm lint`.
- The control-center frontend typecheck and frontend build now pass on a clean rerun under pnpm.
- The control-center workspace build approval is normalized in its `pnpm-workspace.yaml`, and the frontend build script now uses a Windows-safe Node copy step.
- The control-center backend now exposes live ingestion methods for agent status updates and Kafka/event-bus signals.

## What Is Done

- Root docs now define the unified structure.
- Pillar-level READMEs are standardized.
- The `sovereign-types` package has been established as the single source of truth for telemetry, signals, and ecosystem data.
- The `sovereign-bus` is fully implemented as an event backbone and connected to `hepar-core`, `gnosis-evaluator`, `risk-engine`, and `data-rail-core`.
- The `gnostic-engine` now emits a live SSE feed (`/api/v1/gnosis/stream`) connecting directly to the frontend `control-center` React app.
- All core ecosystem packages have been populated, strictly typed, and built without error.
- Vitest integration testing suite is running and passing across all bus signal paths (Dove, Gnosis, Hepar, Data Rail).
- The repo moves cleanly from `G:\My Drive\The_Sovereign` to the new canonical OneDrive path.

## What Is Still In Progress

- Further deep cleanup inside legacy pillar content, especially `theo-techno-cosmo/`.
- Hardening the Kafka bridge (currently running in local pure-node mode).
- Deepening UI interactions in `control-center/` beyond read-only telemetry.

## Next Actions

1. Continue normal development from the relevant pillar.
2. Keep active work inside the approved pillar directories only.
3. Update this file whenever the project state changes in a meaningful way.
4. Run `pnpm check:layout` after structural changes.

## Resume Rule

If a future session only has time to read one project file after the root README, it should read this file.

## Fast Resume

From the repo root, run:

```powershell
pnpm status
```
