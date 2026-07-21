/**
 * Executable entry — boots the Sovereign HTTP host (Vector 4.3).
 *
 *   pnpm --filter @sovereign/host start
 *   # or: tsx src/server.ts
 */

import { createSovereignApp } from './app.js';
import { startMetricsKafkaConsumer } from './metricsKafka.js';
import { getBootstrapWallet, isKeyCustodyConfigured } from './lib/keyCustody.js';

export { createSovereignApp } from './app.js';
export type { SovereignAppOptions, SovereignAppContext } from './app.js';
export {
  renderPrometheusText,
  recordFundingEvent,
  recordCapacityEvent,
  recordLoopEvent,
  recordShadowVerdict,
} from './metrics.js';

const PORT = Number(process.env.PORT) || 3001;
const frontendOrigin =
  process.env.FRONTEND_URL || 'http://localhost:5173';

const { app, kafkaEnabled } = createSovereignApp();

// Only listen when this file is the process entry (not when imported by Azure wrapper)
const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') ||
    process.argv[1].endsWith('server.js'));

if (isMain) {
  // Bootstrap key from Key Vault via MSI (fails fast if misconfigured)
  if (isKeyCustodyConfigured()) {
    try {
      const wallet = await getBootstrapWallet();
      console.log(`[Key Custody] Bootstrap wallet: ${wallet.address}`);
    } catch (err) {
      console.error('[Key Custody] FAILED to fetch bootstrap key from Key Vault:', (err as Error).message);
      process.exit(1);
    }
  } else if (!process.env.BOOTSTRAP_PRIVATE_KEY) {
    console.warn('[Key Custody] WARNING: No bootstrap key configured (KV not set up, BOOTSTRAP_PRIVATE_KEY not set)');
  }

  void startMetricsKafkaConsumer().then((handle) => {
    if (handle) {
      const shutdown = () => {
        void handle.stop().finally(() => process.exit(0));
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    }
  });

  app.listen(PORT, () => {
    console.log(`[Sovereign Host] Listening on port ${PORT}`);
    console.log(`[Sovereign Host] CORS Origin: ${frontendOrigin}`);
    console.log(`[Sovereign Host] Kafka Enabled: ${kafkaEnabled}`);
    console.log(`[Sovereign Host] Redis: ${process.env.REDIS_URL ? 'set' : 'unset'}`);
    console.log(
      `[Sovereign Host] Live funding: ${process.env.CARDIA_FUNDING_LIVE === 'true'}`,
    );
    console.log(`  POST /api/v1/gate-acl/promote-pl`);
    console.log(`  POST /api/v1/gate-acl/bind-wallet`);
    console.log(`  GET  /api/v1/cardia/funding/stream/:walletAddress`);
    console.log(`  GET  /metrics`);
    console.log(`  GET  /health`);
  });
}

/** Export app for Azure Functions adapter / tests. */
export { app };
