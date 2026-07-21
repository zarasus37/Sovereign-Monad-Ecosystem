/**
 * Capacity ceiling event emission — local log + optional Kafka / sovereign-bus.
 * Kafka only when KAFKA_ENABLED=true (same honesty pattern as Cardia / gate-acl).
 */

import type { CapacityCeilingEvent, SignalEventType } from '@sovereign/types';
import { CAPACITY_CEILING_TOPIC } from '@sovereign/types';

const KIND_TO_SIGNAL: Record<
  CapacityCeilingEvent['kind'],
  SignalEventType | null
> = {
  CAPACITY_EXHAUSTED: 'capacity.ceiling.exhausted',
  DENSITY_FLOOR_HALT: 'capacity.ceiling.density_halt',
  THROTTLE_ACTIVE: 'capacity.ceiling.throttle',
  TRADE_RECORDED: 'capacity.ceiling.trade_recorded',
  CEILING_RESET: null,
  TOP_UP: null,
};

export type CapacityEmitFn = (
  event: CapacityCeilingEvent,
) => void | Promise<void>;

/**
 * Default broadcaster: always logs; Kafka when enabled; bus when available.
 */
export async function defaultCapacityCeilingEmit(
  event: CapacityCeilingEvent,
): Promise<void> {
  console.log('[CapacityCeiling]', event.kind, event.reason, {
    remainingUsd: event.remainingAllocationUsd,
    avgSlippage: event.avgSlippage,
  });

  // Optional in-process bus (never throws package load if bus fails)
  try {
    const signalType = KIND_TO_SIGNAL[event.kind];
    if (signalType) {
      const { sovereignBus } = await import('@sovereign/bus');
      sovereignBus.emit(signalType, 'cardia', event, {
        source: 'monad-mev-capacity-ceiling',
      });
    }
  } catch (err) {
    console.warn('[CapacityCeiling] bus emit skipped:', err);
  }

  if (process.env.KAFKA_ENABLED !== 'true') {
    return;
  }

  try {
    const { Kafka } = await import('kafkajs');
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const kafka = new Kafka({ clientId: 'monad-mev-capacity', brokers });
    const producer = kafka.producer();
    await producer.connect();
    await producer.send({
      topic: CAPACITY_CEILING_TOPIC,
      messages: [
        {
          key: event.principalWallet ?? event.kind,
          value: JSON.stringify(event),
        },
      ],
    });
    await producer.disconnect();
  } catch (err) {
    console.error('[CapacityCeiling] Kafka emit failed:', err);
  }
}
