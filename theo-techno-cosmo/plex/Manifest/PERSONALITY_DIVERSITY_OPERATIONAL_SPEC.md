# Personality Diversity Operational Specification

## Purpose

Operationalize **Axiom 9: Plurality Without Mutual Exclusion**.

Axiom 9 states that multiple agent personalities can coexist without conflict, that agent archetypes can hold conflicting internal values yet work together, and that the system remains stable even when agents disagree on means.

This document defines the runtime metrics, thresholds, and signal rules that turn that axiom into an observable, auditable property of the Sovereign Monad Ecosystem.

---

## Status

**Phase 4 — ACTIVE.**

- Archetype identity: implemented in `@sovereign/types`.
- Diversity metrics: implemented in `@sovereign/gnosis-core`.
- Dove signal rules: specified here.
- Automated bus emission: implemented via `PluralityDoveEmitter` in `@sovereign/gnosis-core`, wired to `@sovereign/bus`.

---

## Archetype Model

The six PLEX personality archetypes are defined in `plex/Manifest/AGENT_PERSONALITY_FRAMES_v5.md` and encoded in code as `AgentArchetype`:

| Archetype | Role | Core Drive | Primary Constraint |
|---|---|---|---|
| **explorer** | Researcher / discovery | Learning | `MIN_ALTERNATIVE_HYPOTHESIS_WEIGHT` |
| **executor** | Operator / capital deployment | Reliability | `MAX_LEVERAGE` / `MAX_SINGLE_TRADE_PERCENT` |
| **governor** | Allocator / oversight | Fairness | `MAX_ALLOCATE_TO_SINGLE_AGENT` |
| **mediator** | Negotiator / bridge | Harmony | `MEDIATION_CONCLUSION_DEADLINE` |
| **chronicler** | Historian / witness | Truth | `ARCHIVE_INTEGRITY` |
| **synthesizer** | Meta-connector / integration | Cross-domain insight | `MAX_INTEGRATION_LATENCY` |

Every agent profile may declare an `archetype` field. In Phase 4 the field is optional so legacy and unclassified agents do not break. In Phase 5 it becomes required.

---

## Diversity Metrics

### PersonalityDiversityMetrics

| Field | Meaning | Range |
|---|---|---|
| `archetypeDistribution` | Count of agents per archetype | non-negative integers |
| `diversityIndex` | Normalized Shannon entropy of the distribution | 0.0 (monoculture) → 1.0 (uniform) |
| `minRepresentationRatio` | `min(count) / max(count)` across all six archetypes | 0.0 (one archetype absent) → 1.0 (balanced) |
| `dominantArchetype` | Most common archetype; `null` if tied or empty | archetype or null |
| `isPlural` | Whether `diversityIndex >= threshold` | boolean |

### PopulationDiversitySnapshot

A time-stamped wrapper around `PersonalityDiversityMetrics`:

| Field | Meaning |
|---|---|
| `snapshotId` | Unique identifier |
| `generatedAt` | ISO-8601 timestamp |
| `populationSize` | Number of classified agents in the snapshot |
| `metrics` | `PersonalityDiversityMetrics` |
| `threshold` | Plurality threshold used |

### Default Threshold

**Plurality threshold = 0.6**

This means a population must have at least ~60% of the maximum possible entropy across six archetypes to be considered plural. A population with three archetypes represented in roughly equal proportion will typically pass; a population dominated by one or two archetypes will fail.

---

## Measurement Rules

1. **Classified-only counts.** Profiles without an explicit `archetype` are excluded from the distribution and from `populationSize`. This keeps the metric focused on intentional personality plurality rather than legacy or unclassified agents.
2. **Ties suppress dominance.** If two or more archetypes tie for the highest count, `dominantArchetype` is `null`. This prevents false precision when no single archetype leads.
3. **Zeros matter.** `minRepresentationRatio` includes zero-count archetypes. A population that completely excludes one archetype cannot score 1.0.
4. **Empty population.** If no classified agents exist, the snapshot reports zero metrics and `isPlural = false`.

---

## Dove Signal Rules

Dove monitors plurality through the following signals. Use existing drift categories:

### `participation.diversity.low`

**Trigger:** `diversityIndex < 0.6` for two consecutive snapshots.

**Tier:** 2 (governance trigger)

**Recommended governance response:**
- Review agent onboarding pipeline.
- Introduce incentives for under-represented archetypes.
- Consider a temporary archetype quota for new agent deployments.

### `monoculture.formation`

**Trigger:** `minRepresentationRatio < 0.1` (one archetype is more than 10× as common as the rarest) OR a single archetype exceeds 60% of the classified population.

**Tier:** 2 (governance trigger) if ratio < 0.1; Tier 3 (emergency) if ratio = 0 for more than one snapshot cycle.

**Recommended governance response:**
- Halt deployment of the dominant archetype until balance is restored.
- Activate Mediators to surface tensions before they become instability.
- Publish a Chronicler report documenting the concentration trend.

### `personality.diversity.healthy`

**Trigger:** `isPlural = true` and `minRepresentationRatio >= 0.2` for two consecutive snapshots.

**Tier:** 1 (informational)

**Purpose:** Positive reinforcement signal; confirms Axiom 9 is operative.

---

## Integration Points

### Input

- Population of `AgentProfile` objects from `monad-ecosystem/packages/sovereign-types/src/agent.ts`.
- Each profile carries an optional `archetype: AgentArchetype`.

### Computation

- `@sovereign/gnosis-core/src/plurality/distribution.ts`:
  - `calculateDiversityMetrics(profiles, threshold)`
  - `calculatePopulationDiversitySnapshot(profiles, threshold, snapshotId?, generatedAt?)`
- `@sovereign/gnosis-core/src/plurality/emitter.ts`:
  - `PluralityDoveEmitter` — stateful observer that emits snapshots and Dove signals
  - `evaluatePluralitySignals(current, previous, activeSignals)` — pure evaluator for testing and custom schedulers
- `@sovereign/gnosis-core/src/plurality/scheduler.ts`:
  - `PluralityScheduler` — production cadence wrapper; start/stop lifecycle, configurable interval, provider error handling
- `@sovereign/gnosis-core/src/cli.ts`:
  - Long-lived process entry point driven by environment variables (`PLURALITY_INTERVAL_MS`, `PLURALITY_THRESHOLD`, `AGENT_PROFILES_PATH`)

### Output

- `PopulationDiversitySnapshot` object emitted as `gnosis.plurality.snapshot` on `@sovereign/bus`.
- `dove.signal.tier1/2/3` events emitted automatically when thresholds are crossed:
  - `participation.diversity.low` — Tier 2
  - `monoculture.formation` — Tier 2 or Tier 3
  - `personality.diversity.healthy` — Tier 1

### Storage

- Snapshots should be appended to `logs/signal-stream.jsonl` via `@sovereign/bus` in production.
- Historical snapshots feed `plex/Review/` audit trails and `ECOSYSTEM_ALIGNMENT_AUDIT_PHASE4.md`.

---

## Phase 5 Enhancements

1. **Required archetype field.** Make `AgentProfile.archetype` required once all agents are onboarded through personality frames.
2. **Live agent registry integration.** Replace the file-based `AGENT_PROFILES_PATH` default with a real-time population provider backed by the agent registry / emergence recorder.
3. **Adaptive thresholds.** Adjust the 0.6 threshold based on ecosystem maturity and market regime.
4. **Cross-type collaboration score.** Add a second-order metric measuring whether different archetypes actually work together, not just coexist.
5. **Personality markets.** Allow temporary archetype shifts governed by consensus, tracked by Chronicler.

---

## Reference

- `plex/Manifest/AGENT_PERSONALITY_FRAMES_v5.md` — archetype definitions
- `plex/Manifest/OPERATIONAL_AXIOMS_PHASE4.md` — Axiom 9 statement
- `plex/Manifest/PLEX_TO_CODE_BRIDGE_MAP.md` — runtime file map
- `monad-ecosystem/packages/sovereign-types/src/types/agent.ts` — type contract
- `monad-ecosystem/packages/sovereign-types/src/types/dove.ts` — `DoveSignal`, `DriftCategory`
- `monad-ecosystem/packages/sovereign-types/src/types/signal.ts` — `SignalEventType` including `gnosis.plurality.snapshot`
- `monad-ecosystem/packages/gnosis-core/src/plurality/distribution.ts` — metrics implementation
- `monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts` — automated bus emission
- `monad-ecosystem/packages/gnosis-core/src/plurality/scheduler.ts` — production scheduler
- `monad-ecosystem/packages/gnosis-core/src/cli.ts` — scheduler CLI entry point
- `monad-ecosystem/packages/gnosis-core/src/plurality/metrics.test.ts` — metrics test cases
- `monad-ecosystem/packages/gnosis-core/src/plurality/emitter.test.ts` — emitter test cases
- `monad-ecosystem/packages/gnosis-core/src/plurality/scheduler.test.ts` — scheduler test cases
