/**
 * Persistent state store for the plurality Dove emitter.
 *
 * Saves the previous diversity snapshot and active signal registry across
 * process restarts so that rising-edge semantics are preserved: a signal that
 * was already active before shutdown is not re-emitted immediately on startup
 * if the same condition still holds.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DriftCategory, PopulationDiversitySnapshot } from '@sovereign/types';
import type { ActiveSignalState } from './emitter.js';

/** Serializable persisted state for the plurality emitter. */
export interface PersistedPluralityState {
  /** Snapshot from the most recent successful observation, if any. */
  readonly previousSnapshot: PopulationDiversitySnapshot | null;
  /** Active Dove signals keyed by drift category. */
  readonly activeSignals: ReadonlyMap<DriftCategory, ActiveSignalState>;
}

/** JSON-safe representation of PersistedPluralityState. */
interface SerializedPluralityState {
  readonly previousSnapshot: PopulationDiversitySnapshot | null;
  readonly activeSignals: Partial<Record<DriftCategory, ActiveSignalState>>;
}

export interface PluralityStateStoreConfig {
  /** Path to the JSON state file. */
  readonly path: string;
}

export class PluralityStateStore {
  private readonly path: string;

  constructor(config: PluralityStateStoreConfig) {
    this.path = config.path;
  }

  /**
   * Load persisted state.
   *
   * Returns empty state if the file does not exist or is corrupt. Logs a
   * warning on parse errors so the scheduler can still start.
   */
  load(): PersistedPluralityState {
    if (!existsSync(this.path)) {
      return { previousSnapshot: null, activeSignals: new Map() };
    }

    try {
      const raw = readFileSync(this.path, 'utf8');
      const parsed = JSON.parse(raw) as unknown;
      return this.deserialize(parsed);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[PluralityStateStore] Failed to load state from ${this.path}: ${message}. Starting with empty state.`
      );
      return { previousSnapshot: null, activeSignals: new Map() };
    }
  }

  /**
   * Persist state to disk.
   *
   * Creates the parent directory if it does not exist. Failures are logged but
   * not thrown so that observation failures do not cascade into crashes.
   */
  save(state: PersistedPluralityState): void {
    try {
      const dir = dirname(this.path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(
        this.path,
        JSON.stringify(this.serialize(state), null, 2),
        'utf8'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[PluralityStateStore] Failed to save state to ${this.path}: ${message}. Continuing without persistence.`
      );
    }
  }

  private serialize(state: PersistedPluralityState): SerializedPluralityState {
    const activeSignals: Partial<Record<DriftCategory, ActiveSignalState>> = {};
    for (const [category, signalState] of state.activeSignals.entries()) {
      activeSignals[category] = signalState;
    }
    return {
      previousSnapshot: state.previousSnapshot,
      activeSignals,
    };
  }

  private deserialize(raw: unknown): PersistedPluralityState {
    if (typeof raw !== 'object' || raw === null) {
      return { previousSnapshot: null, activeSignals: new Map() };
    }

    const candidate = raw as Partial<SerializedPluralityState>;
    const previousSnapshot =
      candidate.previousSnapshot ?? null;

    const activeSignals = new Map<DriftCategory, ActiveSignalState>();
    if (candidate.activeSignals && typeof candidate.activeSignals === 'object') {
      for (const [category, state] of Object.entries(candidate.activeSignals)) {
        if (this.isActiveSignalState(state)) {
          activeSignals.set(category as DriftCategory, state);
        }
      }
    }

    return { previousSnapshot, activeSignals };
  }

  private isActiveSignalState(value: unknown): value is ActiveSignalState {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as { tier?: unknown }).tier === 'number' &&
      typeof (value as { driftCategory?: unknown }).driftCategory === 'string' &&
      typeof (value as { snapshotId?: unknown }).snapshotId === 'string'
    );
  }
}
