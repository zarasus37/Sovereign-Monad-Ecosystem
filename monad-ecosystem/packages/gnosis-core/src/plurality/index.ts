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
