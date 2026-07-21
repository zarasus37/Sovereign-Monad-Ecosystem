/**
 * Wallet bind service — verify EIP-191 + PL threshold, emit Kafka bind event.
 */

import type { Kafka } from 'kafkajs';
import { createKafka, KafkaBusProducer } from './kafkaBus.js';
import type { PLLedger } from './plLedger.js';
import { TOPICS } from './types.js';
import {
  buildWalletBindEvent,
  PrincipalWalletRegistry,
  verifyWalletBind,
  type WalletBindKafkaPayload,
  type WalletBindRequest,
} from './walletBind.js';

export type WalletBindDeps = {
  ledger: PLLedger;
  registry?: PrincipalWalletRegistry;
  kafka?: Kafka | null;
  kafkaEnabled?: boolean;
};

export type WalletBindServiceResult =
  | {
      ok: true;
      status: 'WALLET_BOUND_AND_BROADCAST' | 'WALLET_BOUND_LOCAL';
      walletAddress: string;
      event: WalletBindKafkaPayload;
      kafkaEnabled: boolean;
    }
  | {
      ok: false;
      status: number;
      error: string;
      message: string;
    };

export async function bindWallet(
  req: WalletBindRequest,
  deps: WalletBindDeps,
  now = Date.now(),
): Promise<WalletBindServiceResult> {
  const verified = verifyWalletBind(req, deps.ledger, { now });
  if (!verified.ok) {
    const status =
      verified.error === 'SIGNATURE_MISMATCH' ||
      verified.error === 'INSUFFICIENT_PL'
        ? 403
        : 400;
    return {
      ok: false,
      status,
      error: verified.error,
      message: verified.message,
    };
  }

  const event = buildWalletBindEvent(req, verified, now);
  deps.registry?.bind(req.localPrincipalId, req.walletAddress);

  const kafkaEnabled =
    deps.kafkaEnabled === true || process.env.KAFKA_ENABLED === 'true';
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
      // Cardia funding trigger
      await bus.publish(TOPICS.PL_LEDGER_EVENTS, req.walletAddress, event);
      // Also surface as PL state snapshot under wallet principal (score copy)
      await bus.publish(TOPICS.PL_STATE_UPDATED, req.walletAddress, {
        principalId: req.walletAddress,
        domain: verified.domain,
        score: verified.totalPl,
        lastUpdated: now,
        components: {
          comprehensionGates: [],
          validOverrides: [],
          domainTasksCompleted: [],
          logocPaperTrades: [],
          dailyReviews: [],
        },
        walletBound: true,
        localPrincipalId: req.localPrincipalId,
      });
      await bus.disconnect();
      return {
        ok: true,
        status: 'WALLET_BOUND_AND_BROADCAST',
        walletAddress: req.walletAddress,
        event,
        kafkaEnabled: true,
      };
    } catch (err) {
      console.error('[Wallet Bind] Kafka emission failed:', err);
      return {
        ok: false,
        status: 500,
        error: 'KAFKA_EMISSION_FAILED',
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

  console.log('[Local Dev] Wallet Bound Event Synthesized:', event);
  return {
    ok: true,
    status: 'WALLET_BOUND_LOCAL',
    walletAddress: req.walletAddress,
    event,
    kafkaEnabled: false,
  };
}

/** Node/Azure/Express-agnostic HTTP body handler. */
export async function bindWalletHttp(
  body: unknown,
  deps: WalletBindDeps,
): Promise<{ status: number; json: unknown }> {
  if (!body || typeof body !== 'object') {
    return {
      status: 400,
      json: { error: 'MISSING_PARAMETERS', message: 'JSON body required' },
    };
  }
  const out = await bindWallet(body as WalletBindRequest, deps);
  if (!out.ok) {
    return {
      status: out.status,
      json: { error: out.error, message: out.message },
    };
  }
  return {
    status: 200,
    json: {
      status: out.status,
      walletAddress: out.walletAddress,
      event: out.event,
      kafkaEnabled: out.kafkaEnabled,
    },
  };
}
