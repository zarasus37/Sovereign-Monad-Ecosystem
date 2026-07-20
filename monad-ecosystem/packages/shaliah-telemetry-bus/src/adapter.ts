/**
 * Shaliah Onboarding Event → hcd-monitor BusEvent adapter.
 *
 * Maps the Shaliah Onboarding telemetry events to the BusEvent shape
 * expected by the HCD monitor for drift tracking and observability.
 */

import type { OnboardingEvent } from '@sovereign/shaliah-onboarding';
import type { BusEvent } from '@sovereign/hcd-monitor';

/** Maps OnboardingEvent kinds to HCD monitor source identifiers. */
const PHASE_MAP: Record<string, string> = {
  'phase1.wire': 'phase1-circuit',
  'phase1.inspect': 'phase1-circuit',
  'phase1.overload': 'phase1-circuit',
  'phase1.starve': 'phase1-circuit',
  'phase1.stabilize': 'phase1-circuit',
  'phase2.trade_tick': 'phase2-shadow',
  'phase2.override': 'phase2-shadow',
  'phase2.refusal_named': 'phase2-shadow',
  'phase3.archon_prompt': 'phase3-archon',
  'phase3.refusal_attempt': 'phase3-archon',
  'phase3.pass': 'phase3-archon',
  'arc.graduate': 'graduation',
};

/** Maps OnboardingEvent kinds to severity levels. */
const SEVERITY_MAP: Record<string, string> = {
  'phase1.overload': 'warn',
  'phase1.starve': 'warn',
  'phase2.refusal_named': 'warn',
  'phase3.pass': 'info',
  'arc.graduate': 'info',
};

/**
 * Convert a Shaliah OnboardingEvent to an hcd-monitor BusEvent.
 *
 * @param event - The raw OnboardingEvent from Shaliah telemetry
 * @returns A BusEvent suitable for hcd-monitor ingestion
 */
export function toBusEvent(event: OnboardingEvent): BusEvent {
  const source = PHASE_MAP[event.kind] ?? 'unknown';
  const severity = SEVERITY_MAP[event.kind] ?? 'info';

  return {
    id: event.id,
    correlationId: event.principalId,
    timestamp: new Date(event.at).toISOString(),
    layer: 'shaliah-onboarding',
    source,
    type: event.kind,
    payload: event.payload,
    severity,
    trace: {
      intentionId: event.principalId,
      source: 'shaliah-onboarding',
    },
  };
}

/**
 * Convert multiple Shaliah events to BusEvents.
 *
 * @param events - Array of OnboardingEvents
 * @returns Array of BusEvents
 */
export function toBusEvents(events: OnboardingEvent[]): BusEvent[] {
  return events.map(toBusEvent);
}