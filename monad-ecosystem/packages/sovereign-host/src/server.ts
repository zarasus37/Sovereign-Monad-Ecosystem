/**
 * Executable entry — boots the Sovereign HTTP host (Vector 4.3).
 *
 *   pnpm --filter @sovereign/host start
 *   # or: tsx src/server.ts
 */

import { createSovereignApp } from './app.js';
import { startMetricsKafkaConsumer } from './metricsKafka.js';
import { getBootstrapWallet, isKeyCustodyConfigured } from './lib/keyCustody.js';
import { bootstrapCardiaOrgan, loadLocalCardiaActivationSnapshot } from '@sovereign/cardia-activation-core';

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

// P0: host auth is mandatory in non-test environments. createSovereignApp()
// throws if SOVEREIGN_API_TOKEN or SOVEREIGN_PRINCIPAL_ID are unset outside
// NODE_ENV=test, so the server entrypoint should either provide them or be
// in a test harness.
const apiToken = process.env.SOVEREIGN_API_TOKEN;
const principalId = process.env.SOVEREIGN_PRINCIPAL_ID;
if (process.env.NODE_ENV !== 'test' && (!apiToken || !principalId)) {
  console.error(
    '[Sovereign Host] FATAL: SOVEREIGN_API_TOKEN and SOVEREIGN_PRINCIPAL_ID are required.',
  );
  process.exit(1);
}

const { app, kafkaEnabled } = createSovereignApp({
  apiToken,
  principalId,
});

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

  // Cardia activation core (Vector 3.3) — bootstrap on host startup.
  // Gated by CARDIA_FUNDING_LIVE: the organ is mounted either way, but the
  // chain-nonce sync and live-funding path are only enabled when LIVE=true.
  // On dry-run, this is harmless: it just connects to the nonce store and
  // starts the PL consumer (still useful for emitting funding events).
  void bootstrapCardiaOrgan().catch((err) => {
    console.error('[Cardia Organ] bootstrap failed:', (err as Error).message);
  });

  app.listen(PORT, () => {
    console.log(`[Sovereign Host] Listening on port ${PORT}`);
    console.log(`[Sovereign Host] CORS Origin: ${frontendOrigin}`);
    console.log(`[Sovereign Host] Kafka Enabled: ${kafkaEnabled}`);
    console.log(`[Sovereign Host] Redis: ${process.env.REDIS_URL ? 'set' : 'unset'}`);
    console.log(
      `[Sovereign Host] Live funding: ${process.env.CARDIA_FUNDING_LIVE === 'true'}`,
    );
    // Cardia activation core — log the activation snapshot for the operator.
    void loadLocalCardiaActivationSnapshot(process.cwd()).then((snap) => {
      console.log(
        `[Cardia Engine] status=${snap.status} reserveHealthy=${snap.reserveHealthy}`,
      );
    }).catch(() => {
      /* snapshot read is best-effort */
    });
    console.log(`[Sovereign Host] Auth: required (principal=${principalId})`);
    console.log(`  POST /api/v1/gate-acl/promote-pl       (auth)`);
    console.log(`  POST /api/v1/gate-acl/bind-wallet      (auth)`);
    console.log(`  GET  /api/v1/cardia/funding/stream/:walletAddress  (auth)`);
    console.log(`  POST /api/v1/cardia/funding/trigger    (auth, gated by CARDIA_FUNDING_LIVE)`);
    console.log(`  POST /api/v1/metrics/ingest            (auth)`);
    console.log(`  POST /api/v1/hepar/audit               (proxy)`);
    console.log(`  GET  /metrics                          (public)`);
    console.log(`  GET  /health                           (public, liveness only)`);
    console.log(`  GET  /health/details                   (auth, full diagnostics)`);
  });
}

/** Export app for Azure Functions adapter / tests. */
export { app };
