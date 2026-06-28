/**
 * Personality plurality distribution utilities.
 *
 * Computes archetype diversity across a population of agents using
 * Shannon entropy normalized by the number of possible archetypes.
 *
 * Reference: plex/Manifest/PERSONALITY_DIVERSITY_OPERATIONAL_SPEC.md
 */

import { randomUUID } from 'node:crypto';

import type {
  AgentArchetype,
  AgentProfile,
  PersonalityDiversityMetrics,
  PopulationDiversitySnapshot,
} from '@sovereign/types';

const ALL_ARCHETYPES: readonly AgentArchetype[] = [
  'explorer',
  'executor',
  'governor',
  'mediator',
  'chronicler',
  'synthesizer',
];

const DEFAULT_PLURALITY_THRESHOLD = 0.6;

function createEmptyDistribution(): Record<AgentArchetype, number> {
  const distribution: Partial<Record<AgentArchetype, number>> = {};
  for (const archetype of ALL_ARCHETYPES) {
    distribution[archetype] = 0;
  }
  return distribution as Record<AgentArchetype, number>;
}

/**
 * Count agents per archetype.
 * Profiles without an explicit archetype are omitted from the distribution
 * and from the population size. This keeps the metric focused on intentional
 * personality plurality rather than legacy or unclassified agents.
 */
export function calculateArchetypeDistribution(
  profiles: readonly AgentProfile[]
): Record<AgentArchetype, number> {
  const distribution = createEmptyDistribution();

  for (const profile of profiles) {
    const archetype = profile.archetype;
    if (archetype) {
      distribution[archetype] += 1;
    }
  }

  return distribution;
}

/**
 * Shannon entropy of an archetype distribution.
 * Returns 0 when all mass is concentrated in one archetype.
 * Maximum entropy is ln(archetypeCount) for a uniform distribution.
 */
export function shannonEntropy(
  distribution: Readonly<Record<AgentArchetype, number>>
): number {
  const counts = Object.values(distribution);
  const total = counts.reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return 0;
  }

  let entropy = 0;
  for (const count of counts) {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log(probability);
    }
  }

  return entropy;
}

/**
 * Normalize Shannon entropy to a 0.0–1.0 scale.
 * @param entropy raw Shannon entropy
 * @param archetypeCount number of possible archetypes
 */
export function normalizedShannonEntropy(
  entropy: number,
  archetypeCount: number
): number {
  if (archetypeCount <= 1) {
    return 0;
  }
  const maxEntropy = Math.log(archetypeCount);
  return Math.min(1, Math.max(0, entropy / maxEntropy));
}

/**
 * Compute the full personality diversity metrics for a population.
 * @param profiles agent profiles to evaluate
 * @param threshold plurality threshold for isPlural (default 0.6)
 */
export function calculateDiversityMetrics(
  profiles: readonly AgentProfile[],
  threshold: number = DEFAULT_PLURALITY_THRESHOLD
): PersonalityDiversityMetrics {
  const distribution = calculateArchetypeDistribution(profiles);
  const counts = Object.values(distribution);
  const populationSize = counts.reduce((sum, count) => sum + count, 0);

  if (populationSize === 0) {
    return {
      archetypeDistribution: distribution,
      diversityIndex: 0,
      minRepresentationRatio: 0,
      dominantArchetype: null,
      isPlural: false,
    };
  }

  const entropy = shannonEntropy(distribution);
  const diversityIndex = normalizedShannonEntropy(
    entropy,
    ALL_ARCHETYPES.length
  );

  const maxCount = Math.max(...counts);
  const minCount = Math.min(...counts);
  const minRepresentationRatio =
    maxCount === 0 ? 0 : minCount / maxCount;

  let dominantArchetype: AgentArchetype | null = null;
  let dominantCount = -1;
  let tie = false;
  for (const archetype of ALL_ARCHETYPES) {
    const count = distribution[archetype];
    if (count > dominantCount) {
      dominantCount = count;
      dominantArchetype = archetype;
      tie = false;
    } else if (count === dominantCount && count > 0) {
      tie = true;
    }
  }

  if (tie) {
    dominantArchetype = null;
  }

  return {
    archetypeDistribution: distribution,
    diversityIndex,
    minRepresentationRatio,
    dominantArchetype,
    isPlural: diversityIndex >= threshold,
  };
}

/**
 * Wrap diversity metrics in a time-stamped population snapshot.
 * @param profiles agent profiles to evaluate
 * @param threshold plurality threshold for isPlural (default 0.6)
 * @param snapshotId optional snapshot identifier; generated if omitted
 * @param generatedAt optional ISO-8601 timestamp; current time if omitted
 */
export function calculatePopulationDiversitySnapshot(
  profiles: readonly AgentProfile[],
  threshold: number = DEFAULT_PLURALITY_THRESHOLD,
  snapshotId?: string,
  generatedAt?: string
): PopulationDiversitySnapshot {
  const metrics = calculateDiversityMetrics(profiles, threshold);
  const distributionCounts = Object.values(metrics.archetypeDistribution);
  const populationSize = distributionCounts.reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    snapshotId: snapshotId ?? randomUUID(),
    generatedAt: generatedAt ?? new Date().toISOString(),
    populationSize,
    metrics,
    threshold,
  };
}
