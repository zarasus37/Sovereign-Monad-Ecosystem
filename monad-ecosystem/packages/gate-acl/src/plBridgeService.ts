/**
 * PL promote service — verify claim, append PLLedger, publish Kafka topics.
 *
 * KAFKA_ENABLED=true + KAFKA_BROKERS → real emit.
 * Otherwise PL_LOCAL_SYNTHESIS (honest local mode).
 */

import type { Kafka } from 'kafkajs';
import { createKafka, KafkaBusProducer } from './kafkaBus.js';
import {
  buildPlLedgerKafkaEvent,
  toPlEvent,
  verifyPlPromoteClaim,
} from './plBridge.js';
import type { PlPromoteClaim, PlPromoteResult } from './plBridge.types.js';
import { PLLedger } from './plLedger.js';
import { TOPICS } from './types.js';

export type PlBridgeDeps = {
  ledger: PLLedger;
  /** Optional live Kafka. */
  kafka?: Kafka | null;
  kafkaEnabled?: boolean;
};

/**
 * Promote a client claim to verified PL.
 * Server recalculates totalPl; client currentPl is a hint only.
 */
export async function promotePl(
  claim: PlPromoteClaim,
  deps: PlBridgeDeps,
  now = Date.now(),
): Promise<
  | { ok: true; result: PlPromoteResult }
  | { ok: false; status: number; error: string; message: string }
> {
  const verified = verifyPlPromoteClaim(claim);
  if (!verified.ok) {
    return {
      ok: false,
      status: 400,
      error: verified.error,
      message: verified.message,
    };
  }

  const domain = claim.domain ?? 'agent_ops';
  const serverState = deps.ledger.compute(claim.principalId, domain, now);
  const serverCurrentPl = serverState.score;

  const kafkaEvent = buildPlLedgerKafkaEvent(
    claim,
    verified,
    serverCurrentPl,
    now,
  );

  // Append to server ledger (rejects client verifiedBy by construction)
  const plEvent = toPlEvent(kafkaEvent, now);
  try {
    deps.ledger.append(plEvent, now);
  } catch (err) {
    return {
      ok: false,
      status: 400,
      error: 'LEDGER_APPEND_FAILED',
      message: err instanceof Error ? err.message : String(err),
    };
  }

  // Recompute authoritative total after append
  const after = deps.ledger.compute(claim.principalId, domain, now);
  kafkaEvent.totalPl = after.score;

  const kafkaEnabled =
    deps.kafkaEnabled === true ||
    process.env.KAFKA_ENABLED === 'true';
  const kafka =
    deps.kafka ??
    (kafkaEnabled
      ? createKafka(
          (process.env.KAFKA_BROKERS || 'localhost:9092')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        )
      : null);

  if (kafkaEnabled && kafka) {
    try {
      const bus = new KafkaBusProducer(kafka);
      await bus.connect();
      // pl.events → PlLedgerService consumers (organism-wide)
      await bus.publish(TOPICS.PL_EVENTS, claim.principalId, plEvent);
      // Rich Cardia / multi-organ broadcast
      await bus.publish(TOPICS.PL_LEDGER_EVENTS, claim.principalId, kafkaEvent);
      await bus.publish(TOPICS.PL_STATE_UPDATED, claim.principalId, after);
      await bus.disconnect();
      return {
        ok: true,
        result: {
          status: 'PL_BROADCAST_SUCCESS',
          event: kafkaEvent,
          kafkaEnabled: true,
        },
      };
    } catch (err) {
      console.error('[Kafka PL Bridge] Emission failed:', err);
      return {
        ok: false,
        status: 500,
        error: 'KAFKA_EMISSION_FAILED',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  console.log('[Local Dev] PL Event Synthesized:', kafkaEvent);
  return {
    ok: true,
    result: {
      status: 'PL_LOCAL_SYNTHESIS',
      event: kafkaEvent,
      kafkaEnabled: false,
    },
  };
}

/**
 * Node http-style handler body (no Express dep).
 * Use with Azure Function, Express, or fetch adapter:
 *   const body = await promotePlHttp(JSON.parse(req.body), ledger)
 */
export async function promotePlHttp(
  body: unknown,
  deps: PlBridgeDeps,
): Promise<{ status: number; json: unknown }> {
  if (!body || typeof body !== 'object') {
    return {
      status: 400,
      json: { error: 'INVALID_BODY', message: 'JSON claim required' },
    };
  }
  const claim = body as PlPromoteClaim;
  const out = await promotePl(claim, deps);
  if (!out.ok) {
    return {
      status: out.status,
      json: { error: out.error, message: out.message },
    };
  }
  return { status: 200, json: out.result };
}
