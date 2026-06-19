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
- Active code paths are aligned to the current `v2.4.0` operating model.
- The repo moves cleanly from `G:\My Drive\The_Sovereign` to the new canonical OneDrive path.

## What Is Still In Progress

- Further deep cleanup inside legacy pillar content, especially `theo-techno-cosmo/`.
- Remaining runtime hardening in `gnostic-engine/` after the current deprecation warning.
- Deeper end-to-end wiring of `monad-ecosystem/control-center/` to live telemetry and execution surfaces, now focused on producer and watcher integration.
- Any archive-only path or historical note cleanup that does not affect active work.

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
