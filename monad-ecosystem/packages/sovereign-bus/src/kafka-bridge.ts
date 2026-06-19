/**
 * Kafka bridge for the Sovereign event bus.
 *
 * When KAFKA_ENABLED=true, this module intercepts all EventBus emissions
 * and forwards them to the real Kafka cluster using the MOF canonical
 * topic map (Section 6.2 / Layer 2 Engine section).
 *
 * In local/analysis mode (default), this module is a no-op.
 * The bus operates identically in both modes — callers never need to change.
 *
 * Canonical Kafka topic map (MOF §Layer 2):
 *   monad.price         | monad-market-agent     → spread-scanner
 *   eth.price           | eth-market-agent        → spread-scanner
 *   signals.spread      | spread-scanner          → risk-engine
 *   risk.evaluation     | risk-engine             → opportunity-constructor
 *   opportunity.structured | opportunity-constructor → portfolio-manager
 *   portfolio.approved  | portfolio-manager       → arb-bots
 *   execution.monad     | monad-arb-bot           → portfolio-manager
 *   execution.eth       | eth-arb-bot             → portfolio-manager
 *   execution.bridge    | bridge-exec-bot         → portfolio-manager
 *   system.health       | all services            → DoveRouterObserver
 */

import type { SignalEvent, SignalEventType } from '@sovereign/types';
import type { EventBus } from './EventBus.js';

/** Topic mapping from SignalEventType to Kafka topic string. */
const KAFKA_TOPIC_MAP: Partial<Record<SignalEventType, string>> = {
  'price.updated': 'monad.price',
  'spread.detected': 'signals.spread',
  'oracle.regime.classified': 'risk.evaluation',
  'trade.approved': 'portfolio.approved',
  'trade.executed': 'execution.monad',
  'system.health': 'system.health',
  'hepar.audit.completed': 'hepar.audit.completed',
  'gnosis.score.computed': 'gnosis.score',
  'dove.signal.tier1': 'dove.signals',
  'dove.signal.tier2': 'dove.signals',
  'dove.signal.tier3': 'dove.signals',
  'data-rail.activated': 'data-rail.lifecycle',
  'emergence.claim.submitted': 'emergence.claims',
  'revenue.routed': 'revenue.router',
};

export interface KafkaBridgeConfig {
  /** Kafka broker connection string (e.g. 'localhost:9092'). */
  readonly brokers: string;

  /** Client ID for this Kafka producer. */
  readonly clientId: string;

  /** Topic to use when no specific mapping exists. */
  readonly defaultTopic?: string;
}

/**
 * KafkaBridge — forwards bus events to Kafka when enabled.
 *
 * This implementation is a stub that validates configuration and logs
 * forwarding decisions. Full Kafka client initialization requires
 * `kafkajs` to be installed in the consuming package.
 *
 * Set KAFKA_ENABLED=true and KAFKA_BROKERS=<host:port> to activate.
 */
export class KafkaBridge {
  private readonly config: KafkaBridgeConfig;
  private initialized = false;

  constructor(config: KafkaBridgeConfig) {
    this.config = config;
  }

  /**
   * Attach this bridge to an EventBus.
   * All events emitted on the bus will be forwarded to Kafka.
   *
   * @returns Detach function — call to stop forwarding
   */
  attach(bus: EventBus): () => void {
    if (!this.isKafkaEnabled()) {
      console.log('[KafkaBridge] KAFKA_ENABLED is not set — running in local-only mode');
      return () => undefined;
    }

    console.log(`[KafkaBridge] Attaching to bus — forwarding to ${this.config.brokers}`);
    this.initialized = true;

    // Subscribe to all mapped event types
    const forwardEvent = (event: SignalEvent<unknown>): void => {
      const topic = KAFKA_TOPIC_MAP[event.type] ?? this.config.defaultTopic ?? 'sovereign.events';
      console.log(`[KafkaBridge] → ${topic} | ${event.type} | ${event.id}`);
      // TODO: await producer.send({ topic, messages: [{ value: JSON.stringify(event) }] });
    };

    const unsubs: (() => void)[] = [];
    for (const type of Object.keys(KAFKA_TOPIC_MAP) as SignalEventType[]) {
      unsubs.push(bus.on(type, forwardEvent));
    }

    // Return a detach function (in real impl, would close the producer and unsubscribe)
    return () => {
      console.log('[KafkaBridge] Detaching and cleaning up subscriptions');
      for (const unsub of unsubs) {
        unsub();
      }
      this.initialized = false;
    };
  }

  private isKafkaEnabled(): boolean {
    return process.env['KAFKA_ENABLED'] === 'true';
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Returns the Kafka topic for a given signal event type, or null if unmapped. */
  static getTopicFor(type: SignalEventType): string | null {
    return KAFKA_TOPIC_MAP[type] ?? null;
  }
}

/**
 * Initialize the Kafka bridge from environment variables.
 * Returns null if KAFKA_ENABLED is not set.
 */
export function initKafkaBridgeFromEnv(): KafkaBridge | null {
  if (process.env['KAFKA_ENABLED'] !== 'true') return null;

  const brokers = process.env['KAFKA_BROKERS'];
  if (!brokers) {
    console.error('[KafkaBridge] KAFKA_ENABLED=true but KAFKA_BROKERS is not set');
    return null;
  }

  return new KafkaBridge({
    brokers,
    clientId: process.env['KAFKA_CLIENT_ID'] ?? 'sovereign-bus',
  });
}
