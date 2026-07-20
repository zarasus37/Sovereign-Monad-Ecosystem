/**
 * @sovereign/monad-mev
 * 
 * MEV Trading Engine with Shadow Markout Gate integration.
 * Enforces the Fail-Closed Doctrine for live capital deployment.
 */

export {
  executeLiveTrade,
  executeGuardedLiveTrade,
  executeGuardlessTrade,
  evaluateShadowMarkout,
  shouldProceedTrade,
  explainVerdict,
} from './executionEngine.js';

export type {
  ShadowMarkoutRequest,
  ShadowMarkoutResponse,
  ShadowVerdict,
  TradePayload,
  TradeStatus,
} from '@sovereign/types';

export {
  SHADOW_API_URL,
  SHADOW_TIMEOUT_MS,
} from '@sovereign/types';