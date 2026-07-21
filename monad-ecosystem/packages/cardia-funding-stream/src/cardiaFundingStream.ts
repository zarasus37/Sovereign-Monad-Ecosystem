/**
 * Cardia Funding SSE Bridge (Vector 4.1 / 4.3 host-mountable).
 *
 * Express router that streams `sovereign.cardia.funding.events` to the UI
 * via Server-Sent Events (X-AUDITABILITY on the wire).
 *
 * Mount under the host:
 *   app.use('/api/v1/cardia', createCardiaFundingStreamRouter());
 *   // → GET /api/v1/cardia/funding/stream/:walletAddress
 *
 * Standalone: `pnpm start` (listens when run as main).
 */

import { Router, type Request, type Response } from 'express';
import { Kafka, type Consumer, type EachMessagePayload } from 'kafkajs';
import type { CardiaFundingKafkaEvent } from '@sovereign/types';

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'localhost:9092')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const KAFKA_ENABLED = process.env.KAFKA_ENABLED === 'true';
const TOPIC = process.env.KAFKA_TOPIC || 'sovereign.cardia.funding.events';
const CONSUMER_GROUP = process.env.KAFKA_GROUP || 'cardia-sse-group';

let sharedConsumer: Consumer | null = null;

function getKafka(): Kafka {
  return new Kafka({
    clientId: 'cardia-sse-bridge',
    brokers: KAFKA_BROKERS.length ? KAFKA_BROKERS : ['localhost:9092'],
  });
}

/**
 * Create an Express router with:
 *   GET /funding/stream/:walletAddress  → SSE
 *   GET /health                         → pulse for this sub-app
 */
export function createCardiaFundingStreamRouter(): Router {
  const router = Router();

  router.get(
    '/funding/stream/:walletAddress',
    async (req: Request, res: Response) => {
      const walletAddress = String(req.params.walletAddress ?? '').toLowerCase();
      if (!walletAddress || !/^0x[a-f0-9]{40}$/i.test(walletAddress)) {
        res.status(400).json({
          error: 'INVALID_WALLET',
          message: 'walletAddress must be a 0x-prefixed 20-byte address',
        });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();

      console.log(`[SSE] Client connected for wallet: ${walletAddress}`);

      res.write(
        `data: ${JSON.stringify({ type: 'CONNECTED', wallet: walletAddress })}\n\n`,
      );

      let cleanup: (() => void) | undefined;

      if (KAFKA_ENABLED) {
        cleanup = await runKafkaConsumer(walletAddress, res);
      } else {
        cleanup = runMockStream(walletAddress, res);
      }

      req.on('close', () => {
        console.log(`[SSE] Client disconnected for wallet: ${walletAddress}`);
        cleanup?.();
      });
    },
  );

  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      kafkaEnabled: KAFKA_ENABLED,
      topic: TOPIC,
    });
  });

  return router;
}

async function runKafkaConsumer(
  walletAddress: string,
  res: Response,
): Promise<() => void> {
  if (!sharedConsumer) {
    sharedConsumer = getKafka().consumer({ groupId: CONSUMER_GROUP });
    await sharedConsumer.connect();
    await sharedConsumer.subscribe({ topic: TOPIC, fromBeginning: false });
  }

  const consumer = sharedConsumer;
  // eachMessage fans out to this response; disconnect stops writing
  let open = true;

  await consumer.run({
    eachMessage: async ({ message }: EachMessagePayload) => {
      if (!open || !message.value) return;
      try {
        const event = JSON.parse(
          message.value.toString(),
        ) as CardiaFundingKafkaEvent;
        if (event.principalWallet?.toLowerCase() === walletAddress) {
          res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
      } catch (err) {
        console.error('[SSE] Parse error:', err);
      }
    },
  });

  return () => {
    open = false;
  };
}

/**
 * Mock SSE stream when Kafka is disabled (local honesty path).
 * Sequence mirrors Cardia mandate statuses (types-aligned).
 */
function runMockStream(walletAddress: string, res: Response): () => void {
  const now = () => new Date().toISOString();
  const base = {
    eventId: 'mock-' + Math.random().toString(36).slice(2, 8),
    mandateId: 'mandate-mock-001',
    principalWallet: walletAddress,
    amount: 15000, // USD
    tier: 'TIER_1_MESHALEACH' as const,
  };

  const mockSequence: CardiaFundingKafkaEvent[] = [
    {
      ...base,
      status: 'PENDING_HEPAR_AUDIT' as const,
      auditTrace: ['mode:mock-sse', 'hepar:audit:start'],
      timestamp: now(),
      synthesized: true,
    },
    {
      ...base,
      status: 'AUDIT_PASSED' as const,
      auditTrace: [
        'mode:mock-sse',
        'hepar:audit:start',
        'hepar:rule:T-NO-SELF-MOD:pass',
        'hepar:audit:pass'
      ],
      timestamp: now(),
      synthesized: true,
    },
    {
      ...base,
      status: 'TX_SYNTHESIZED' as const,
      txHash: '0xabc123def456789012345678901234567890123456789012345678901234',
      auditTrace: [
        'hepar:audit:pass',
        'cardia:tx:building',
        'cardia:tx:synthesized'
      ],
      timestamp: now(),
      blockNumber: 12345678,
      synthesized: true,
    },
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (index < mockSequence.length) {
      const event = { ...mockSequence[index], timestamp: now() };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      index += 1;
    } else {
      // Heartbeat so the stream stays open without inventing new statuses
      res.write(
        `data: ${JSON.stringify({ type: 'HEARTBEAT', wallet: walletAddress, t: now() })}\n\n`,
      );
    }
  }, 2500);

  return () => {
    clearInterval(interval);
  };
}

/** Default router for host mount (path-relative under /api/v1/cardia). */
export const cardiaFundingStreamRouter = createCardiaFundingStreamRouter();

export default cardiaFundingStreamRouter;

// ── Standalone entry (pnpm start / tsx src/cardiaFundingStream.ts) ─────────
async function listenStandalone(): Promise<void> {
  const { default: express } = await import('express');
  const app = express();
  const PORT = Number(process.env.PORT) || 3002;

  app.use('/api/v1/cardia', createCardiaFundingStreamRouter());
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'cardia-funding-stream-standalone' });
  });

  app.listen(PORT, () => {
    console.log(
      `[Cardia SSE] Standalone on :${PORT} (kafka=${KAFKA_ENABLED}) topic=${TOPIC}`,
    );
    console.log(
      `  GET /api/v1/cardia/funding/stream/:walletAddress`,
    );
  });
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('cardiaFundingStream.ts') ||
    process.argv[1].endsWith('cardiaFundingStream.js'));

if (isMain) {
  listenStandalone().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
