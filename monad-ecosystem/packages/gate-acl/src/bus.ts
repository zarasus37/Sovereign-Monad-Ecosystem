/**
 * In-memory bus producer/consumer stubs — same topic names as Kafka design.
 * Swap for real Kafka without changing gate logic.
 */

import type { TopicName } from './types.js';

export type BusHandler = (topic: TopicName, payload: unknown) => void;

export class InMemoryBus {
  private readonly handlers = new Map<TopicName, BusHandler[]>();
  readonly log: { topic: TopicName; payload: unknown; at: number }[] = [];

  subscribe(topic: TopicName, handler: BusHandler): void {
    const list = this.handlers.get(topic) ?? [];
    list.push(handler);
    this.handlers.set(topic, list);
  }

  publish(topic: TopicName, payload: unknown): void {
    this.log.push({ topic, payload, at: Date.now() });
    for (const h of this.handlers.get(topic) ?? []) {
      h(topic, payload);
    }
  }
}
