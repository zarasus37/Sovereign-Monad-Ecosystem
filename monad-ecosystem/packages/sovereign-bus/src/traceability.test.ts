/**
 * Tests for CHARTER.md §4 intention traceability enforcement.
 *
 * These tests verify that governance-relevant / action-bearing event types
 * require a valid EventTrace, while ambient observations remain exempt.
 */

import { describe, it, expect } from 'vitest';
import {
  requiresIntentionTraceability,
  hasRequiredTraceFields,
  isTraceStructurallyValid,
  validateIntentionTraceability,
  TRACE_REQUIRED_EVENT_TYPES,
} from './traceability.js';

function makeEvent(
  type: string,
  trace?: Record<string, unknown> | null
): Parameters<typeof validateIntentionTraceability>[0] {
  return {
    id: 'evt-1',
    correlationId: 'corr-1',
    timestamp: new Date().toISOString(),
    layer: 'gnosis',
    source: 'test',
    type: type as any,
    payload: {},
    trace: trace === null ? undefined : (trace as any),
  };
}

describe('requiresIntentionTraceability', () => {
  it('returns true for governance-relevant event types', () => {
    expect(requiresIntentionTraceability('trade.executed')).toBe(true);
    expect(requiresIntentionTraceability('dove.signal.tier2')).toBe(true);
    expect(requiresIntentionTraceability('agent.action.taken')).toBe(true);
    expect(requiresIntentionTraceability('hepar.audit.completed')).toBe(true);
    expect(requiresIntentionTraceability('gnosis.quarantine.triggered')).toBe(true);
  });

  it('returns false for ambient observations', () => {
    expect(requiresIntentionTraceability('price.updated')).toBe(false);
    expect(requiresIntentionTraceability('system.health')).toBe(false);
    expect(requiresIntentionTraceability('gnosis.plurality.snapshot')).toBe(false);
  });

  it('central set is not empty', () => {
    expect(TRACE_REQUIRED_EVENT_TYPES.size).toBeGreaterThan(0);
  });
});

describe('hasRequiredTraceFields', () => {
  it('returns true when intentionId and source are non-empty', () => {
    const event = makeEvent('trade.executed', {
      intentionId: 'intent-1',
      source: 'TestService',
    });
    expect(hasRequiredTraceFields(event)).toBe(true);
  });

  it('returns false when trace is missing', () => {
    expect(hasRequiredTraceFields(makeEvent('trade.executed', null))).toBe(false);
  });

  it('returns false when intentionId is empty', () => {
    const event = makeEvent('trade.executed', {
      intentionId: '',
      source: 'TestService',
    });
    expect(hasRequiredTraceFields(event)).toBe(false);
  });

  it('returns false when source is empty', () => {
    const event = makeEvent('trade.executed', {
      intentionId: 'intent-1',
      source: '   ',
    });
    expect(hasRequiredTraceFields(event)).toBe(false);
  });
});

describe('isTraceStructurallyValid', () => {
  it('returns true for a fully valid trace', () => {
    const event = makeEvent('trade.executed', {
      intentionId: 'intent-1',
      source: 'TestService',
      parentEventId: 'parent-1',
      constraintEnvelopeId: 'env-1',
      narrativePurposeId: 'purpose-1',
      createdAt: new Date().toISOString(),
    });
    expect(isTraceStructurallyValid(event)).toBe(true);
  });

  it('rejects a malformed createdAt', () => {
    const event = makeEvent('trade.executed', {
      intentionId: 'intent-1',
      source: 'TestService',
      createdAt: 'not-a-date',
    });
    expect(isTraceStructurallyValid(event)).toBe(false);
  });

  it('rejects empty optional IDs', () => {
    const event = makeEvent('trade.executed', {
      intentionId: 'intent-1',
      source: 'TestService',
      parentEventId: '',
    });
    expect(isTraceStructurallyValid(event)).toBe(false);
  });
});

describe('validateIntentionTraceability', () => {
  it('accepts traceable consequential events', () => {
    const event = makeEvent('agent.action.taken', {
      intentionId: 'intent-1',
      source: 'PluralityDoveEmitter',
      createdAt: new Date().toISOString(),
    });
    expect(() => validateIntentionTraceability(event)).not.toThrow();
  });

  it('rejects consequential events without trace', () => {
    const event = makeEvent('trade.executed', null);
    expect(() => validateIntentionTraceability(event)).toThrow(/CHARTER §4 violation/);
    expect(() => validateIntentionTraceability(event)).toThrow(/requires trace metadata/);
  });

  it('rejects consequential events with empty intentionId', () => {
    const event = makeEvent('dove.signal.tier2', {
      intentionId: '',
      source: 'PluralityDoveEmitter',
    });
    expect(() => validateIntentionTraceability(event)).toThrow(/CHARTER §4 violation/);
    expect(() => validateIntentionTraceability(event)).toThrow(/trace\.intentionId and trace\.source/);
  });

  it('rejects consequential events with invalid trace structure', () => {
    const event = makeEvent('emergence.claim.submitted', {
      intentionId: 'intent-1',
      source: 'Emitter',
      parentEventId: '',
    });
    expect(() => validateIntentionTraceability(event)).toThrow(/CHARTER §4 violation/);
    expect(() => validateIntentionTraceability(event)).toThrow(/invalid trace structure/);
  });

  it('allows observational events without trace', () => {
    const event = makeEvent('price.updated', null);
    expect(() => validateIntentionTraceability(event)).not.toThrow();
  });

  it('allows observation events with trace to pass through', () => {
    const event = makeEvent('system.health', {
      intentionId: 'intent-1',
      source: 'HealthCheck',
    });
    expect(() => validateIntentionTraceability(event)).not.toThrow();
  });
});
