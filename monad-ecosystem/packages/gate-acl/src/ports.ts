/**
 * Swap points for Kafka / Redis without changing gate logic.
 * In-memory and demo paths use the same interfaces.
 */

import type { ACLMandate, TopicName } from './types.js';

export interface BusProducer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Key is principalId (per-principal ordering). */
  publish(topic: TopicName, key: string, payload: unknown): Promise<void>;
}

export interface MandateStore {
  /** Store mandate; Redis TTL should match mandate.expiresAt. */
  put(mandate: ACLMandate): Promise<void>;
  /**
   * Fetch current mandate for principal.
   * @param domain when multi-domain store is ready, scopes the key; optional for now.
   */
  get(principalId: string, domain?: string): Promise<ACLMandate | null>;
  delete(principalId: string, domain?: string): Promise<void>;
}
