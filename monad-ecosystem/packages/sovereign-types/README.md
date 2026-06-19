# @sovereign/types

**Canonical type contract for the Sovereign Monad Ecosystem.**

This is the single source of truth for all cross-layer data shapes in the monorepo.
Every TypeScript package imports from here. No package invents its own type for a
shared concept.

---

## What Is In Here

| Module | Type(s) | Purpose |
|---|---|---|
| `signal` | `SignalEvent`, `SignalLayer`, `SignalEventType` | Canonical bus event envelope |
| `agent` | `AgentProfile`, `BigFiveVector`, `RiskEnvelope` | Agent personality + operational envelope |
| `gnosis` | `GnosisScore`, `StokesCoherenceVector`, `PulfrichParallax` | Volumetric 4D integrity engine output |
| `dove` | `DoveSignal`, `DoveHealthReport`, `DriftCategory` | Conscience protocol output |
| `hepar` | `HeparAuditResult`, `HeparFinding`, `HeparAuditScore` | DeFi audit organ output |
| `oracle` | `OracleRegime`, `OraclePosture`, `KellySizing`, `MonteCarloSummary` | Risk Gnosis Engine output |
| `revenue` | `RevenueEvent`, `RevenueDistribution`, `TreasurySnapshot` | Revenue routing events |
| `emergence` | `EmergencePattern`, `PatternEvidence`, `EmergenceAccumulatorState` | Emergent protocol system |

---

## Usage

```typescript
import type {
  SignalEvent,
  GnosisScore,
  DoveSignal,
  HeparAuditResult,
  AgentProfile,
} from '@sovereign/types';
```

All exports are type-only (`export type`). This package has zero runtime code and
zero dependencies — it is a pure type contract.

---

## Design Rules

1. **No runtime code** — types and interfaces only. No classes, no functions, no constants.
2. **No `any`** — strict TypeScript throughout.
3. **All fields `readonly`** — types represent immutable data records.
4. **Fully documented** — every field has a JSDoc comment explaining its meaning and range.
5. **Aligned to MOF** — every type is traceable to a section of the Master Operating File.

---

## Build

```powershell
pnpm build       # Compiles to dist/
pnpm typecheck   # Type-checks without emitting
```

Output goes to `dist/`. Import consumers reference `dist/index.js`.
