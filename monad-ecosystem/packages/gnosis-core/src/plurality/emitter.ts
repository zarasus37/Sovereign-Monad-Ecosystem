/**
 * Plurality Dove Emitter
 *
 * Wires `gnosis-core` plurality snapshots into `@sovereign/bus` so Dove can
 * automatically fire `participation.diversity.low`, `monoculture.formation`,
 * and `personality.diversity.healthy` signals when Axiom 9 thresholds are
 * crossed.
 *
 * Reference: plex/Manifest/PERSONALITY_DIVERSITY_OPERATIONAL_SPEC.md
 */

import { randomUUID } from 'node:crypto';
import type {
  AgentProfile,
  DoveSignal,
  DoveTier,
  DriftCategory,
  EventTrace,
  PopulationDiversitySnapshot,
} from '@sovereign/types';
import { EventBus } from '@sovereign/bus';

import { calculatePopulationDiversitySnapshot } from './distribution.js';

/** Configuration for the stateful emitter. */
export interface PluralityDoveEmitterConfig {
  /** EventBus instance used for emission. */
  readonly bus: EventBus;

  /** Plurality threshold for `isPlural` (default 0.6). */
  readonly threshold?: number;

  /** Source identifier used in emitted events (default `gnosis-core-plurality`). */
  readonly source?: string;
}

/** Internal state of an active Dove signal to suppress duplicate emissions. */
export interface ActiveSignalState {
  readonly tier: DoveTier;
  readonly driftCategory: DriftCategory;
  readonly snapshotId: string;
}

/** Result of evaluating a snapshot against the previous snapshot and active signals. */
export interface PluralitySignalEvaluation {
  /** Dove signals that should be emitted on this snapshot. */
  readonly signals: readonly DoveSignal[];

  /** Updated active-signal registry after this evaluation. */
  readonly nextActiveSignals: Map<DriftCategory, ActiveSignalState>;
}

const DEFAULT_PLURALITY_THRESHOLD = 0.6;
const DEFAULT_SOURCE = 'gnosis-core-plurality';

/**
 * Pure evaluation of plurality-related Dove signals.
 *
 * Compares the current snapshot to the previous one and the currently active
 * signal registry. Returns any new signals that should be emitted (rising-edge
 * semantics) and the updated registry.
 *
 * Rules (from PERSONALITY_DIVERSITY_OPERATIONAL_SPEC.md):
 * - `participation.diversity.low` — Tier 2 when `diversityIndex < threshold`
 *   for two consecutive snapshots.
 * - `monoculture.formation` — Tier 2 when `minRepresentationRatio < 0.1` or a
 *   single archetype exceeds 60% of the population. Tier 3 when
 *   `minRepresentationRatio = 0` for two consecutive snapshots.
 * - `personality.diversity.healthy` — Tier 1 when `isPlural = true` and
 *   `minRepresentationRatio >= 0.2` for two consecutive snapshots.
 */
export function evaluatePluralitySignals(
  current: PopulationDiversitySnapshot,
  previous: PopulationDiversitySnapshot | null,
  activeSignals: ReadonlyMap<DriftCategory, ActiveSignalState>
): PluralitySignalEvaluation {
  const signals: DoveSignal[] = [];
  const nextActiveSignals = new Map<DriftCategory, ActiveSignalState>(activeSignals);

  const { metrics, populationSize } = current;

  // No classified agents — nothing to signal at the population level.
  if (populationSize === 0) {
    return { signals, nextActiveSignals };
  }

  const dominantArchetypeRatio = metrics.dominantArchetype
    ? metrics.archetypeDistribution[metrics.dominantArchetype] / populationSize
    : 0;

  // ── participation.diversity.low ────────────────────────────────────────────
  const isLowDiversity = metrics.diversityIndex < current.threshold;
  const wasLowDiversity =
    previous !== null && previous.metrics.diversityIndex < previous.threshold;

  if (isLowDiversity && wasLowDiversity) {
    const signal = buildDoveSignal({
      tier: 2,
      driftCategory: 'participation.diversity.low',
      snapshot: current,
      observedValue: String(metrics.diversityIndex),
      threshold: String(current.threshold),
      description: `Diversity index ${metrics.diversityIndex.toFixed(
        3
      )} remained below threshold ${current.threshold} for two consecutive snapshots.`,
    });
    emitIfRisingEdge(signal, nextActiveSignals, signals);
  } else {
    nextActiveSignals.delete('participation.diversity.low');
  }

  // ── monoculture.formation ──────────────────────────────────────────────────
  const minRatio = metrics.minRepresentationRatio;
  const wasZeroRatio =
    previous !== null && previous.metrics.minRepresentationRatio === 0;
  const isDominantMajority = dominantArchetypeRatio > 0.6;

  if (minRatio === 0 && wasZeroRatio) {
    const signal = buildDoveSignal({
      tier: 3,
      driftCategory: 'monoculture.formation',
      snapshot: current,
      observedValue: String(minRatio),
      threshold: '0',
      description:
        'One or more archetypes have been completely absent for two consecutive snapshots (minRepresentationRatio = 0).',
    });
    emitIfRisingEdge(signal, nextActiveSignals, signals);
  } else if (minRatio < 0.1 || isDominantMajority) {
    const signal = buildDoveSignal({
      tier: 2,
      driftCategory: 'monoculture.formation',
      snapshot: current,
      observedValue: isDominantMajority
        ? String(dominantArchetypeRatio)
        : String(minRatio),
      threshold: isDominantMajority ? '0.6' : '0.1',
      description: isDominantMajority
        ? `Dominant archetype ${metrics.dominantArchetype} represents ${(
            dominantArchetypeRatio * 100
          ).toFixed(1)}% of the classified population, exceeding the 60% monoculture guardrail.`
        : `Representation ratio ${minRatio.toFixed(
            3
          )} is below the 0.1 monoculture guardrail (rarest archetype is >10× less common than the most common).`,
    });
    emitIfRisingEdge(signal, nextActiveSignals, signals);
  } else {
    nextActiveSignals.delete('monoculture.formation');
  }

  // ── personality.diversity.healthy ────────────────────────────────────────
  const isHealthy = metrics.isPlural && minRatio >= 0.2;
  const wasHealthy =
    previous !== null &&
    previous.metrics.isPlural &&
    previous.metrics.minRepresentationRatio >= 0.2;

  if (isHealthy && wasHealthy) {
    const signal = buildDoveSignal({
      tier: 1,
      driftCategory: 'personality.diversity.healthy',
      snapshot: current,
      observedValue: String(metrics.diversityIndex),
      threshold: `${current.threshold}; minRepresentationRatio 0.2`,
      description: `Axiom 9 plurality is healthy: diversityIndex ${metrics.diversityIndex.toFixed(
        3
      )} >= ${current.threshold} and minRepresentationRatio ${minRatio.toFixed(
        3
      )} >= 0.2 for two consecutive snapshots.`,
    });
    emitIfRisingEdge(signal, nextActiveSignals, signals);
  } else {
    nextActiveSignals.delete('personality.diversity.healthy');
  }

  return { signals, nextActiveSignals };
}

function buildDoveSignal(params: {
  readonly tier: DoveTier;
  readonly driftCategory: DriftCategory;
  readonly snapshot: PopulationDiversitySnapshot;
  readonly observedValue: string;
  readonly threshold: string;
  readonly description: string;
}): DoveSignal {
  const { tier, driftCategory, snapshot, observedValue, threshold, description } =
    params;

  return {
    signalId: randomUUID(),
    timestamp: snapshot.generatedAt,
    tier,
    layer: 'dao',
    driftCategory,
    observedValue,
    threshold,
    description,
    governanceProposalGenerated: tier === 2 || tier === 3,
    resolved: false,
  };
}

function emitIfRisingEdge(
  signal: DoveSignal,
  nextActiveSignals: Map<DriftCategory, ActiveSignalState>,
  signals: DoveSignal[]
): void {
  const existing = nextActiveSignals.get(signal.driftCategory);
  if (existing && existing.tier === signal.tier) {
    // Same signal already active — suppress duplicate emission.
    return;
  }

  signals.push(signal);
  nextActiveSignals.set(signal.driftCategory, {
    tier: signal.tier,
    driftCategory: signal.driftCategory,
    snapshotId: signal.signalId,
  });
}

/**
 * Stateful observer that computes plurality snapshots and emits Dove signals
 * through an EventBus.
 */
export class PluralityDoveEmitter {
  private readonly bus: EventBus;
  private readonly threshold: number;
  private readonly source: string;
  private previousSnapshot: PopulationDiversitySnapshot | null = null;
  private activeSignals = new Map<DriftCategory, ActiveSignalState>();

  constructor(config: PluralityDoveEmitterConfig) {
    this.bus = config.bus;
    this.threshold = config.threshold ?? DEFAULT_PLURALITY_THRESHOLD;
    this.source = config.source ?? DEFAULT_SOURCE;
  }

  /**
   * Observe a population of agent profiles.
   *
   * Computes a diversity snapshot, emits it as `gnosis.plurality.snapshot`,
   * evaluates Dove thresholds, and emits any new `dove.signal.tier*` events.
   */
  private buildTrace(): EventTrace {
    const now = new Date().toISOString();
    return {
      intentionId: `plurality-${this.source}-${now}`,
      source: this.source,
      parentEventId: this.previousSnapshot?.snapshotId,
      createdAt: now,
    };
  }

  observe(profiles: readonly AgentProfile[]): PopulationDiversitySnapshot {
    const snapshot = calculatePopulationDiversitySnapshot(
      profiles,
      this.threshold
    );
    const trace = this.buildTrace();

    // gnosis.plurality.snapshot is an observation, not a governance action,
    // so trace is not required; we include it anyway for auditability.
    this.bus.emit('gnosis.plurality.snapshot', 'gnosis', snapshot, {
      source: this.source,
      severity: 'info',
      trace,
    });

    const evaluation = evaluatePluralitySignals(
      snapshot,
      this.previousSnapshot,
      this.activeSignals
    );

    for (const signal of evaluation.signals) {
      const eventType =
        signal.tier === 1
          ? 'dove.signal.tier1'
          : signal.tier === 2
            ? 'dove.signal.tier2'
            : 'dove.signal.tier3';

      // Dove signals are governance-relevant and require a documented intention trace.
      this.bus.emit(eventType, 'gnosis', signal, {
        source: this.source,
        severity:
          signal.tier === 3 ? 'critical' : signal.tier === 2 ? 'warning' : 'info',
        correlationId: snapshot.snapshotId,
        trace,
      });
    }

    this.activeSignals = evaluation.nextActiveSignals;
    this.previousSnapshot = snapshot;
    return snapshot;
  }
}
