# gnosis-core

`@sovereign/gnosis-core` is the local, retrospective-only Gnosis integrity scaffold for the Sovereign Monad ecosystem.

It evaluates:

- decompression consistency
- hollow-convergence risk
- boundary stress
- integrity review pressure
- **personality plurality (Axiom 9)**

It consumes verified local posture from the existing analysis-mode packages. It does not preempt behavior and it does not impose predictive surveillance.

## Commands

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm run test
```

## Modules

### `plurality/`

Operationalizes **Axiom 9: Plurality Without Mutual Exclusion**.

Given a population of `AgentProfile` objects, it computes:

- `archetypeDistribution` — count per PLEX archetype
- `diversityIndex` — normalized Shannon entropy (0.0 = monoculture, 1.0 = uniform)
- `minRepresentationRatio` — smallest archetype count / largest archetype count
- `dominantArchetype` — the most common archetype
- `isPlural` — whether diversity meets the configured threshold

```typescript
import { calculatePopulationDiversitySnapshot } from '@sovereign/gnosis-core';
import type { AgentProfile } from '@sovereign/types';

const profiles: AgentProfile[] = [ /* ... */ ];
const snapshot = calculatePopulationDiversitySnapshot(profiles, 0.6);

console.log(snapshot.metrics.diversityIndex);
console.log(snapshot.metrics.isPlural);
```

Reference: `theo-techno-cosmo/plex/Manifest/PERSONALITY_DIVERSITY_OPERATIONAL_SPEC.md`

## Runtime truth

This package is:

- local
- analysis-only
- retrospective-only

It does not:

- claim live Gnosis maturity
- override Dove or hard runtime boundaries
- predictively constrain agent behavior before action
