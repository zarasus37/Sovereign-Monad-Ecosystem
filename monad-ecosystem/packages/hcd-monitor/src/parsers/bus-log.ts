/**
 * Parser for bus event JSONL files.
 *
 * Reads line-delimited JSON SignalEvent records and validates the
 * minimum shape needed for HCD‑3, HCD‑4, and HCD‑5.
 */

import type { BusEvent } from '../types.js';

/**
 * Parse a JSONL stream into validated BusEvent records.
 *
 * Lines that fail to parse or do not contain the required fields are
 * skipped and reported via the `skipped` count.
 */
export function parseBusLog(content: string): {
  events: BusEvent[];
  skipped: number;
} {
  const events: BusEvent[] = [];
  let skipped = 0;

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const parsed = JSON.parse(trimmed);
      const event = asBusEvent(parsed);
      if (event) {
        events.push(event);
      } else {
        skipped++;
      }
    } catch {
      skipped++;
    }
  }

  return { events, skipped };
}

function asBusEvent(value: unknown): BusEvent | null {
  if (!isRecord(value)) return null;
  const id = value.id;
  const correlationId = value.correlationId;
  const timestamp = value.timestamp;
  const layer = value.layer;
  const source = value.source;
  const type = value.type;
  if (
    typeof id !== 'string' ||
    typeof correlationId !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof layer !== 'string' ||
    typeof source !== 'string' ||
    typeof type !== 'string'
  ) {
    return null;
  }

  const trace = asTrace(value.trace);

  return {
    id,
    correlationId,
    timestamp,
    layer,
    source,
    type,
    payload: value.payload,
    severity: typeof value.severity === 'string' ? value.severity : undefined,
    trace,
  };
}

function asTrace(value: unknown): BusEvent['trace'] {
  if (!isRecord(value)) return undefined;
  const intentionId = value.intentionId;
  const source = value.source;
  if (typeof intentionId !== 'string' || typeof source !== 'string') {
    return undefined;
  }
  return {
    intentionId,
    source,
    parentEventId:
      typeof value.parentEventId === 'string' ? value.parentEventId : undefined,
    constraintEnvelopeId:
      typeof value.constraintEnvelopeId === 'string'
        ? value.constraintEnvelopeId
        : undefined,
    narrativePurposeId:
      typeof value.narrativePurposeId === 'string'
        ? value.narrativePurposeId
        : undefined,
    createdAt:
      typeof value.createdAt === 'string' ? value.createdAt : undefined,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
