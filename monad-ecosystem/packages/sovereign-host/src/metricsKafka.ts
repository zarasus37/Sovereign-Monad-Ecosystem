/**
 * Kafka → Prometheus metrics bridge (Vector 6.3).
 *
 * Subscribes to organism event topics when KAFKA_ENABLED=true.
 * When Kafka is off, call record* helpers from process-local emitters
 * or POST /api/v1/metrics/ingest (dev injection).
 */

import {
  CARDIA_FUNDING_TOPIC,
  CAPACITY_CEILING_TOPIC,
  SOVEREIGN_LOOP_TOPIC,
} from '@sovereign/types';
import {
  kafkaMessagesTotal,
  recordCapacityBurn,
  recordCapacityEvent,
  recordFundingEvent,
  recordLoopEvent,
} from './metrics.js';

export const OBSERVABILITY_TOPICS = [
  CARDIA_FUNDING_TOPIC,
  CAPACITY_CEILING_TOPIC,
  SOVEREIGN_LOOP_TOPIC,
] as const;

export type MetricsKafkaHandle = {
  stop: () => Promise<void>;
};

/**
 * Start a kafkajs consumer that feeds the Prometheus registry.
 * No-ops (returns null handle) when KAFKA_ENABLED is not true.
 */
export async function startMetricsKafkaConsumer(opts?: {
  brokers?: string[];
  groupId?: string;
  topics?: string[];
}): Promise<MetricsKafkaHandle | null> {
  if (process.env.KAFKA_ENABLED !== 'true') {
    console.log(
      '[Observability] KAFKA_ENABLED≠true — metrics Kafka consumer idle (scrape still serves /metrics)',
    );
    return null;
  }

  const brokers = (
    opts?.brokers ??
    (process.env.KAFKA_BROKERS || 'localhost:9092').split(',')
  )
    .map((s) => s.trim())
    .filter(Boolean);
  const groupId =
    opts?.groupId ?? process.env.METRICS_KAFKA_GROUP ?? 'sovereign-observability';
  const topics = opts?.topics ?? [...OBSERVABILITY_TOPICS];

  try {
    const { Kafka } = await import('kafkajs');
    const kafka = new Kafka({ clientId: 'sovereign-metrics', brokers });
    const consumer = kafka.consumer({ groupId });
    await consumer.connect();
    for (const topic of topics) {
      await consumer.subscribe({ topic, fromBeginning: false });
    }

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return;
        kafkaMessagesTotal.inc({ topic });
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(message.value.toString('utf8')) as Record<
            string,
            unknown
          >;
        } catch {
          return;
        }
        ingestKafkaPayload(topic, payload);
      },
    });

    console.log(
      `[Observability] Kafka consumer live group=${groupId} topics=${topics.join(',')}`,
    );

    return {
      stop: async () => {
        await consumer.disconnect();
      },
    };
  } catch (err) {
    console.error('[Observability] Kafka consumer failed to start:', err);
    return null;
  }
}

/** Route a parsed Kafka JSON payload to metric recorders. */
export function ingestKafkaPayload(
  topic: string,
  payload: Record<string, unknown>,
): void {
  if (topic === CARDIA_FUNDING_TOPIC || topic.includes('cardia.funding')) {
    recordFundingEvent({
      mandateId: str(payload.mandateId),
      status: str(payload.status),
      timestamp: str(payload.timestamp),
      auditTrace: strArr(payload.auditTrace),
    });
    return;
  }

  if (topic === CAPACITY_CEILING_TOPIC || topic.includes('capacity.ceiling')) {
    recordCapacityEvent({
      kind: str(payload.kind),
      remainingAllocationUsd: num(payload.remainingAllocationUsd),
      reason: str(payload.reason),
    });
    // If payload carries notional via capitalConsumed-style field
    const burn =
      num(payload.capitalConsumedUsd) ??
      num((payload as { notionalUsd?: unknown }).notionalUsd);
    if (burn && burn > 0 && str(payload.kind) === 'TRADE_RECORDED') {
      recordCapacityBurn(burn);
    }
    return;
  }

  if (topic === SOVEREIGN_LOOP_TOPIC || topic.includes('execution.loop')) {
    recordLoopEvent({
      kind: str(payload.kind),
      grossYield: num(payload.grossYield),
      distribution: payload.distribution as {
        splits?: {
          principal?: number;
          shaliahTreasury?: number;
          ecosystemVault?: number;
        };
      },
      reason: str(payload.reason),
      auditTrace: strArr(payload.auditTrace),
    });
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function strArr(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === 'string');
}
