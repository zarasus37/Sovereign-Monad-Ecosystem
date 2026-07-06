/**
 * @sovereign/bus — Sovereign Monad internal event bus.
 *
 * The typed, append-logged, Kafka-compatible signal backbone for the ecosystem.
 *
 * @example
 * ```typescript
 * import { sovereignBus } from '@sovereign/bus';
 * import type { HeparAuditResult } from '@sovereign/types';
 *
 * // Emit a typed event
 * sovereignBus.emit('hepar.audit.completed', 'intelligence', result);
 *
 * // Subscribe to events
 * const unsubscribe = sovereignBus.on<HeparAuditResult>(
 *   'hepar.audit.completed',
 *   (event) => console.log(event.payload.score)
 * );
 * ```
 */

export {
  EventBus,
  BusError,
  getOrCreateBus,
  sovereignBus,
} from './EventBus.js';

export type { EventBusConfig, EventListener } from './EventBus.js';

export {
  KafkaBridge,
  initKafkaBridgeFromEnv,
} from './kafka-bridge.js';

export type { KafkaBridgeConfig } from './kafka-bridge.js';

export {
  TRACE_REQUIRED_EVENT_TYPES,
  requiresIntentionTraceability,
  hasRequiredTraceFields,
  isTraceStructurallyValid,
  validateIntentionTraceability,
} from './traceability.js';
