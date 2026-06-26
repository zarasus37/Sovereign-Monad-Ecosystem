/**
 * SignalEvent — the canonical event envelope for the Sovereign signal bus.
 *
 * Every layer, organ, and agent emits this shape. Consumers use `layer` and
 * `type` to route; `correlationId` threads a single logical operation across
 * multiple emitted events; `hash` provides tamper-evidence at the edge.
 */

/** All valid layers that can originate a signal event. */
export type SignalLayer =
  | 'funnel'
  | 'engine'
  | 'treasury'
  | 'dao'
  | 'intelligence'
  | 'oracle'
  | 'signal-layer'
  | 'platform'
  | 'keys'
  | 'narrative'
  | 'dove'
  | 'gnosis'
  | 'revenue-router'
  | 'data-rail'
  | 'emergence'
  | 'cardia'
  | 'system';

/** All valid event types within the ecosystem. */
export type SignalEventType =
  // Engine events
  | 'price.updated'
  | 'spread.detected'
  | 'opportunity.constructed'
  | 'trade.approved'
  | 'trade.executed'
  | 'trade.rejected'
  // Revenue events
  | 'revenue.routed'
  | 'revenue.sink.received'
  // Organ events
  | 'hepar.audit.started'
  | 'hepar.audit.completed'
  | 'hepar.audit.finding'
  // Gnosis events
  | 'gnosis.score.computed'
  | 'gnosis.blink.triggered'
  | 'gnosis.quarantine.triggered'
  | 'gnosis.plurality.snapshot'
  // Dove events
  | 'dove.signal.tier1'
  | 'dove.signal.tier2'
  | 'dove.signal.tier3'
  // Oracle events
  | 'oracle.regime.classified'
  | 'oracle.posture.updated'
  // Data rail events
  | 'data-rail.event.captured'
  | 'data-rail.activated'
  | 'data-rail.bundle.ready'
  // Emergence events
  | 'emergence.window.opened'
  | 'emergence.pattern.candidate'
  | 'emergence.claim.submitted'
  // Agent events
  | 'agent.action.taken'
  | 'agent.profile.registered'
  | 'agent.claim.mined'
  // System events
  | 'system.health'
  | 'system.error'
  | 'system.startup'
  | 'system.shutdown'
  // Cardia events
  | 'cardia.activated';

/** Severity levels for events that carry a severity. */
export type EventSeverity = 'info' | 'warning' | 'critical' | 'fatal';

/**
 * The canonical event envelope. All bus emissions MUST conform to this shape.
 *
 * Typed payload is carried in `payload`; callers should narrow via the `type`
 * discriminant before accessing payload properties.
 */
export interface SignalEvent<TPayload = unknown> {
  /** Unique event identifier (UUID v4). */
  readonly id: string;

  /** Logical operation thread — links related events across layers. */
  readonly correlationId: string;

  /** ISO-8601 timestamp of emission (millisecond precision). */
  readonly timestamp: string;

  /** Layer that emitted this event. */
  readonly layer: SignalLayer;

  /** Emitting agent or service identifier. */
  readonly source: string;

  /** Discriminant for routing and payload narrowing. */
  readonly type: SignalEventType;

  /** Structured payload — shape defined by `type`. */
  readonly payload: TPayload;

  /**
   * Optional SHA-256 hex digest of: `id + timestamp + JSON.stringify(payload)`.
   * Provides tamper-evidence at log/storage boundary.
   */
  readonly hash?: string;

  /** Optional severity override — defaults to 'info' if not set. */
  readonly severity?: EventSeverity;
}

/** Helper type: extract the payload type for a given event type discriminant. */
export type PayloadOf<T extends SignalEvent> = T['payload'];
