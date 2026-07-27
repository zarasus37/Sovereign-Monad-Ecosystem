# `@sovereign/shaliah-onboarding`

**Vector 1 — Mutual Knowing & Communication Genesis** (primary).

Authority:

- [`docs/VECTOR1_ONBOARDING_REDESIGN.md`](../../../docs/VECTOR1_ONBOARDING_REDESIGN.md)
- [`docs/SHALIAH_IDENTITY_V2.md`](../../../docs/SHALIAH_IDENTITY_V2.md)
- FG middle track: [`docs/FG_CURRICULUM.md`](../../../docs/FG_CURRICULUM.md)

## Primary door (current)

| Phase | Module | What it trains |
|-------|--------|----------------|
| **0 Foundation** | `phase0Foundation.ts` | NEO Big Five + SD3 (+ optional natal) → impartation hash |
| **A Channel Awakening** | `phaseAChannel.ts` | Command literacy; dual-loop human↔agent; repair failed formulations |
| **B Read the Mind That Acted** | `phaseBReadMind.ts` | Reconstruct *why* the agent acted — **not** approve/stop trades |
| **C Covenant Fluency** | `phaseCCovenant.ts` | Principal will under temptation + process restate |

Orchestration: `arc.ts` (`startArc` → `completeArcFoundation` → channel repairs → reconstruction → covenant → `graduated`).

## Also in this package

| Area | Path |
|------|------|
| Lesson engine | `lessonEngine/` |
| FG-1…3 curriculum / gates | `fg/` |
| Shaliah office prompts | `prompts/` |
| **Legacy** circuit / shadow / Archon | `phase1Circuit.ts`, `phase2ShadowMarket.ts`, `phase3Archon.ts` via `legacy` export — **deprecated** |

## Run

```powershell
cd monad-ecosystem/packages/shaliah-onboarding
pnpm test
pnpm demo
pnpm demo:fg
pnpm build
```

## Honesty

- Domain logic only (no mint / live capital UI).
- Psychometric scores are structured placeholders until real instruments wire in; **hash + flow are load-bearing**.
- Legacy puzzle tests still exist for transitional code; primary `arc.test.ts` covers the new path.
