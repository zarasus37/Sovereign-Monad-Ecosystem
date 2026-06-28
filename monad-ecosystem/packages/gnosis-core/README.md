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
pnpm start           # run the production plurality scheduler
pnpm run dev:run     # run scheduler in development (ts-node)
```

### Docker

```bash
# Build and run the scheduler container
docker build -t sovereign-gnosis-core -f monad-ecosystem/packages/gnosis-core/Dockerfile .
docker run -e AGENT_PROFILES_PATH=/data/classified-agents.json -v $(pwd)/data:/data sovereign-gnosis-core
```

### Production scheduler CLI

`pnpm start` runs a long-lived process that periodically observes agent population diversity and emits Dove signals:

```bash
# Run every 15 minutes (default)
pnpm start

# Custom cadence and threshold
PLURALITY_INTERVAL_MS=300000 PLURALITY_THRESHOLD=0.7 pnpm start

# Load agent profiles from disk
AGENT_PROFILES_PATH=./data/classified-agents.json pnpm start
```

Environment variables:

| Variable | Default | Description |
|---|---|---|
| `PLURALITY_INTERVAL_MS` | `900000` (15 min) | Observation cadence in milliseconds |
| `PLURALITY_THRESHOLD` | `0.6` | Plurality threshold for `isPlural` |
| `PLURALITY_SOURCE` | `gnosis-core-plurality` | Source identifier on emitted events |
| `AGENT_PROFILES_PATH` | — | Optional JSON file path containing `AgentProfile[]` |

To integrate with a live agent registry, import `PluralityScheduler` and pass a custom `provider`:

```typescript
import { PluralityScheduler } from '@sovereign/gnosis-core';
import { sovereignBus } from '@sovereign/bus';

const scheduler = new PluralityScheduler({
  bus: sovereignBus,
  provider: () => agentRegistry.getClassifiedProfiles(),
  intervalMs: 15 * 60 * 1000,
});

scheduler.start();
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

#### Automated Dove emission

`PluralityDoveEmitter` wires the snapshot into `@sovereign/bus` so Dove signals fire automatically when thresholds are crossed:

```typescript
import { PluralityDoveEmitter } from '@sovereign/gnosis-core';
import { EventBus } from '@sovereign/bus';

const bus = new EventBus({ source: 'gnosis-core-plurality' });
const emitter = new PluralityDoveEmitter({ bus });

// Emits `gnosis.plurality.snapshot` and any applicable `dove.signal.tier*` events.
emitter.observe(profiles);
```

Signals (per `PERSONALITY_DIVERSITY_OPERATIONAL_SPEC.md`):

| Signal | Tier | Trigger |
|---|---|---|
| `personality.diversity.healthy` | 1 | `isPlural = true` and `minRepresentationRatio >= 0.2` for two consecutive snapshots |
| `participation.diversity.low` | 2 | `diversityIndex < 0.6` for two consecutive snapshots |
| `monoculture.formation` | 2 | `minRepresentationRatio < 0.1` or a single archetype exceeds 60% of the population |
| `monoculture.formation` | 3 | `minRepresentationRatio = 0` for two consecutive snapshots |

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
