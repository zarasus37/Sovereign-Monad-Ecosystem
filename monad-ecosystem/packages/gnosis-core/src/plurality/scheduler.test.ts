/**
 * Tests for the PluralityScheduler.
 *
 * Strategy: drive the scheduler with a mock EventBus and a controllable
 * population provider. Use fake timers to exercise interval behavior without
 * waiting for real time.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AgentProfile, DoveSignal } from '@sovereign/types';
import type { EventBus } from '@sovereign/bus';

import { PluralityScheduler, type PopulationProvider } from './scheduler.js';

function makeProfile(archetype: AgentProfile['archetype']): AgentProfile {
  return {
    agentId: `agent-${Math.random().toString(36).slice(2)}`,
    name: 'Test Agent',
    role: 'ecosystem-native',
    archetype,
    bigFive: {
      conscientiousness: 0.5,
      neuroticism: 0.5,
      openness: 0.5,
      agreeableness: 0.5,
      extraversion: 0.5,
    },
    hexaco: { honestyHumility: 0.5 },
    hoganRisk: {
      excitability: 0.5,
      skepticism: 0.5,
      cautious: 0.5,
      independent: 0.5,
      mischievous: 0.5,
    },
    validationTier: 1,
    riskEnvelope: {
      maxPositionFraction: 0.1,
      maxDrawdownThreshold: 0.03,
      minEdgeBps: 12,
      kellyFraction: 0.25,
      capitalAuthorized: false,
    },
    registeredAt: new Date().toISOString(),
  };
}

function mockBus(): EventBus {
  return {
    emit: vi.fn(),
    on: vi.fn(),
    onLayer: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
    listenerCount: 0,
  } as unknown as EventBus;
}

type EmitCall = [type: string, layer: string, payload: unknown];

function emittedCalls(bus: EventBus): EmitCall[] {
  return (bus.emit as ReturnType<typeof vi.fn>).mock.calls as EmitCall[];
}

function extractDoveSignals(bus: EventBus): DoveSignal[] {
  return emittedCalls(bus)
    .filter(
      (call) =>
        call[0] === 'dove.signal.tier1' ||
        call[0] === 'dove.signal.tier2' ||
        call[0] === 'dove.signal.tier3'
    )
    .map((call) => call[2] as DoveSignal);
}

describe('PluralityScheduler', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = mockBus();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not running before start()', () => {
    const scheduler = new PluralityScheduler({
      bus,
      provider: () => [],
      intervalMs: 1000,
    });

    expect(scheduler.isRunning).toBe(false);
  });

  it('observes immediately on start()', async () => {
    const provider = vi.fn(() => [makeProfile('executor')]);
    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    scheduler.start();

    // Wait one tick for the async provider.
    await vi.advanceTimersByTimeAsync(0);

    expect(provider).toHaveBeenCalledTimes(1);
    expect(extractDoveSignals(bus).length).toBeGreaterThanOrEqual(0);
    expect(scheduler.isRunning).toBe(true);

    await scheduler.stop();
  });

  it('observes repeatedly on interval', async () => {
    const provider = vi.fn(() => [makeProfile('executor')]);
    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(provider).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(provider).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1000);
    expect(provider).toHaveBeenCalledTimes(3);

    await scheduler.stop();
  });

  it('emits Dove signals after two consecutive low-diversity snapshots', async () => {
    const monoculture = Array.from({ length: 10 }, () => makeProfile('executor'));
    const provider: PopulationProvider = () => monoculture;

    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    const doveSignals = extractDoveSignals(bus);
    const categories = doveSignals.map((s) => s.driftCategory);
    expect(categories).toContain('monoculture.formation');

    await scheduler.stop();
  });

  it('emits system.error and continues when the provider throws', async () => {
    const provider = vi.fn(() => {
      throw new Error('registry unavailable');
    });

    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    const systemErrors = emittedCalls(bus).filter(
      (call) => call[0] === 'system.error'
    );
    expect(systemErrors.length).toBe(1);
    expect(
      (systemErrors[0][2] as { errorCode: string }).errorCode
    ).toBe('PLURALITY_PROVIDER_FAILED');

    // Scheduler should still be running and attempt again on next interval.
    await vi.advanceTimersByTimeAsync(1000);
    expect(provider).toHaveBeenCalledTimes(2);

    await scheduler.stop();
  });

  it('ignores additional start() calls while running', async () => {
    const provider = vi.fn(() => []);
    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    scheduler.start();
    scheduler.start();

    await vi.advanceTimersByTimeAsync(0);
    expect(provider).toHaveBeenCalledTimes(1);

    await scheduler.stop();
  });

  it('stops cleanly and awaits the pending observation', async () => {
    let resolveProvider!: () => void;
    const provider = vi.fn(
      () =>
        new Promise<readonly AgentProfile[]>((resolve) => {
          resolveProvider = () => resolve([]);
        })
    );

    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    const stopPromise = scheduler.stop();
    resolveProvider();
    await stopPromise;

    expect(scheduler.isRunning).toBe(false);
    expect(provider).toHaveBeenCalledTimes(1);
  });

  it('passes the configured threshold to the emitter', async () => {
    // Three archetypes equally represented: diversityIndex ~0.92, isPlural with
    // threshold=0.6, but not with threshold=0.95. Use threshold=0.95 so no healthy
    // signal fires on first two snapshots.
    const profiles = [
      makeProfile('explorer'),
      makeProfile('executor'),
      makeProfile('governor'),
    ];

    const scheduler = new PluralityScheduler({
      bus,
      provider: () => profiles,
      intervalMs: 1000,
      threshold: 0.95,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    const healthySignals = extractDoveSignals(bus).filter(
      (s) => s.driftCategory === 'personality.diversity.healthy'
    );
    expect(healthySignals.length).toBe(0);

    await scheduler.stop();
  });

  it('supports async population providers', async () => {
    const provider: PopulationProvider = async () => [
      makeProfile('explorer'),
      makeProfile('executor'),
    ];

    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    const snapshots = emittedCalls(bus).filter(
      (call) => call[0] === 'gnosis.plurality.snapshot'
    );
    expect(snapshots.length).toBe(1);

    await scheduler.stop();
  });

  it('exposes runtime metrics via getMetrics()', async () => {
    const monoculture = Array.from({ length: 10 }, () => makeProfile('executor'));
    const provider = vi.fn(() => monoculture);

    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    expect(scheduler.getMetrics()).toEqual({
      observationsTotal: 0,
      providerErrorsTotal: 0,
      signalsEmittedTotal: 0,
      lastObservationAt: null,
      lastProviderErrorAt: null,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);

    const metrics = scheduler.getMetrics();
    expect(metrics.observationsTotal).toBe(2);
    expect(metrics.signalsEmittedTotal).toBeGreaterThanOrEqual(1);
    expect(metrics.lastObservationAt).not.toBeNull();
    expect(metrics.providerErrorsTotal).toBe(0);
    expect(metrics.lastProviderErrorAt).toBeNull();

    await scheduler.stop();
  });

  it('increments provider error metrics when the provider throws', async () => {
    const provider = vi.fn(() => {
      throw new Error('registry unavailable');
    });

    const scheduler = new PluralityScheduler({
      bus,
      provider,
      intervalMs: 1000,
    });

    scheduler.start();
    await vi.advanceTimersByTimeAsync(0);

    const metrics = scheduler.getMetrics();
    expect(metrics.providerErrorsTotal).toBe(1);
    expect(metrics.observationsTotal).toBe(0);
    expect(metrics.lastProviderErrorAt).not.toBeNull();

    await scheduler.stop();
  });
});
