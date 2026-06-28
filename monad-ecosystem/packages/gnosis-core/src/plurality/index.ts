/**
 * Personality plurality module.
 *
 * Operationalizes Axiom 9 (Plurality Without Mutual Exclusion) by measuring
 * archetype diversity across an agent population.
 */

export {
  calculateArchetypeDistribution,
  shannonEntropy,
  normalizedShannonEntropy,
  calculateDiversityMetrics,
  calculatePopulationDiversitySnapshot,
} from './distribution.js';

export {
  PluralityDoveEmitter,
  evaluatePluralitySignals,
  type PluralityDoveEmitterConfig,
  type ActiveSignalState,
  type PluralitySignalEvaluation,
} from './emitter.js';

export {
  PluralityScheduler,
  type PopulationProvider,
  type PluralitySchedulerConfig,
} from './scheduler.js';
