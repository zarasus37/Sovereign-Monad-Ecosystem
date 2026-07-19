/**
 * Shaliah agent path adapters — thin bus contracts.
 *
 * ShaliahIntentEmitter: wraps a trade/action decision into IntentRaised.
 * PlEventEmitter: stand-in for comprehension-gate / override / task-verifier
 * backends (ONLY these should hold pl.events producer credentials in prod).
 */

import type { Kafka } from 'kafkajs';
import { TOPICS } from './kafkaBus.js';
import type {
  IntentRaised,
  PLEvent,
  VerifiedBy,
} from './types.js';

/**
 * Stub for "wire intent.raised from a Shaliah agent path" — the
 * actual agent decision logic lives elsewhere; this adapter puts
 * IntentRaised on the bus keyed by principalId for per-principal ordering.
 *
 * Swap the source of `intent` for the real Shaliah decision function when
 * ready — the bus contract (IntentRaised) does not change.
 */
export class ShaliahIntentEmitter {
  private producer: ReturnType<Kafka['producer']>;
  private connected = false;

  constructor(private readonly kafka: Kafka) {
    this.producer = kafka.producer();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
  }

  async emitIntent(intent: IntentRaised): Promise<void> {
    await this.ensureConnected();
    await this.producer.send({
      topic: TOPICS.INTENT_RAISED,
      messages: [{ key: intent.principalId, value: JSON.stringify(intent) }],
    });
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }
}

const ALLOWED_VERIFIERS: ReadonlySet<string> = new Set([
  'comprehension-gate',
  'override-verifier',
  'task-verifier',
]);

/**
 * Stub verifier emitters — placeholders for real backends.
 * These are the ONLY things allowed to hold producer credentials for
 * pl.events in a real deployment (enforce via Kafka ACLs, not just convention).
 */
export class PlEventEmitter {
  private producer: ReturnType<Kafka['producer']>;
  private connected = false;
  private readonly serviceId: VerifiedBy;

  constructor(kafka: Kafka, serviceId: Exclude<VerifiedBy, 'client'>) {
    if (!ALLOWED_VERIFIERS.has(serviceId)) {
      throw new Error(
        `PlEventEmitter: serviceId must be a verifying service, got ${serviceId}`,
      );
    }
    this.serviceId = serviceId;
    this.producer = kafka.producer();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
  }

  async emit(
    principalId: string,
    event: Omit<PLEvent, 'verifiedBy'>,
  ): Promise<void> {
    await this.ensureConnected();
    const full = { ...event, verifiedBy: this.serviceId } as PLEvent;
    await this.producer.send({
      topic: TOPICS.PL_EVENTS,
      messages: [{ key: principalId, value: JSON.stringify(full) }],
    });
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }
}
