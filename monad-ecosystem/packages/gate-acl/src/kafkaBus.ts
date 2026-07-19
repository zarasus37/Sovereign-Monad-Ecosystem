/**
 * Kafka bus producer + intent consumer — topic names from schemas/topics.md.
 * Depends on `kafkajs` (optional for pure in-memory demo).
 */

import { Kafka, type Consumer, type EachMessagePayload, type Producer } from 'kafkajs';
import type { BusProducer } from './ports.js';
import { TOPICS, type IntentRaised, type TopicName } from './types.js';

export { TOPICS };

export function createKafka(brokers: string[], clientId = 'gate-acl'): Kafka {
  return new Kafka({
    clientId,
    brokers,
    retry: { retries: 8 },
  });
}

export class KafkaBusProducer implements BusProducer {
  private producer: Producer;
  private connected = false;

  constructor(private readonly kafka: Kafka) {
    this.producer = kafka.producer();
  }

  async connect(): Promise<void> {
    if (!this.connected) {
      await this.producer.connect();
      this.connected = true;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.producer.disconnect();
      this.connected = false;
    }
  }

  async publish(topic: TopicName, key: string, payload: unknown): Promise<void> {
    await this.connect();
    await this.producer.send({
      topic,
      messages: [
        {
          key,
          value: JSON.stringify(payload),
        },
      ],
    });
  }
}

/**
 * Consume intent.raised → invoke handler (typically GateAclService.gate + publish result).
 * Runs until aborted.
 */
export async function consumeIntentRaised(
  kafka: Kafka,
  groupId: string,
  handler: (intent: IntentRaised) => Promise<void>,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const consumer: Consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPICS.INTENT_RAISED, fromBeginning: false });

  const run = consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!message.value) return;
      const intent = JSON.parse(message.value.toString('utf8')) as IntentRaised;
      await handler(intent);
    },
  });

  if (opts?.signal) {
    opts.signal.addEventListener('abort', () => {
      void consumer.disconnect();
    });
  }

  await run;
}

/** Generic JSON consumer for a single topic. */
export async function consumeTopic(
  kafka: Kafka,
  topic: TopicName,
  groupId: string,
  handler: (payload: unknown, key: string | null) => Promise<void>,
  opts?: { signal?: AbortSignal },
): Promise<void> {
  const consumer = kafka.consumer({ groupId });
  await consumer.connect();
  await consumer.subscribe({ topic, fromBeginning: false });

  const run = consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const payload: unknown = JSON.parse(message.value.toString('utf8'));
      await handler(payload, message.key?.toString() ?? null);
    },
  });

  if (opts?.signal) {
    opts.signal.addEventListener('abort', () => {
      void consumer.disconnect();
    });
  }

  await run;
}
