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

export {
  evaluatePlForTier1,
  TIER_1_THRESHOLD,
  TIER_1_CAPITAL_USD,
  type CardiaPlLedgerEvent,
  type CardiaPlUnlockResult,
} from './plUnlock.js';
export {
  handlePlLedgerMessage,
  startPlLedgerConsumer,
  type UnlockCapitalFn,
  type FundingTriggerFn,
} from './plLedgerConsumer.js';
export {
  executeFunding,
  mandateFromWalletBind,
  resetFundingNonceForTests,
  type FundingEngineDeps,
  type FundingBroadcastFn,
} from './cardiaFundingEngine.js';
export {
  heparAuditClient,
  auditAddress,
  type HeparAddressAuditResult,
  type HeparAuditFn,
} from './heparAuditClient.js';
export type {
  FundingStatus,
  FundingMandate,
  CardiaFundingKafkaEvent,
} from './cardiaFunding.types.js';
export {
  CARDIA_FUNDING_TOPIC,
  TIER_1_FUNDING_USD,
} from './cardiaFunding.types.js';

import { EventBus } from '@sovereign/bus';
import type { EventTrace } from '@sovereign/types';

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
    const activatedAt = new Date().toISOString();
    const snapshotId = randomUUID();
    const trace: EventTrace = {
      intentionId: `cardia-activation-${snapshotId}`,
      source: 'cardia-activation-core',
      createdAt: activatedAt,
    };
    bus.emit('cardia.activated', 'cardia', {
      timestamp: activatedAt,
      source: 'cardia-activation-core',
      activationState: 'LIVE_FUNDED',
      validatedCapacityUsd: 4000,
      validatorVersion: '0.1.0',
      snapshotId,
      correlationId: randomUUID(),
      snapshotStatus: snapshot.status,
      executionTruthStatus: snapshot.executionTruthStatus,
      reserveHealthy: snapshot.reserveHealthy,
    }, { trace });
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
