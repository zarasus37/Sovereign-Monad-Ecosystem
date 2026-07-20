/**
 * @sovereign/monad-mev
 *
 * Vectors 5.1–5.3: Shadow Markout, Capacity Ceiling, Sovereign Execution Loop.
 */

// ── Capacity Ceiling (5.2) ──────────────────────────────────────────────────
export {
  CapacityCeilingMonitor,
  type CapacityCeilingMonitorOptions,
} from './capacityCeiling.js';
export {
  defaultCapacityCeilingEmit,
  type CapacityEmitFn,
} from './capacityCeilingEmit.js';

// ── Execution loop (5.1 + 5.3) ──────────────────────────────────────────────
export {
  executeLiveTrade,
  executeGuardedLiveTrade,
  executeGuardlessTrade,
  evaluateShadowMarkout,
  shouldProceedTrade,
  explainVerdict,
  type ExecutionConfig,
  type GuardedTradeDeps,
  type ExecutionResult,
} from './executionEngine.js';

// ── Capital mandate + yield router (5.3) ────────────────────────────────────
export {
  signCapitalMandate,
  signCapitalMandateWithPrivateKey,
  type MandateSignerWallet,
  type SignCapitalMandateOpts,
} from './loop/mandateSigner.js';
export {
  verifyCapitalMandate,
  verifyCapitalMandateDetailed,
  verifyCapitalMandateSignature,
  type VerifyMandateOpts,
} from './loop/mandateVerifier.js';
export {
  routeYield,
  routeYieldFromWallet,
  createErc20TransferFn,
  type YieldTransferFn,
  type RouteYieldOpts,
} from './loop/yieldRouter.js';
export {
  mandateDomain,
  MANDATE_TYPES,
  toMandateTypedValue,
} from './loop/eip712Mandate.js';
export { broadcastLoopEvent } from './loop/loopBroadcast.js';

// ── Types re-export ─────────────────────────────────────────────────────────
export type {
  ShadowMarkoutRequest,
  ShadowMarkoutResponse,
  ShadowVerdict,
  TradePayload,
  TradeStatus,
  TradeOutcome,
  CeilingDecision,
  CapacityCeilingConfig,
  CapacityCeilingEvent,
  CapitalMandate,
  YieldDistribution,
  MandateVerifyResult,
  SovereignLoopEvent,
} from '@sovereign/types';

export {
  SHADOW_API_URL,
  SHADOW_TIMEOUT_MS,
  CAPACITY_CEILING_TOPIC,
  CAPACITY_CEILING_DEFAULT_ALLOCATION_USD,
  C_DENSITY_FLOOR_DEFAULT,
  SOVEREIGN_LOOP_TOPIC,
  YIELD_SPLIT_PRINCIPAL_BPS,
  YIELD_SPLIT_SHALIAH_BPS,
  YIELD_SPLIT_VAULT_BPS,
  loopUsdToBaseUnits,
  computeYieldSplitsBaseUnits,
} from '@sovereign/types';
