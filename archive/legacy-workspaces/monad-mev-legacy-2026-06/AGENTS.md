# Sovereign Monad Ecosystem Workspace Guide

## Project Identity

This repository is a local implementation workspace for the Sovereign Monad Ecosystem.

Treat `monad-mev` as a build-and-verification surface inside the broader Sovereign Monad program, not as the sole source of truth for phase status, live deployment status, or doctrine.

## Canonical Sources

When a task concerns ecosystem status, architecture, build order, doctrine, or blockers, synchronize to these files first:

1. `docs/SOVEREIGN_MONAD_ECOSYSTEM_MASTER_OPERATING_FILE_v2.5.2.md`
2. `docs/ECOSYSTEM_BUILD_MAP.md`
3. `docs/BUILD_EXECUTION_FLOW.md`
4. `docs/CANONICAL_SYNC_DISCIPLINE.md`

Canonical maintenance for those mirrors lives in the separate local repo:

- `C:\Users\crisc\Dev\agents\sovereign-monad`

If mirrored docs in this repo ever conflict with the canonical `sovereign-monad` copies, the `sovereign-monad` copies win and this repo should be resynced.

## Repo Interpretation Rules

- Do not infer live or production status from the presence of packages alone.
- Distinguish local build completion from live deployment completion.
- Treat capital-gated surfaces as blocked unless the canonical MOF explicitly says otherwise.
- Keep emergence, LightVerify, and downstream integrity artifacts bounded to their documented scope. Do not invent live authority that the docs do not grant.

## Current Working Posture

- This repo contains many locally verified scaffolds and package surfaces.
- Canonical ecosystem status and active frontier still live in the MOF and build map.
- `lightverify-core`, `emergence-claim-core`, and `emergence-history-core` are evidence/commercial scaffolds. They do not imply a live recognition layer or runtime authority.

## Standard Verification Flow

When changes touch active packages or ecosystem state surfaces, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\verify-active-packages.ps1
```

When changes affect mirrored canonical docs, resync with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-canonical-mirrors.ps1
```

## Working Defaults

- Prefer `rg` / `rg --files` for search.
- Preserve user changes in the dirty worktree; do not revert unrelated edits.
- Prefer small, bounded edits that keep canonical docs, repo mirrors, and code surfaces aligned.
- If a task references the Sovereign Monad Ecosystem broadly, orient from the MOF before making implementation claims.
