/**
 * EventBus — the Sovereign Monad internal typed event bus.
 *
 * Design goals:
 * 1. Zero external runtime dependencies in local/analysis mode.
 * 2. Fully typed — all emitted events conform to SignalEvent<TPayload>.
 * 3. Append-only structured log — every emission is persisted to
 *    `logs/signal-stream.jsonl` for post-hoc analysis.
 * 4. Kafka-compatible topic naming — same topic strings as the MOF
 *    Kafka Topic Map, so the kafka-bridge is a drop-in swap.
 * 5. Correlation IDs flow automatically through the emission chain.
 */

import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type { SignalEvent, SignalEventType, SignalLayer } from '@sovereign/types';

// ── Listener registry types ──────────────────────────────────────────────────

/** A typed event listener callback. */
export type EventListener<TPayload = unknown> = (
  event: SignalEvent<TPayload>
) => void | Promise<void>;

/** Internal listener record with subscriber metadata. */
interface ListenerRecord {
  readonly subscriberId: string;
  readonly listener: EventListener<unknown>;
}

// ── Bus configuration ────────────────────────────────────────────────────────

export interface EventBusConfig {
  /**
   * Source identifier for this bus instance (e.g. 'hepar-defi-auditor').
   * Used as default `source` in emitted events when not overridden.
   */
  readonly source: string;

  /**
   * Absolute path to the log directory.
   * Defaults to `<package-root>/logs/`.
   */
  readonly logDir?: string;

  /**
   * Log filename within logDir.
   * Defaults to `signal-stream.jsonl`.
   */
  readonly logFile?: string;

  /**
   * Whether to write events to the JSONL log.
   * Defaults to true.
   */
  readonly persistLogs?: boolean;

  /**
   * Whether to forward events to Kafka.
   * Requires `KAFKA_ENABLED=true` environment variable AND
   * the kafka-bridge module to be initialized.
   * Defaults to false (safe local-only mode).
   */
  readonly kafkaEnabled?: boolean;
}

// ── Hash utility ─────────────────────────────────────────────────────────────

function computeEventHash(event: Omit<SignalEvent, 'hash'>): string {
  const raw = `${event.id}${event.timestamp}${JSON.stringify(event.payload)}`;
  return createHash('sha256').update(raw).digest('hex');
}

// ── EventBus ─────────────────────────────────────────────────────────────────

/**
 * The Sovereign internal typed event bus.
 *
 * Emit a signal:
 * ```typescript
 * bus.emit('hepar.audit.completed', 'intelligence', auditResult);
 * ```
 *
 * Subscribe to signals:
 * ```typescript
 * const unsub = bus.on('hepar.audit.completed', (event) => {
 *   console.log(event.payload); // HeparAuditResult
 * });
 * ```
 *
 * All events are persisted to `logs/signal-stream.jsonl` unless disabled.
 */
export class EventBus {
  private readonly config: Required<EventBusConfig>;
  private readonly listeners = new Map<string, ListenerRecord[]>();
  private logStream: ReturnType<typeof createWriteStream> | null = null;
  private isShuttingDown = false;

  constructor(config: EventBusConfig) {
    this.config = {
      source: config.source,
      logDir: config.logDir ?? this.resolveDefaultLogDir(),
      logFile: config.logFile ?? 'signal-stream.jsonl',
      persistLogs: config.persistLogs ?? true,
      kafkaEnabled: config.kafkaEnabled ?? false,
    };

    if (this.config.persistLogs) {
      this.initLogStream();
    }
  }

  // ── Emit ─────────────────────────────────────────────────────────────────

  /**
   * Emit a typed event on the bus.
   *
   * @param type - Event type discriminant (from SignalEventType union)
   * @param layer - The ecosystem layer emitting this event
   * @param payload - The typed payload for this event
   * @param options - Optional overrides (correlationId, source, severity)
   * @returns The fully constructed and persisted SignalEvent
   */
  emit<TPayload>(
    type: SignalEventType,
    layer: SignalLayer,
    payload: TPayload,
    options?: {
      readonly correlationId?: string;
      readonly source?: string;
      readonly severity?: SignalEvent['severity'];
    }
  ): SignalEvent<TPayload> {
    if (this.isShuttingDown) {
      throw new BusError('Cannot emit: bus is shutting down', 'BUS_SHUTTING_DOWN');
    }

    const id = randomUUID();
    const timestamp = new Date().toISOString();
    const partialEvent = {
      id,
      correlationId: options?.correlationId ?? randomUUID(),
      timestamp,
      layer,
      source: options?.source ?? this.config.source,
      type,
      payload,
      severity: options?.severity,
    };

    const event: SignalEvent<TPayload> = {
      ...partialEvent,
      hash: computeEventHash(partialEvent),
    };

    // Persist to log
    if (this.config.persistLogs && this.logStream) {
      this.persistEvent(event);
    }

    // Dispatch to listeners
    this.dispatch(type, event as SignalEvent<unknown>);

    return event;
  }

  // ── Subscribe ─────────────────────────────────────────────────────────────

  /**
   * Subscribe to a specific event type.
   *
   * @param type - Event type to subscribe to
   * @param listener - Callback invoked for each matching event
   * @returns Unsubscribe function — call to remove this listener
   */
  on<TPayload>(
    type: SignalEventType,
    listener: EventListener<TPayload>
  ): () => void {
    const subscriberId = randomUUID();
    const record: ListenerRecord = {
      subscriberId,
      listener: listener as EventListener<unknown>,
    };

    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(record);

    return () => this.off(type, subscriberId);
  }

  /**
   * Subscribe to all events from a specific ecosystem layer.
   *
   * @param layer - Layer to subscribe to
   * @param listener - Callback invoked for each event from this layer
   * @returns Unsubscribe function
   */
  onLayer<TPayload>(
    layer: SignalLayer,
    listener: EventListener<TPayload>
  ): () => void {
    // Subscribe to all registered types and filter by layer at dispatch
    const subscriberId = randomUUID();
    const wrappedListener: EventListener<unknown> = (event) => {
      if (event.layer === layer) {
        (listener as EventListener<unknown>)(event);
      }
    };

    // Use a synthetic key for layer-scoped subscriptions
    const key = `__layer__:${layer}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push({ subscriberId, listener: wrappedListener });

    return () => this.off(key, subscriberId);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private dispatch(type: SignalEventType, event: SignalEvent<unknown>): void {
    // Type-specific listeners
    const typeListeners = this.listeners.get(type) ?? [];
    // Layer-scoped listeners (checked for all emissions)
    const layerListeners = this.listeners.get(`__layer__:${event.layer}`) ?? [];

    const all = [...typeListeners, ...layerListeners];
    for (const record of all) {
      try {
        void Promise.resolve(record.listener(event));
      } catch (err) {
        // Listeners must not crash the bus — log and continue
        console.error(
          `[SovereignBus] Listener error for event "${type}" (subscriber ${record.subscriberId}):`,
          err
        );
      }
    }
  }

  private off(key: string, subscriberId: string): void {
    const records = this.listeners.get(key);
    if (!records) return;
    const filtered = records.filter((r) => r.subscriberId !== subscriberId);
    if (filtered.length === 0) {
      this.listeners.delete(key);
    } else {
      this.listeners.set(key, filtered);
    }
  }

  private persistEvent(event: SignalEvent<unknown>): void {
    if (!this.logStream) return;
    try {
      this.logStream.write(JSON.stringify(event) + '\n');
    } catch (err) {
      console.error('[SovereignBus] Failed to persist event to log:', err);
    }
  }

  private initLogStream(): void {
    try {
      mkdirSync(this.config.logDir, { recursive: true });
      const logPath = join(this.config.logDir, this.config.logFile);
      this.logStream = createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
      this.logStream.on('error', (err) => {
        console.error('[SovereignBus] Log stream error:', err);
        this.logStream = null;
      });
    } catch (err) {
      console.error('[SovereignBus] Failed to initialize log stream:', err);
      this.logStream = null;
    }
  }

  private resolveDefaultLogDir(): string {
    // Resolve relative to the calling package's working directory
    return join(process.cwd(), 'logs');
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Gracefully shut down the bus.
   * Closes the log stream and prevents further emissions.
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    if (this.logStream) {
      await new Promise<void>((resolve, reject) => {
        this.logStream!.end((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      this.logStream = null;
    }
    this.listeners.clear();
  }

  /**
   * Returns the count of active listeners (for testing and diagnostics).
   */
  get listenerCount(): number {
    let total = 0;
    for (const records of this.listeners.values()) {
      total += records.length;
    }
    return total;
  }
}

// ── Typed bus error ───────────────────────────────────────────────────────────

export class BusError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'BusError';
    this.code = code;
  }
}

// ── Singleton factory ─────────────────────────────────────────────────────────

/**
 * Module-level singleton registry.
 * Packages that share a process can use `getOrCreateBus` to share one instance.
 * Each bus instance has an isolated listener registry and log stream.
 */
const busRegistry = new Map<string, EventBus>();

/**
 * Get or create a named EventBus instance.
 *
 * @param name - Logical name for this bus (e.g. 'sovereign-local', 'hepar-bus')
 * @param config - Config used only on first creation; subsequent calls return existing instance
 */
export function getOrCreateBus(name: string, config: EventBusConfig): EventBus {
  if (!busRegistry.has(name)) {
    busRegistry.set(name, new EventBus(config));
  }
  return busRegistry.get(name)!;
}

/**
 * The canonical shared bus for local in-process operation.
 * Import this from any package to connect to the same bus instance.
 */
export const sovereignBus: EventBus = getOrCreateBus('sovereign-local', {
  source: 'sovereign-local',
  persistLogs: true,
});
