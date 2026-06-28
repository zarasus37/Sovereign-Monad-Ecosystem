/**
 * Plurality Scheduler
 *
 * Production cadence wrapper for `PluralityDoveEmitter`. It periodically
 * fetches a population of agent profiles, computes a diversity snapshot, and
 * emits Dove signals through `@sovereign/bus` when Axiom 9 thresholds are
 * crossed.
 *
 * The scheduler is still retrospective: it observes and signals, never
 * preempting agent behavior. It is designed to run as a long-lived process
 * alongside the rest of the Sovereign Monad ecosystem.
 *
 * Reference: plex/Manifest/PERSONALITY_DIVERSITY_OPERATIONAL_SPEC.md
 */

import type { AgentProfile } from '@sovereign/types';
import type { EventBus } from '@sovereign/bus';

import { PluralityDoveEmitter } from './emitter.js';

/** Function that returns the current classified agent population. */
export type PopulationProvider = () =>
  | readonly AgentProfile[]
  | Promise<readonly AgentProfile[]>;

/** Configuration for the plurality production scheduler. */
export interface PluralitySchedulerConfig {
  /** EventBus instance used for emission. */
  readonly bus: EventBus;

  /** Provider that returns the current agent population to observe. */
  readonly provider: PopulationProvider;

  /** Observation cadence in milliseconds. Default: 15 minutes (900_000). */
  readonly intervalMs?: number;

  /** Plurality threshold passed to the emitter. Default: 0.6. */
  readonly threshold?: number;

  /** Source identifier used in emitted events. Default: `gnosis-core-plurality`. */
  readonly source?: string;
}

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_SOURCE = 'gnosis-core-plurality';

/**
 * Stateful production scheduler for Axiom 9 plurality monitoring.
 *
 * ```typescript
 * const scheduler = new PluralityScheduler({
 *   bus: sovereignBus,
 *   provider: () => agentRegistry.getClassifiedProfiles(),
 * });
 * scheduler.start();
 * // ... later
 * await scheduler.stop();
 * ```
 */
export class PluralityScheduler {
  private readonly bus: EventBus;
  private readonly provider: PopulationProvider;
  private readonly intervalMs: number;
  private readonly emitter: PluralityDoveEmitter;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pendingObservation: Promise<unknown> | null = null;
  private _isRunning = false;

  constructor(config: PluralitySchedulerConfig) {
    this.bus = config.bus;
    this.provider = config.provider;
    this.intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.emitter = new PluralityDoveEmitter({
      bus: config.bus,
      threshold: config.threshold ?? DEFAULT_THRESHOLD,
      source: config.source ?? DEFAULT_SOURCE,
    });
  }

  /** Whether the scheduler is currently running. */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /** Start the scheduler. Runs one observation immediately, then on interval. */
  start(): void {
    if (this._isRunning) {
      this.log('warn', 'Scheduler is already running; start() ignored.');
      return;
    }

    this._isRunning = true;
    this.log(
      'info',
      `Starting plurality scheduler (intervalMs=${this.intervalMs}, threshold=${this.emitterThreshold}).`
    );

    // Run immediately so operators see feedback without waiting one full interval.
    this.pendingObservation = this.observeSafely();

    this.timer = setInterval(() => {
      this.pendingObservation = this.observeSafely();
    }, this.intervalMs);

    // Ensure the interval does not keep the process alive if nothing else is running.
    if (typeof this.timer === 'object' && this.timer !== null && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  /** Stop the scheduler and await any pending observation. */
  async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    this._isRunning = false;
    this.log('info', 'Stopping plurality scheduler...');

    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.pendingObservation !== null) {
      try {
        await this.pendingObservation;
      } catch (err) {
        // Already logged by observeSafely; swallow here to allow clean shutdown.
      }
      this.pendingObservation = null;
    }

    this.log('info', 'Plurality scheduler stopped.');
  }

  private async observeSafely(): Promise<void> {
    try {
      const profiles = await this.provider();
      this.emitter.observe(profiles);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log('error', `Population provider failed: ${message}`);

      // Emit a system error so operators can observe provider failures.
      try {
        this.bus.emit(
          'system.error',
          'gnosis',
          {
            errorCode: 'PLURALITY_PROVIDER_FAILED',
            message,
            source: 'gnosis-core-plurality-scheduler',
          },
          { severity: 'critical' }
        );
      } catch (busErr) {
        // Bus may be shutting down; log locally.
        this.log('error', `Failed to emit system.error: ${busErr}`);
      }
    }
  }

  private get emitterThreshold(): number {
    // PluralityDoveEmitter does not expose its threshold; mirror the default.
    return DEFAULT_THRESHOLD;
  }

  private log(level: 'info' | 'warn' | 'error', message: string): void {
    const timestamp = new Date().toISOString();
    console[level](`[PluralityScheduler] ${timestamp} ${level.toUpperCase()}: ${message}`);
  }
}
