/**
 * CHARTER §4 trace propagation (Layer 9 / Layer 5 integration).
 *
 * Asserts that gnosis integrity interventions emitted through the TS event bus
 * carry a valid EventTrace and survive `validateIntentionTraceability` — the
 * single enforcement point. Also asserts the negative case: a trace-required
 * event type WITHOUT a trace is rejected by the bus validator.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  sovereignBus,
  validateIntentionTraceability,
  requiresIntentionTraceability,
} from '@sovereign/bus';
import { evaluateAgent } from '@sovereign/gnosis-evaluator-core';
import type { SignalEvent } from '@sovereign/types';

describe('CHARTER §4 trace propagation through the bus', () => {
  it('a quarantine intervention carries a valid trace and passes validation', async () => {
    const quarantineHandler = vi.fn();
    sovereignBus.on('gnosis.quarantine.triggered', quarantineHandler);

    // Lane C (low overall score) + blink (high tilt) → quarantine.
    await evaluateAgent('agent-trace', {
      depth: 0.5,
      truth: 0.5,
      width: 0.5,
      tiltMagnitude: 0.85,
    });
    await new Promise(setImmediate);

    expect(quarantineHandler).toHaveBeenCalledTimes(1);
    const event = quarantineHandler.mock.calls[0][0] as SignalEvent<unknown>;

    // It is a trace-required type.
    expect(requiresIntentionTraceability(event.type)).toBe(true);

    // It carries a non-empty intentionId + source.
    expect(event.trace).toBeDefined();
    expect(typeof event.trace!.intentionId).toBe('string');
    expect(event.trace!.intentionId.length).toBeGreaterThan(0);
    expect(typeof event.trace!.source).toBe('string');
    expect(event.trace!.source.length).toBeGreaterThan(0);

    // It survives the single enforcement point.
    expect(() => validateIntentionTraceability(event)).not.toThrow();

    sovereignBus.off('gnosis.quarantine.triggered', quarantineHandler);
  });

  it('a blink intervention carries a valid trace and passes validation', async () => {
    const blinkHandler = vi.fn();
    sovereignBus.on('gnosis.blink.triggered', blinkHandler);

    // Lane A (high score) + high tilt → blink without quarantine.
    await evaluateAgent('agent-blink', {
      depth: 0.9,
      truth: 0.9,
      width: 0.9,
      tiltMagnitude: 0.5, // > 0.4 threshold → blink
    });
    await new Promise(setImmediate);

    expect(blinkHandler).toHaveBeenCalledTimes(1);
    const event = blinkHandler.mock.calls[0][0] as SignalEvent<unknown>;
    expect(requiresIntentionTraceability(event.type)).toBe(true);
    expect(event.trace).toBeDefined();
    expect(() => validateIntentionTraceability(event)).not.toThrow();

    sovereignBus.off('gnosis.blink.triggered', blinkHandler);
  });

  it('rejects a trace-required event that is missing its trace', () => {
    // Build a minimal trade.executed event with no trace — the bus must reject it.
    const untraced: SignalEvent<unknown> = {
      id: 'evt-untraced',
      correlationId: 'corr-1',
      timestamp: new Date().toISOString(),
      layer: 'engine',
      source: 'test',
      type: 'trade.executed',
      payload: {},
    };
    expect(requiresIntentionTraceability(untraced.type)).toBe(true);
    expect(() => validateIntentionTraceability(untraced)).toThrow(/CHARTER §4 violation/);
  });
});