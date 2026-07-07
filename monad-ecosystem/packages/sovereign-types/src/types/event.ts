/**
 * Stored event types — the durable audit trail (Layer 5).
 *
 * Ring buffers are the wrong shape for "soul forensics" (CHARTER §4): they are
 * volatile, bounded, and lose history on restart. The durable append-only JSONL
 * event log is the source of truth; ring buffers are demoted to a read shortcut.
 *
 * `StoredEvent` is the canonical row written to the log and returned by the
 * replay surface (`GET /api/v1/audit/replay`). `DecisionChain` is the linked
 * reconstruction of a single intention chain (constraint envelope → inbound
 * signals → gnosis evaluation → narrative purpose → chosen action) threaded via
 * `trace.parentEventId` links.
 *
 * Reference: docs/CHARTER.md §4 — Intention traceability.
 */

import type { EventTrace } from './signal.js';

/**
 * A single event persisted in the durable JSONL event log.
 *
 * Field names are camelCase to match the JSON wire shape produced by the Python
 * `gnostic_engine.persistence.event_log` module — one shape across runtimes.
 */
export interface StoredEvent {
  /** Unique event identifier (UUID v4). */
  readonly eventId: string;

  /** Canonical SignalEventType of the stored event. */
  readonly eventType: string;

  /** ISO-8601 timestamp of the event. */
  readonly timestamp: string;

  /** Monotonically increasing engine sequence number. */
  readonly sequenceNumber: number;

  /** Intention traceability metadata (CHARTER §4), if the event carried one. */
  readonly trace?: EventTrace;

  /** Structured payload — shape defined by `eventType`. */
  readonly payload: Record<string, unknown>;
}

/**
 * A reconstructed CHARTER §4 decision chain — the ordered event sequence for a
 * single `intentionId`, linked root → leaf via `trace.parentEventId`.
 */
export interface DecisionChain {
  /** The intention chain root identifier shared by every event in the chain. */
  readonly intentionId: string;

  /** Constraint envelope governing the chain, if any event carried one. */
  readonly constraintEnvelopeId?: string;

  /** Narrative purpose tag for the chain, if any event carried one. */
  readonly narrativePurposeId?: string;

  /** Events in chain order (root → leaf). */
  readonly events: readonly StoredEvent[];

  /** Number of events in the chain. */
  readonly depth: number;
}

/** Replay result returned by `GET /api/v1/audit/replay`. */
export interface ReplayResult {
  /** Flat list of stored events in the queried time window (chronological). */
  readonly events: readonly StoredEvent[];

  /** Intention chains reconstructed from the events via `parentEventId` links. */
  readonly chains: readonly DecisionChain[];

  /** ISO-8601 timestamp the replay was generated. */
  readonly generatedAt: string;
}