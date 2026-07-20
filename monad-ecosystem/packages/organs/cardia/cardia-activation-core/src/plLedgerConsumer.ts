/**
 * Cardia consumer for sovereign.pl.ledger.events.
 *
 * Optional kafkajs path — only connects when KAFKA_ENABLED=true.
 * Core unlock decision is pure (plUnlock.ts).
 */

import { evaluatePlForTier1, type CardiaPlLedgerEvent } from './plUnlock.js';

const TOPIC = 'sovereign.pl.ledger.events';

export type UnlockCapitalFn = (
  principalId: string,
  capitalUsd: number,
  mandate: string,
) => Promise<void> | void;

/**
 * Handle one PL ledger message (unit-testable without Kafka).
 */
export function handlePlLedgerMessage(
  raw: unknown,
  unlockCapital?: UnlockCapitalFn,
): ReturnType<typeof evaluatePlForTier1> | null {
  if (!raw || typeof raw !== 'object') return null;
  const event = raw as CardiaPlLedgerEvent;
  if (!event.principalId || typeof event.totalPl !== 'number') return null;

  console.log(
    `[Cardia] Received PL Update for ${event.principalId}. Total PL: ${event.totalPl}`,
  );

  const result = evaluatePlForTier1(event);
  if (result.unlocked) {
    console.log(
      `[Cardia] Principal ${result.principalId} crossed Tier 1 threshold — unlock $${result.capitalUsd} (${result.mandate})`,
    );
    void unlockCapital?.(result.principalId, result.capitalUsd, result.mandate);
  } else {
    console.log(
      `[Cardia] Principal ${result.principalId}: ${result.reason}`,
    );
  }
  return result;
}

/**
 * Long-running Kafka consumer. No-ops with log if KAFKA_ENABLED is not true.
 */
export async function startPlLedgerConsumer(
  unlockCapital?: UnlockCapitalFn,
  signal?: AbortSignal,
): Promise<void> {
  if (process.env.KAFKA_ENABLED !== 'true') {
    console.log(
      '[Cardia] KAFKA_ENABLED≠true — pl ledger consumer not started (local/dev)',
    );
    return;
  }

  // Dynamic import so cardia package builds without kafkajs when unused
  const { Kafka } = await import('kafkajs');
  const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const kafka = new Kafka({ clientId: 'cardia-organ', brokers });
  const consumer = kafka.consumer({ groupId: 'cardia-pl-ledger-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: TOPIC, fromBeginning: false });

  if (signal) {
    signal.addEventListener('abort', () => {
      void consumer.disconnect();
    });
  }

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      try {
        const event = JSON.parse(message.value.toString('utf8'));
        handlePlLedgerMessage(event, unlockCapital);
      } catch (err) {
        console.error('[Cardia] PL message parse/handle failed:', err);
      }
    },
  });
}
