# P0 organs/ Resolution — 2026-10-13

> **Origin:** Concern from the 2026-10-11 stub walk audit. The audit's
> shallow scan said "investigate" — this is the full investigation +
> the resolution. The audit doc has been updated to point here.
>
> **Verdict: 1 promote, 2 archive, 1 keep-as-scaffold.**

## What `organs/` actually contains

The 2026-10-11 audit's verdict of "17 src files, no `tsconfig.json`,
no README, no `dist/`" was based on a shallow scan. The full
investigation surfaced four sub-packages with very different status:

| Sub-package | Real? | Sub | Verdict |
|---|---|---|---|
| `organs/cardia/cardia-activation-core/` | **Yes** | 11 src / 4 test / README / config | **Promote** |
| `organs/execution-truth-core/` | No (3-line stub) | duplicate of `packages/execution-truth-core/` (real alpha) | **Archive** |
| `organs/organ-runtime/` | No (22-line stub) | duplicate of archived top-level `organ-runtime/` | **Archive** |
| `organs/pneuma/public-activation-core/` | Intentionally scaffold-only | per `pnpm-workspace.yaml` comment | **Keep as-is** |

## `cardia-activation-core` — promote

`@sovereign/cardia-activation-core` is a **substantial, real
implementation of the Cardia funding engine** (UMS Vector 3.3). It is
**not** a duplicate of `@sovereign/cardia-funding-stream` — the two
are complementary layers:

- `cardia-activation-core` = the engine: Hepar-gated audit, Redis-locked
  nonces, PL-tracked ledger consumer, ERC-20 `transfer` from Bootstrap
  Source after Hepar `PASS`. **The thing that draws the funds.**
- `cardia-funding-stream` = the bridge: Express SSE router that
  reports funding status to the UI. **The thing that reports the
  status.**

The activation core is mounted in `pnpm-workspace.yaml`, builds
cleanly via `pnpm build`, and has full Hepar integration, redis nonce
manager, PL consumer, and bootstrap. It was placed under `organs/`
during the P0-P11 wiring batch (`40ff70a`) as a parallel
implementation that was never wired to the consumer surface. None of
its symbols are imported anywhere in the active codebase.

**Promoted to `LIVE_PACKAGES.md`** as `alpha → graduate by 2027-01-06`.
The "real" question is whether it should be wired into
`sovereign-host` (currently the host only depends on
`cardia-funding-stream` for SSE). That's a follow-up scope, not this
PR.

## `organs/execution-truth-core/` — archive

3-line stub:
```ts
export interface ExecutionTruthSnapshot { ... }
export function loadLocalExecutionTruthSnapshot(_packageRoot: string): ExecutionTruthSnapshot {
  return { status: 'staged', phase1aLiveProofRecorded: true, bootstrapSourceRegistered: true };
}
```

This is a stub duplicate of the real `packages/execution-truth-core/`
(which has 1968-byte `evaluator.ts` + 1233-byte `index.ts` and is
listed in `LIVE_PACKAGES.md` as `alpha → graduate by 2027-01-06`).
The organs version returns hardcoded values and is imported by
nothing.

**Archived** to `monad-ecosystem/legacy/stub-2026-10-11/organs-execution-truth-core/`
(git mv; history preserved).

## `organs/organ-runtime/` — archive

22-line stub:
```ts
export interface OrganRuntimeConfig { ... }
export interface OrganRuntimeSnapshot { ... }
export function buildRuntimeSnapshot(config: OrganRuntimeConfig): OrganRuntimeSnapshot { ... }
```

This is a stub duplicate of the top-level `packages/organ-runtime/`
which was archived on 2026-10-11 to
`legacy/stub-2026-10-11/organ-runtime/`. The organs version has more
shape (the `buildRuntimeSnapshot` function), but is still a stub
returning config-derived values. Imported by nothing.

**Archived** to `monad-ecosystem/legacy/stub-2026-10-11/organs-organ-runtime/`
(git mv; history preserved).

## `organs/pneuma/public-activation-core/` — keep as-is

The `pnpm-workspace.yaml` carries an explicit comment:
> `public-activation-core` is intentionally scaffold-only (README +
> package.json); it has no `src/` or `tsconfig.json` and is excluded
> from the build approval list.

And the build command in `package.json`:
> `"test": "echo 'scaffold-only package: no tests yet' && exit 0"`

**Keep as-is.** This is the intentionally-empty surface described in
the original stub walk audit. No action.

## Summary

| Verdict | Count | Files |
|---|---|---|
| Promote to LIVE_PACKAGES | 1 | `organs/cardia/cardia-activation-core` (alpha → 2027-01-06) |
| Archive | 2 | `organs/execution-truth-core`, `organs/organ-runtime` |
| Keep as-is | 1 | `organs/pneuma/public-activation-core` |

Total in `organs/` after this PR: 2 sub-packages (cardia + pneuma).
The 2 archived packages are in `legacy/stub-2026-10-11/` with the
original 13 from the prior batch.

## Verification

- `pnpm check:layout` — green
- `pnpm build` — all 32 packages build (cardia-activation-core compiles
  in 4.5s; the 2 archived packages are excluded from the workspace
  glob via directory removal)
- `pnpm typecheck` — 32 of 33 projects (shim is the no-op)
- `pnpm test:integration` — 256/256 in 17 files (no test regressions)
- `pnpm walk:meshaleach` — end-to-end green (Phase 2 halts 3, PL 50,
  bind enabled: true)

## Follow-up scope (not this PR)

The `cardia-activation-core` engine is **not yet wired** into
`sovereign-host`. The host currently depends on
`cardia-funding-stream` for SSE only. Wiring the engine to the
host is a separate scope — and is the kind of "real money" change that
should be a deliberate Steward Council review before `CARDIA_FUNDING_LIVE=true`.

— Mavis (2026-10-13)
