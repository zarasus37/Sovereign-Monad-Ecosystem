import { describe, it, expect, vi } from 'vitest';
import { sovereignBus } from '@sovereign/bus';
import { evaluateAgent } from '@sovereign/gnosis-evaluator-core';

describe('Dove Signal Propagation Flow', () => {
  it('should trigger a blink and quarantine (Tier 1 equivalent) signal upon drift condition', async () => {
    const blinkHandler = vi.fn();
    const quarantineHandler = vi.fn();

    sovereignBus.on('gnosis.blink.triggered', blinkHandler);
    sovereignBus.on('gnosis.quarantine.triggered', quarantineHandler);

    // High tilt magnitude forces blink and quarantine (Lane C)
    const result = await evaluateAgent('agent-x', {
      depth: 0.5,
      truth: 0.5,
      width: 0.5,
      tiltMagnitude: 0.85
    });

    expect(result.payload.overallScore).toBeLessThan(0.65);
    expect(result.payload.lane).toBe('LANE_C');
    expect(result.payload.quarantineTriggered).toBe(true);

    // Await async handlers
    await new Promise(setImmediate);

    expect(blinkHandler).toHaveBeenCalledTimes(1);
    expect(quarantineHandler).toHaveBeenCalledTimes(1);

    const quarantineEvent = quarantineHandler.mock.calls[0][0];
    expect(quarantineEvent.severity).toBe('critical');

    sovereignBus.off('gnosis.blink.triggered', blinkHandler);
    sovereignBus.off('gnosis.quarantine.triggered', quarantineHandler);
  });
});
