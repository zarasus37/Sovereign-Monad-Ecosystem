/**
 * @sovereign/scheduler — the TTCL Layer 6 Scheduler.
 *
 * A simulated-annealing optimizer over Llull wheel rotations that produces a
 * `canonical_schedule.json` — the default rotation sequence for data
 * generation (the prose's Layer 6, `theo-techno-cosmo/plex/archive/
 * TTCL_v1_0_BREAKDOWN.md:228-271`). The objective is multi-objective:
 *   J = α·Coverage + β·Locality + γ·Tripartite − δ·Cost
 * with spec weights 0.35 / 0.25 / 0.30 / 0.10. The three moves (LocalRotate,
 * PatternSwitch, WheelSwap) are drawn by spec probabilities 0.65 / 0.25 / 0.10;
 * the global constraint "at least one wheel per TTCL facet always active" is
 * enforced by construction.
 *
 * Naming: this is the TTCL/compiler-axis "Layer 6" (the working 9-layer model),
 * distinct from the MOF 15-layer Base Stack and from the unrelated
 * gnosis-core `plurality/scheduler.ts` (a multi-agent scheduler, not a wheel
 * optimizer).
 *
 * Honesty note: the spec names the `pattern` state field + `PatternSwitch`
 * move, the PairTable, the N-step window size, and the per-step Cost but
 * defines no concrete semantics for them beyond `map(f)∘map(g)≡map(f∘g)` and
 * the one-line term glosses. This package concretizes each grounded in the
 * nearest written evidence (the spec's `combineWheels(wA,wB,rule,budget)`
 * pairing-rule signature for `pattern`; the term prose for C/L/T/S), documented
 * in the module comments + the v2.6.4 changelog rather than presented as
 * spec-mandated — the same discipline as the Layer 5 rewrite/attachModality
 * work. The scheduler is data-driven (reads the wheel + pair registry), so the
 * real 45-pair Llull PairTable + Catalan slot labels drop in later as a data
 * change, not a code change.
 */

// Registry (L6 input).
export { loadRegistry, buildRegistry, rotateOffset, type WheelRegistry, type WheelAsset, type Pair, type LetterPair, type LetterPairsConfig, type FourthFigureCamera, type FourthFigureConfig } from "./registry.js";

// State + config + moves.
export {
  initialState,
  ALL_DOMAINS,
  DEFAULT_CONFIG,
  MOVE_PROBABILITIES,
  type ScheduleState,
  type ScheduleConfig,
  type Move,
  type MoveKind,
} from "./state.js";
export {
  proposeMove,
  applyMove,
  constraintHolds,
  compositeKey,
  moveMagnitude,
  moveKind,
  MAX_MOVE_MAGNITUDE,
} from "./moves.js";

// Objective.
export {
  evaluateMove,
  deltaJ,
  locality,
  cost,
  roughness,
  materializationCost,
  compositeDomains,
  tripartite,
  letterPairValidity,
  fourthFigureValidity,
  MAX_ROUGHNESS,
  MIN_COST,
  MAX_COST,
  type ObjectiveTerms,
} from "./objective.js";

// PRNG.
export { mulberry32, makeRng, type Rng } from "./rng.js";

// Anneal + facade.
export {
  anneal,
  DOMAIN_ORDER,
  type ScheduleRun,
  type ScheduleStep,
  type ScheduleBest,
  type CoverageStats,
  type DomainVisits,
} from "./anneal.js";
export {
  generateSchedule,
  assembleSchedule,
  serializeSchedule,
  ARTIFACT_VERSION,
  GENERATOR_ID,
  type CanonicalSchedule,
  type RegistrySnapshot,
} from "./schedule.js";

// Errors.
export { SchedulerError, RegistrySchemaError, RegistryIntegrityError, ScheduleSchemaError } from "./errors.js";