/**
 * Tests for PluralityStateStore.
 *
 * Verifies load/save round-trips and graceful handling of missing or corrupt
 * state files.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PopulationDiversitySnapshot } from '@sovereign/types';

import { PluralityStateStore } from './state-store.js';
import type { ActiveSignalState } from './emitter.js';

const DRIFT_CATEGORIES = [
  'participation.diversity.low',
  'monoculture.formation',
  'personality.diversity.healthy',
] as const;

type TestDrift = (typeof DRIFT_CATEGORIES)[number];

function makeSnapshot(id: string): PopulationDiversitySnapshot {
  return {
    snapshotId: id,
    generatedAt: '2026-06-26T00:00:00.000Z',
    populationSize: 3,
    threshold: 0.6,
    metrics: {
      diversityIndex: 0.95,
      minRepresentationRatio: 0.33,
      archetypeDistribution: {
        explorer: 1,
        executor: 1,
        governor: 1,
        mediator: 0,
        chronicler: 0,
        synthesizer: 0,
      },
      dominantArchetype: null,
      isPlural: true,
    },
  };
}

describe('PluralityStateStore', () => {
  let tempDir: string;
  let statePath: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'plurality-state-'));
    statePath = join(tempDir, 'state.json');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns empty state when the file does not exist', () => {
    const store = new PluralityStateStore({ path: statePath });
    const state = store.load();

    expect(state.previousSnapshot).toBeNull();
    expect(state.activeSignals.size).toBe(0);
  });

  it('round-trips snapshot and active signals', () => {
    const store = new PluralityStateStore({ path: statePath });
    const snapshot = makeSnapshot('snapshot-1');
    const active = new Map<TestDrift, ActiveSignalState>();
    active.set('monoculture.formation', {
      tier: 3,
      driftCategory: 'monoculture.formation',
      snapshotId: 'snapshot-1',
    });

    store.save({ previousSnapshot: snapshot, activeSignals: active });
    const loaded = store.load();

    expect(loaded.previousSnapshot).toEqual(snapshot);
    expect(loaded.activeSignals.get('monoculture.formation')).toEqual({
      tier: 3,
      driftCategory: 'monoculture.formation',
      snapshotId: 'snapshot-1',
    });
  });

  it('gracefully ignores corrupt state files', () => {
    writeFileSync(statePath, 'not valid json', 'utf8');
    const store = new PluralityStateStore({ path: statePath });
    const loaded = store.load();

    expect(loaded.previousSnapshot).toBeNull();
    expect(loaded.activeSignals.size).toBe(0);
  });

  it('gracefully ignores malformed active signal entries', () => {
    writeFileSync(
      statePath,
      JSON.stringify({
        previousSnapshot: null,
        activeSignals: {
          'participation.diversity.low': { tier: 2, driftCategory: 'participation.diversity.low', snapshotId: 's1' },
          invalid: { foo: 'bar' },
        },
      }),
      'utf8'
    );

    const store = new PluralityStateStore({ path: statePath });
    const loaded = store.load();

    expect(loaded.activeSignals.size).toBe(1);
    expect(loaded.activeSignals.has('participation.diversity.low')).toBe(true);
  });
});
