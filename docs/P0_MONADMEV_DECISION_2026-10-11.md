# P0 monad-mev Decision — 2026-10-11

> **Origin:** Concern #8 from the 2026-10-11 review. Initial lean was
> "kill the package" because MEV is dead and `monad-mev-archive/` already
> existed. After a real read of the source tree, README, archive
> boundary, cross-references, and build chain, the picture is different.
>
> **Verdict: REFACTOR + RELABEL, not kill.**

## What I read

- `monad-ecosystem/packages/monad-mev/` — package source tree
- `monad-mev/README.md` (1.9 KB) and `package.json`
- `src/index.ts`, `src/executionEngine.ts` (14 KB),
  `src/capacityCeiling.ts` (9.7 KB),
  `src/loop/{mandateSigner,mandateVerifier,yieldRouter,eip712Mandate,loopBroadcast}.ts`,
  `src/capacityCeilingEmit.ts`, `src/shadowMarkoutGate.ts`,
  `src/capacityCeiling.test.ts` (5.6 KB),
  `src/sovereignLoop.test.ts` (8 KB)
- `python/shadow_markout_api.py` (7.4 KB) and Dockerfile
- `risk-engine/MEV-ENGINE-REFERENCE.md` (208 lines) and `HEARTBEAT.md`
- `monad-ecosystem/legacy/monad-mev-archive/` (empty)
- `monad-ecosystem/docker-compose.yml` (the Azure deployment surface)
- `monad-ecosystem/packages/execution-truth-core/src/evaluator.ts` (consumer)

## What I found

### 1. The package is a **Sovereign Execution Loop library**, not a MEV engine

Despite the name, the package implements:
- `executeGuardedLiveTrade` — a 6-gate pipeline (Mandate verify → Capacity
  ceiling → Shadow markout → Execute → Yield route → Broadcast)
- `signCapitalMandate` — EIP-712 bounded agency with expiry + allocation
- `routeYield` — 50/40/10 BigInt split (Principal / Shaliah treasury /
  Ecosystem vault) — **Axiom 7 of the Charter**
- `CapacityCeilingMonitor` — rolling slippage envelope (C-DENSITY-FLOOR)
- `evaluateShadowMarkout` — fail-closed gate against the Python oracle

The "MEV" label is historical. The actual code is the **bounded-agency
execution primitive** that Charter §3 ("sovereignty as architectural
property") requires. **The Charter calls for this; killing the package
removes a Charter-required organ.**

### 2. The code is real, with real tests

- 9 source files in `src/` and `src/loop/`, total ~50 KB of TypeScript
- 2 test files, ~13.6 KB of vitest assertions
- 4 substantial modules: `executionEngine.ts` (14 K), `capacityCeiling.ts`
  (9.7 K), `yieldRouter.ts` (7 K), `mandateVerifier.ts` (4.5 K)
- Tests exist (`capacityCeiling.test.ts`, `sovereignLoop.test.ts`) —
  **this is the most-tested alpha package in the monorepo**

### 3. The package is wired into Azure deployment

`monad-ecosystem/docker-compose.yml:113-129` deploys the Python oracle
(`python-engine` service) and `risk-engine/HEARTBEAT.md:11` references the
MEV engine. `execution-truth-core/src/evaluator.ts:22-37` validates
closure **on this package specifically**. The Azure deployment is **not
a tombstone** — it is the live sovereignty execution infrastructure.

### 4. The Python "truth oracle" is a placeholder

`python/shadow_markout_api.py:46-117` is a stub. It explicitly says:

```python
# TODO: Wire your existing shadow_markout_hardened.py logic here
```

with simple heuristics (price staleness > 60s, sells > $10k = adverse
selection, trades > $50k = capacity exceeded). The TS code calls this
and the gate **fails closed on HTTP error but accepts the stub's
heuristic verdicts**. The actual risk analytics — whatever
`shadow_markout_hardened.py` was supposed to do — is not in this monorepo.

**This is the real risk, not the package itself.** The TS gate is
production-grade; the oracle it calls is a TODO.

### 5. There is a separate, real, running MEV engine elsewhere

`risk-engine/MEV-ENGINE-REFERENCE.md` describes a 15-service
cross-chain MEV arbitrage engine at `C:\Users\crisc\Dev\agents\monad-mev\`
(outside this monorepo), running 15 Docker containers with Kafka +
ZooKeeper, **Phase 1-3 complete**, backtest verified 100% win rate on
48 trades (+36.48% on $100). This engine **consumes** the
`@sovereign/monad-mev` library from this monorepo as a TypeScript
client.

The relationship: **the engine is the product, the library is the
client.** The library implements the sovereignty primitives (mandate
signing, yield routing, capacity ceiling) the engine calls into.

### 6. The `monad-mev-archive/` directory is a fossil, not an archive

`monad-ecosystem/legacy/monad-mev-archive/` is **empty** (0 files,
0 subdirs). My earlier review described it as containing "56+ archived
MEV bots" — that was wrong. The directory is a path-only placeholder
from a planned freeze that never received any content. The actual
historical MEV work is in the separate `C:\Users\crisc\Dev\agents\monad-mev\`
repo and was never copied here.

### 7. The build chain is broken for local per-package tests

`pnpm --filter @sovereign/monad-mev test` fails with:

```
Failed to resolve entry for package "@sovereign/types" / "@sovereign/bus".
The package may have incorrect main/module/exports specified in its
package.json.
```

Root cause: vitest 5 + workspace resolution requires the
`@sovereign/types` and `@sovereign/bus` `dist/` directories to exist.
The packages declare `main: "./dist/index.js"` in `package.json` but
their `dist/` is not rebuilt on `pnpm install`. **CI handles this via
`pnpm validate` which runs `pnpm build` first** (the chain is
`build → typecheck → test:integration`). But the per-package
`pnpm test` (vitest run) is not the canonical local path; it requires
either a prior `pnpm build` or a vitest alias to `src/`.

This is a **developer-experience bug** (per-package vitest is broken
without a global build), not a correctness bug (CI is green).

### 8. CI is pinned to pnpm 9.6.0 in `.github/workflows/ci.yml`

The hardcoded `pnpm/action-setup@v4` `version: 9.6.0` in `ci.yml`
**overrides the `packageManager: "pnpm@12.11.2"` field in `package.json`**.
We just upgraded the field, but CI will still use 9.6.0 until the
workflow file is updated.

## Verdict: REFACTOR + RELABEL

### What to do

1. **Rename `@sovereign/monad-mev` → `@sovereign/loop`** (or
   `sovereign-execution-loop`). The new name matches what the code
   actually does. The "MEV" name is misleading and creates
   fake-sovereignty risk (caller assumes MEV engine, gets bounded-agency
   primitives).
2. **Replace the Python oracle stub.** Either:
   - Port `shadow_markout_hardened.py` from the external MEV engine
     into `monad-ecosystem/packages/loop/python/` (preferred — keeps
     one canonical oracle), OR
   - Pin the oracle to a deliberate mock and document that the
     **TS gate is production-grade, the oracle is not**.
3. **Remove `monad-ecosystem/legacy/monad-mev-archive/`.** It's a
   fossil. If we want a record of the historical MEV engine, add a
   `docs/MONOREPO-VS-EXTERNAL-MEV-ENGINE.md` that documents the
   relationship: **the library is in this repo, the engine is at
   `C:\Users\crisc\Dev\agents\monad-mev\`, the engine consumes the
   library.**
4. **Fix per-package vitest resolution.** Two options:
   - Add `resolve.alias` to each package's `vitest.config.ts` mapping
     `@sovereign/types` → `../sovereign-types/src` and similarly for
     bus (preferred — no build-step required), OR
   - Add a `pretest` script that runs `pnpm --filter ... build` on
     the workspace's dependency closure.
5. **Update CI workflow.** Change `pnpm/action-setup@v4` `version:
   9.6.0` to either drop the hardcoded version (let `packageManager`
   field drive) or set to `12.11.2`. Without this, CI continues
   running on pnpm 9.6.0 while the rest of the repo moves to 12.
6. **Promote status in `LIVE_PACKAGES.md`** from `alpha` to
   `alpha → graduate by 2027-01-06` (matching the high-priority
   deadline for the other Charter-§3 organs).

### What NOT to do

- **Do not kill the package.** It is the bounded-agency execution
  primitive the Charter requires. Killing it would force a rewrite
  of the same code under a different name later.
- **Do not delete the empty `monad-mev-archive/` until #3 is decided.**
  The rename + the archive removal should be one PR to avoid
  merge conflicts.
- **Do not assume the external engine at
  `C:\Users\crisc\Dev\agents\monad-mev\` is part of this monorepo.**
  It is not. Cross-repo refactors belong in a separate plan.

## Execution sequence

1. **Today (this PR):** add `@sovereign/loop` as the new name and
   keep `monad-mev` as a deprecated re-export shim for one release.
   Update `LIVE_PACKAGES.md`. Document the external engine in
   `docs/MONOREPO-VS-EXTERNAL-MEV-ENGINE.md`. Fix the per-package
   vitest alias issue. Update CI pnpm version.
2. **Next:** remove the `monad-mev` shim and the empty
   `monad-mev-archive/` directory.
3. **By 2027-01-06:** replace the Python oracle stub (port from
   external engine or pin to documented mock).

## Sign-off

Per Charter §3.1, package rename + archive removal + status promotion
require Steward Council review. This doc is the decision record; the
PR is the operational change.

— Mavis (2026-10-11)
