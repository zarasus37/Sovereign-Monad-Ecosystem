/**
 * Intention traceability enforcement for the Sovereign event bus.
 *
 * Implements CHARTER.md §4 (Intention traceability) at the propagation layer.
 * Governance-relevant / action-bearing / economically meaningful event types
 * MUST carry a valid EventTrace object before the bus will emit them.
 *
 * Ambient telemetry and raw observations are not required to carry trace
 * metadata, so the schema keeps trace optional globally and the bus enforces
 * it only for the event types listed below.
 */

import type { SignalEvent } from '@sovereign/types';

/**
 * Event types that require an intention trace because they participate in
 * governance, economic action, or agent operations.
 *
 * Keep this list explicit and centralized. Do not expand it to pure
 * observations without a charter review.
 */
export const TRACE_REQUIRED_EVENT_TYPES = new Set<string>([
  // Economic actions
  'trade.approved',
  'trade.executed',
  'trade.rejected',
  'revenue.routed',
  'revenue.sink.received',

  // Governance / conscience signals
  'dove.signal.tier1',
  'dove.signal.tier2',
  'dove.signal.tier3',

  // Agent operations and claims
  'agent.action.taken',
  'agent.claim.mined',

  // Audit / integrity conclusions
  'hepar.audit.completed',
  'hepar.audit.finding',

  // Gnosis integrity interventions
  'gnosis.quarantine.triggered',
  'gnosis.blink.triggered',

  // Emergence pattern claims
  'emergence.claim.submitted',
]);

/** Returns true if an event type must carry a valid EventTrace. */
export function requiresIntentionTraceability(eventType: string): boolean {
  return TRACE_REQUIRED_EVENT_TYPES.has(eventType);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isIsoDateString(value: unknown): boolean {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

/** True when the required minimum trace fields are present and non-empty. */
export function hasRequiredTraceFields(event: SignalEvent<unknown>): boolean {
  if (!event.trace) return false;
  return (
    isNonEmptyString(event.trace.intentionId) &&
    isNonEmptyString(event.trace.source)
  );
}

/** True when all present optional trace fields are structurally valid. */
export function isTraceStructurallyValid(event: SignalEvent<unknown>): boolean {
  if (!event.trace) return false;
  if (!hasRequiredTraceFields(event)) return false;

  if (
    event.trace.createdAt !== undefined &&
    !isIsoDateString(event.trace.createdAt)
  ) {
    return false;
  }

  if (
    event.trace.parentEventId !== undefined &&
    !isNonEmptyString(event.trace.parentEventId)
  ) {
    return false;
  }

  if (
    event.trace.constraintEnvelopeId !== undefined &&
    !isNonEmptyString(event.trace.constraintEnvelopeId)
  ) {
    return false;
  }

  if (
    event.trace.narrativePurposeId !== undefined &&
    !isNonEmptyString(event.trace.narrativePurposeId)
  ) {
    return false;
  }

  return true;
}

/**
 * Validate that a SignalEvent carries the required intention traceability
 * metadata if its type is in the required-trace set.
 *
 * Throws a CHARTER §4 violation error on failure. Does nothing for event types
 * that are not trace-required.
 */
export function validateIntentionTraceability(
  event: SignalEvent<unknown>
): void {
  if (!requiresIntentionTraceability(event.type)) return;

  if (!event.trace) {
    throw new Error(
      `CHARTER §4 violation: event type "${event.type}" requires trace metadata (intention chain must be documented before propagation)`
    );
  }

  if (!hasRequiredTraceFields(event)) {
    throw new Error(
      `CHARTER §4 violation: event type "${event.type}" requires trace.intentionId and trace.source`
    );
  }

  if (!isTraceStructurallyValid(event)) {
    throw new Error(
      `CHARTER §4 violation: event type "${event.type}" has invalid trace structure (check optional field formats)`
    );
  }
}
