/**
 * Broadcast sovereign loop events (Kafka behind KAFKA_ENABLED).
 */

import type { SovereignLoopEvent } from '@sovereign/types';
import { SOVEREIGN_LOOP_TOPIC } from '@sovereign/types';

export async function broadcastLoopEvent(
  event: SovereignLoopEvent,
): Promise<void> {
  console.log('[Sovereign Loop]', event.kind, event.reason);

  if (process.env.KAFKA_ENABLED !== 'true') {
    return;
  }

  try {
    const { Kafka } = await import('kafkajs');
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const kafka = new Kafka({ clientId: 'monad-mev-loop', brokers });
    const producer = kafka.producer();
    await producer.connect();
    await producer.send({
      topic: SOVEREIGN_LOOP_TOPIC,
      messages: [
        {
          key: event.mandateId ?? event.tradeId ?? event.kind,
          value: JSON.stringify(event),
        },
      ],
    });
    await producer.disconnect();
  } catch (err) {
    console.error('[Sovereign Loop] Kafka broadcast failed:', err);
  }
}
