# `@sovereign/shaliah-onboarding`

**Vector 1 — Shaliah Onboarding Arc** (door) **+ Financial Graduation lesson engine** (middle money curriculum) **+ Shaliah office prompt pack**.

Design authority:

- Door: [`docs/SHALIAH_ONBOARDING_ARC.md`](../../../docs/SHALIAH_ONBOARDING_ARC.md)
- FG lessons: [`docs/FG_CURRICULUM.md`](../../../docs/FG_CURRICULUM.md)
- Identity / offices: [`docs/SHALIAH_IDENTITY_V2.md`](../../../docs/SHALIAH_IDENTITY_V2.md)
- Lesson pedagogy: [`docs/Shaliah Agents/Lesson Architecture.md`](../../../docs/Shaliah%20Agents/Lesson%20Architecture.md)

## Modules

| Area | Path | Role |
|------|------|------|
| Phase 1–3 door | `phase1Circuit.ts` / `phase2ShadowMarket.ts` / `phase3Archon.ts` / `arc.ts` | Broken Genesis → Archon → Meshaleach paper graduate |
| Lesson engine | `lessonEngine/` | Orient→model→retrieve→fade→interleave→delay→transfer→mastery |
| FG curriculum | `fg/curriculum.ts` | L1.1–L3.4 definitions |
| FG gates | `fg/gates.ts` | FG-1 / FG-2 / FG-3 batteries + Integrity placeholder sig |
| FG session | `fg/fgSession.ts` | State machine, unlocks, `r` lock / sovereignty |
| Prompts | `prompts/shaliahOffices.ts` | Five offices + FG overlays |

## FG unlocks

| Gate | Unlocks |
|------|---------|
| FG-1 | Claim statement + safe deploy menu |
| FG-2 | High-risk human confirm path |
| FG-3 | User sets \(r \in [0.05,0.30]\) (default was locked 0.20) |

Autopilot high-risk **fails** FG-2. Shaliah **never** sets `r`.

## Run

```powershell
cd monad-ecosystem/packages/shaliah-onboarding
pnpm install
pnpm test
pnpm demo
pnpm demo:fg
pnpm build
```

## Honesty

- Pure TypeScript state machines + scoring. **No** mint, wallet, or live capital.
- Integrity signatures are **local SHA-256 placeholders** until Integrity Auditor wires real attestations.
- Door Phase 3 pass is a **local graduation token**; gate-acl PL wiring remains separate.
- Prompt pack is system-text for LLM bindings — not an online model call.
