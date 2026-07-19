/**
 * Runtime entrypoint — wires PL ledger, mandate issuer, and intent gate consumers.
 *
 * Env:
 *   KAFKA_BROKERS              comma-separated, e.g. localhost:9092
 *   REDIS_URL                  e.g. redis://localhost:6379
 *   GATE_ACL_SIGNING_SECRET    required when GATE_ACL_REQUIRE_SECRET=1 or NODE_ENV=production
 *   GATE_ACL_REQUIRE_SECRET    set to 1 to hard-fail without secret (recommended past local)
 *   GATE_ACL_EXECUTE_ON_APPROVE  set to 1 to run Executor at consume time in this process
 */

import { createKafka, KafkaBusProducer } from './kafkaBus.js';
import { GateIntentService } from './gateIntentService.js';
import { MandateIssuer, resolveSigningSecret } from './mandateIssuer.js';
import { MandateService } from './mandateService.js';
import { PLLedger } from './plLedger.js';
import { PlLedgerService } from './plLedgerService.js';
import {
  createRedisFromUrl,
  InMemoryMandateStore,
  RedisMandateStore,
} from './redisMandateStore.js';

function requireSecret(): string {
  const requireHard =
    process.env.GATE_ACL_REQUIRE_SECRET === '1' ||
    process.env.NODE_ENV === 'production';
  const fromEnv = process.env.GATE_ACL_SIGNING_SECRET;
  if (requireHard && !fromEnv) {
    throw new Error(
      'GATE_ACL_SIGNING_SECRET must be set (GATE_ACL_REQUIRE_SECRET=1 or NODE_ENV=production). ' +
        'Dev fallback is not allowed for real mandate signing.',
    );
  }
  return resolveSigningSecret(fromEnv);
}

async function main(): Promise<void> {
  const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const redisUrl = process.env.REDIS_URL;
  const secret = requireSecret();

  console.log('[gate-acl] starting runtime');
  console.log(`[gate-acl] KAFKA_BROKERS=${brokers.join(',')}`);
  console.log(`[gate-acl] REDIS_URL=${redisUrl ? '(set)' : '(unset → InMemoryMandateStore)'}`);

  const kafka = createKafka(brokers, 'gate-acl-runtime');
  const bus = new KafkaBusProducer(kafka);
  await bus.connect();

  const store = redisUrl
    ? new RedisMandateStore(createRedisFromUrl(redisUrl))
    : new InMemoryMandateStore();
  if (!redisUrl) {
    console.warn(
      '[gate-acl] REDIS_URL unset — using InMemoryMandateStore (not multi-instance safe)',
    );
  }

  const ledger = new PLLedger();
  const issuer = new MandateIssuer({ secret });
  const plService = new PlLedgerService(ledger, bus);
  const mandateService = new MandateService(issuer, store, bus);
  const intentService = new GateIntentService(
    issuer,
    bus,
    process.env.GATE_ACL_EXECUTE_ON_APPROVE === '1',
  );

  const ac = new AbortController();
  const onStop = () => {
    console.log('[gate-acl] shutting down…');
    ac.abort();
  };
  process.on('SIGINT', onStop);
  process.on('SIGTERM', onStop);

  console.log('[gate-acl] consumers: pl-ledger, mandate-service, intent-gate');
  await Promise.all([
    plService.run(kafka, 'gate-acl-pl-ledger', ac.signal),
    mandateService.run(kafka, 'gate-acl-mandate-service', ac.signal),
    intentService.run(kafka, 'gate-acl-intent-gate', ac.signal),
  ]);
}

main().catch((err) => {
  console.error('[gate-acl] fatal', err);
  process.exit(1);
});
