# Canonical Sync Discipline

This document explains how to keep the unified workspace clean and stable.

## Principles

- Keep one canonical root.
- Keep active pillars distinct from archive material.
- Prefer repo-relative paths over absolute drive paths.
- Do not reintroduce legacy workspace names into active files.

## Sync Order

1. Update the canonical docs first.
2. Update root navigation docs.
3. Update active pillar docs and scripts.
4. Archive old material instead of leaving it mixed into active surfaces.

## Validation

- Run `pnpm check:layout` after structural edits. The script degrades gracefully when `ripgrep` (`rg`) is not installed: the legacy-path scan is skipped with a warning and the top-level layout guard still runs.
- Keep archive material self-describing as archive material.
- Treat generated exports as historical artifacts unless they are promoted into active work.

