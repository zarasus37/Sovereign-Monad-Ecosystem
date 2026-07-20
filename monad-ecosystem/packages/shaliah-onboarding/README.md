# `@sovereign/shaliah-onboarding`

**Vector 1 — Shaliah Onboarding Arc** (domain logic, not the final UI).

Design authority: [`docs/SHALIAH_ONBOARDING_ARC.md`](../../../docs/SHALIAH_ONBOARDING_ARC.md) · `docs/SHALIAH_AGENTS.md` §6.2

## Phases

| Phase | Module | Stealth goal |
|-------|--------|--------------|
| 1 Broken Genesis | `phase1Circuit.ts` | Bond + method imprint (HCD-3/4) |
| 2 Quarantine | `phase2ShadowMarket.ts` | Refusal literacy (HCD-1/2/5) |
| 3 Comprehension | `phase3Archon.ts` | Structured covenant refusal → Meshaleach |

## Run

```powershell
cd monad-ecosystem/packages/shaliah-onboarding
pnpm install
pnpm test
pnpm demo
pnpm build
```

## Honesty

- Pure TypeScript state machines + scoring. **No** mint, wallet, or live capital.
- Phase 3 pass is a **local graduation token**; wiring to `@sovereign/gate-acl` PL events is V1.3.
- UI (circuit board / market / terminal) is Control Center follow-up (V1.4+).
