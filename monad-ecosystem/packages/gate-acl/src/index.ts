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

export {
  verifyBrokenGenesisStructural,
  buildBrokenGenesisTaskEvent,
  type GenesisProfileWeights,
  type GenesisVerifyInput,
} from './genesisVerify.js';

export {
  verifyPlPromoteClaim,
  buildPlLedgerKafkaEvent,
  toPlEvent,
  deterministicEventId,
  PL_POINTS,
  CONSTRAINT_ENVELOPE_VERSION,
  type PromoteVerifyResult,
} from './plBridge.js';
export type {
  PlPromoteClaim,
  PlPromoteResult,
  PlLedgerKafkaEvent,
  PlOnboardingTaskId,
  PlTaskPayload,
} from './plBridge.types.js';
export { promotePl, promotePlHttp, type PlBridgeDeps } from './plBridgeService.js';

export {
  verifyWalletBind,
  buildWalletBindEvent,
  buildBindMessage,
  parseBindMessage,
  PrincipalWalletRegistry,
  WALLET_BIND_TASK_ID,
  TIER_1_PL_MINIMUM,
  WALLET_BIND_MESSAGE_PREFIX,
  type WalletBindRequest,
  type WalletBindKafkaPayload,
} from './walletBind.js';
export {
  bindWallet,
  bindWalletHttp,
  type WalletBindDeps,
  type WalletBindServiceResult,
} from './walletBindService.js';

export {
  SYNTHETIC_ACCOUNT_DEFAULT,
  RISK_PCT_MIN,
  RISK_PCT_MAX,
  TIER1_FIXED_RISK_PCT,
  TIER1_ALLOWED_SETUPS,
  TIER2_LIVE_MAX_CAPITAL_USD,
  TIER2_LIVE_MAX_RISK_PCT_PER_TRADE,
  TIER2_LIVE_RISK_PCT_HARD_MAX,
  TIER2_LIVE_RISK_PCT_MAX,
  TIER2_LIVE_RISK_PCT_PREFERRED,
  TIER2_LIVE_DAILY_LOSS_MULTIPLIER,
  TIER2_LIVE_MAX_TRADES_PER_DAY,
  computePositionSizing,
  buildEntryEvent,
  closeTrade,
  validatePaperProtocol,
  validateTier1SetupLogic,
  validateTier2SetupLogic,
  validateTier2LiveRisk,
  gateLiveExecute,
  buildLiveRiskEnvelope,
  computeLiveDailyStats,
  tier2MaxPerTradeRiskUSD,
  tier2DailyLossLimitUSD,
  isValidEMALiquidityLongSetup,
  isValidEMALiquidityShortSetup,
  stampProtocol,
  realizedR,
  stopDistance,
  type LOGOCTradeEvent,
  type TradePlanInput,
  type SetupTag,
  type TrendContext,
  type LiquidityZoneType,
  type LiquidityEvent,
  type LiveRiskEnvelope,
  type LiveDailyStats,
  type LiveExecuteRiskIntent,
} from './logocTrade.js';
export { PaperTradingJournal } from './paperJournal.js';
