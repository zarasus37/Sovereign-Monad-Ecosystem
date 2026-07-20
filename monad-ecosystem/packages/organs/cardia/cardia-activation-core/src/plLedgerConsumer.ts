/**
 * Cardia consumer for sovereign.pl.ledger.events.
 *
 * On wallet-bind-tier1-activation + PL ≥ 50 → Funding Engine (Hepar-gated).
 * Optional kafkajs — only when KAFKA_ENABLED=true.
 */

import {
  executeFunding,
  mandateFromWalletBind,
} from './cardiaFundingEngine.js';
import type { FundingMandate } from './cardiaFunding.types.js';
import {
  evaluatePlForTier1,
  TIER_1_THRESHOLD,
  type CardiaPlLedgerEvent,
} from './plUnlock.js';

const TOPIC = 'sovereign.pl.ledger.events';

export type UnlockCapitalFn = (
  principalId: string,
  capitalUsd: number,
  mandate: string,
) => Promise<void> | void;

export type FundingTriggerFn = (mandate: FundingMandate) => Promise<void> | void;

/**
 * Handle one PL ledger message (unit-testable without Kafka).
 * Returns unlock evaluation; may fire funding engine async.
 */
export function handlePlLedgerMessage(
  raw: unknown,
  unlockCapital?: UnlockCapitalFn,
  fundingTrigger?: FundingTriggerFn,
): ReturnType<typeof evaluatePlForTier1> | null {
  if (!raw || typeof raw !== 'object') return null;
  const event = raw as CardiaPlLedgerEvent & { taskId?: string };
  if (!event.principalId || typeof event.totalPl !== 'number') return null;

  console.log(
    `[Cardia] Received PL Update for ${event.principalId}. Total PL: ${event.totalPl} task=${event.taskId ?? '—'}`,
  );

  const result = evaluatePlForTier1(event);

  // Trigger funding ONLY on cryptographic wallet bind + threshold
  if (
    event.taskId === 'wallet-bind-tier1-activation' &&
    event.totalPl >= TIER_1_THRESHOLD &&
    event.verifiedBy !== 'client'
  ) {
    console.log(
      `[Cardia Consumer] Wallet Bind detected for ${event.principalId}. Initiating Funding Engine.`,
    );
    const mandate = mandateFromWalletBind({
      principalWallet: event.principalId,
      priorTrace: [
        `kafka:consume:pl.ledger.events`,
        `cardia:evaluate:tier_1_threshold_met:pl=${event.totalPl}`,
      ],
    });
    const run = fundingTrigger
      ? fundingTrigger(mandate)
      : executeFunding(mandate);
    void Promise.resolve(run).catch((err) => {
      console.error('[Cardia Consumer] Funding engine error:', err);
    });
  }

  if (result.unlocked) {
    console.log(
      `[Cardia] Principal ${result.principalId} Tier-1 eligible — $${result.capitalUsd} (${result.mandate})`,
    );
    void unlockCapital?.(result.principalId, result.capitalUsd, result.mandate);
  } else {
    console.log(`[Cardia] Principal ${result.principalId}: ${result.reason}`);
  }
  return result;
}

/**
 * Long-running Kafka consumer. No-ops with log if KAFKA_ENABLED is not true.
 */
export async function startPlLedgerConsumer(
  unlockCapital?: UnlockCapitalFn,
  signal?: AbortSignal,
  fundingTrigger?: FundingTriggerFn,
): Promise<void> {
  if (process.env.KAFKA_ENABLED !== 'true') {
    console.log(
      '[Cardia] KAFKA_ENABLED≠true — pl ledger consumer not started (local/dev)',
    );
    return;
  }

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
        handlePlLedgerMessage(event, unlockCapital, fundingTrigger);
      } catch (err) {
        console.error('[Cardia] PL message parse/handle failed:', err);
      }
    },
  });
}
