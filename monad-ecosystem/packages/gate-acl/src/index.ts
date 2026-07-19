/**
 * @sovereign/gate-acl — Shaliah PL→ACL hard gate.
 *
 * Core (no Kafka/Redis required):
 *   PLLedger, MandateIssuer, GateAclService, Executor, InMemoryBus
 *
 * Runtime adapters (kafkajs + ioredis):
 *   KafkaBusProducer, RedisMandateStore, PlLedgerService, MandateService,
 *   GateIntentService, ShaliahIntentEmitter, PlEventEmitter
 */

export * from './types.js';
export * from './ports.js';
export {
  PLLedger,
  PL_HALF_LIFE_MS,
  TIER_THRESHOLDS,
  scoreToTier,
} from './plLedger.js';
export {
  MandateIssuer,
  MANDATE_TTL_MS,
  TIER_SPECS,
  resolveSigningSecret,
  signMandate,
  verifyMandateSignature,
} from './mandateIssuer.js';
export { GateAclService } from './gateAcl.service.js';
export { Executor } from './executor.js';
export { InMemoryBus } from './bus.js';

export {
  TOPICS,
  createKafka,
  KafkaBusProducer,
  consumeIntentRaised,
  consumeTopic,
} from './kafkaBus.js';
export {
  RedisMandateStore,
  InMemoryMandateStore,
  createRedisFromUrl,
} from './redisMandateStore.js';
export { PlLedgerService } from './plLedgerService.js';
export { MandateService } from './mandateService.js';
export { GateIntentService } from './gateIntentService.js';
export { ShaliahIntentEmitter, PlEventEmitter } from './shaliahAgentPath.js';
