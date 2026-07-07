/**
 * Schema ↔ bus traceability parity guard (CHARTER §4, Layer 9).
 *
 * The gnosis / dove / hepar JSON schemas are the wire-level contract for the
 * payloads that ride on trace-required event types
 * (`gnosis.quarantine.triggered`, `gnosis.blink.triggered`,
 * `dove.signal.tier1..3`, `hepar.audit.completed`, `hepar.audit.finding`).
 * Each of those event types is in `TRACE_REQUIRED_EVENT_TYPES`, so each payload
 * schema MUST define a `trace` block mirroring `signal-event.json`'s shape —
 * otherwise emitters have no schema-level place to put the trace the bus will
 * demand. This test locks that contract against accidental removal.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
// src/ → sovereign-bus/ → packages/ → monad-ecosystem/ → repo root → shared/schemas
const schemasDir = resolve(here, '../../../../shared/schemas');

async function loadSchema(name: string): Promise<Record<string, unknown>> {
  const raw = await readFile(join(schemasDir, name), 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

const TRACE_REQUIRED_FIELDS = [
  'intentionId',
  'source',
  'parentEventId',
  'constraintEnvelopeId',
  'narrativePurposeId',
  'createdAt',
] as const;

function assertTraceBlock(
  schema: Record<string, unknown>,
  schemaName: string,
): void {
  const properties = schema.properties as Record<string, unknown> | undefined;
  expect(properties, `${schemaName} must define a properties block`).toBeDefined();
  const trace = (properties as Record<string, unknown>).trace as
    | Record<string, unknown>
    | undefined;
  expect(trace, `${schemaName} must define a trace property`).toBeDefined();
  expect(trace!.type).toBe('object');
  expect(trace!.additionalProperties).toBe(false);

  const required = trace!.required as unknown[] | undefined;
  expect(required, `${schemaName} trace must require intentionId + source`).toBeDefined();
  expect(required).toContain('intentionId');
  expect(required).toContain('source');

  const traceProps = trace!.properties as Record<string, unknown>;
  for (const field of TRACE_REQUIRED_FIELDS) {
    expect(
      traceProps[field],
      `${schemaName} trace.properties.${field} must be defined`,
    ).toBeDefined();
  }

  // The payload schema keeps `trace` OPTIONAL at the schema level — the bus
  // enforces it per event type via TRACE_REQUIRED_EVENT_TYPES, not the schema.
  const topRequired = (schema.required as unknown[] | undefined) ?? [];
  expect(
    topRequired,
    `${schemaName} must NOT force trace at the schema level (bus enforces per type)`,
  ).not.toContain('trace');
}

describe('schema ↔ bus traceability parity (Layer 9)', () => {
  it('gnosis-score.json carries a CHARTER §4 trace block', async () => {
    const schema = await loadSchema('gnosis-score.json');
    assertTraceBlock(schema, 'gnosis-score.json');
  });

  it('dove-signal.json carries a CHARTER §4 trace block', async () => {
    const schema = await loadSchema('dove-signal.json');
    assertTraceBlock(schema, 'dove-signal.json');
  });

  it('hepar-audit-result.json carries a CHARTER §4 trace block', async () => {
    const schema = await loadSchema('hepar-audit-result.json');
    assertTraceBlock(schema, 'hepar-audit-result.json');
  });

  it('the trace block shape matches signal-event.json', async () => {
    // signal-event.json is the reference shape; the payload schemas mirror it.
    const ref = await loadSchema('signal-event.json');
    const refTrace = (ref.properties as Record<string, unknown>).trace as Record<
      string,
      unknown
    >;
    const refRequired = refTrace.required as string[];

    for (const name of ['gnosis-score.json', 'dove-signal.json', 'hepar-audit-result.json']) {
      const schema = await loadSchema(name);
      const trace = (schema.properties as Record<string, unknown>).trace as Record<
        string,
        unknown
      >;
      const props = trace.properties as Record<string, unknown>;
      // Same required minimum, same field set, same additionalProperties policy.
      expect(trace.required).toEqual(refRequired);
      expect(trace.additionalProperties).toBe(refTrace.additionalProperties);
      for (const field of TRACE_REQUIRED_FIELDS) {
        expect(props[field]).toBeDefined();
      }
    }
  });
});