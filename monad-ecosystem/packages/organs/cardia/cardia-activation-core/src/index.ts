import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { buildCardiaActivationSnapshot, loadLocalCardiaActivationSnapshot } from './snapshot.js';
import {
  CardiaActivationInput,
  CardiaActivationPolicy,
  CardiaActivationRecord,
  CardiaActivationSnapshot,
  CardiaActivationStatus,
} from './types.js';

export { buildCardiaActivationSnapshot, loadLocalCardiaActivationSnapshot };
export type {
  CardiaActivationInput,
  CardiaActivationPolicy,
  CardiaActivationRecord,
  CardiaActivationSnapshot,
  CardiaActivationStatus,
};

import { EventBus } from '@sovereign/bus';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const snapshot = await loadLocalCardiaActivationSnapshot(path.resolve(__dirname, '..', '..'));
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);

  // Wire Cardia to the Sovereign Bus
  const bus = new EventBus({ source: 'cardia-activation-core' });

  if (
    snapshot.status === 'active' ||
    snapshot.status === 'ready_for_guarded_live' ||
    snapshot.status === 'ready_for_funding'
  ) {
    bus.emit('cardia.activated', 'cardia', {
      timestamp: new Date().toISOString(),
      source: 'cardia-activation-core',
      activationState: 'LIVE_FUNDED',
      validatedCapacityUsd: 4000,
      validatorVersion: '0.1.0',
      snapshotId: randomUUID(),
      correlationId: randomUUID(),
      snapshotStatus: snapshot.status,
      executionTruthStatus: snapshot.executionTruthStatus,
      reserveHealthy: snapshot.reserveHealthy,
    });
    process.stdout.write('[cardia-activation-core] cardia.activated emitted on sovereign bus\n');
  }
}

// ESM-compatible entry-point guard
const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(message);
    process.exitCode = 1;
  });
}
