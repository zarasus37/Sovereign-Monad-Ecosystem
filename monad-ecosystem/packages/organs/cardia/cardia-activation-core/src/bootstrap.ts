/**
 * Cardia organ bootstrap — sync Redis nonce with chain, start PL consumer.
 */

import {
  attachChainNonceFetcher,
  connectDefaultNonceRedis,
  nonceManager,
} from './redisNonceManager.js';
import { startPlLedgerConsumer } from './plLedgerConsumer.js';

export async function bootstrapCardiaOrgan(opts?: {
  startConsumer?: boolean;
  signal?: AbortSignal;
}): Promise<void> {
  console.log('[Cardia] Booting Organ…');

  const mode = await connectDefaultNonceRedis(nonceManager);
  console.log(`[Cardia] Nonce store: ${mode}`);

  if (process.env.CARDIA_FUNDING_LIVE === 'true') {
    await attachChainNonceFetcher(nonceManager);
    try {
      await nonceManager.syncWithChain();
    } catch (err) {
      console.error(
        '[Cardia] Nonce syncWithChain failed (will retry on first live fund):',
        err,
      );
    }
  } else {
    console.log(
      '[Cardia] CARDIA_FUNDING_LIVE≠true — skipping chain nonce sync (dry-run funding)',
    );
  }

  if (opts?.startConsumer !== false) {
    await startPlLedgerConsumer(undefined, opts?.signal);
  }

  console.log('[Cardia] Organ Live. Awaiting Kafka events.');
}

// ESM entry when run as `node dist/bootstrap.js` or `tsx src/bootstrap.ts`
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('bootstrap.ts') ||
    process.argv[1].endsWith('bootstrap.js'));

if (isMain) {
  bootstrapCardiaOrgan().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
