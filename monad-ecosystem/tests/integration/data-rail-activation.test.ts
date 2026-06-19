import { describe, it, expect, vi } from 'vitest';
import { sovereignBus } from '@sovereign/bus';
import { activateDataRail } from '@sovereign/data-rail-core';

describe('Data Rail Activation Flow', () => {
  it('should emit a data-rail.activated event when readiness criteria are met', async () => {
    const mockHandler = vi.fn();
    sovereignBus.on('data-rail.activated', mockHandler);

    const readinessScore = 0.95;
    const record = activateDataRail(readinessScore);

    expect(record).toBeDefined();
    expect(record.status).toBe('active');
    expect(record.readinessScore).toBe(readinessScore);

    // Give synchronous events time to resolve if any async wrapping is used
    await new Promise(setImmediate);

    expect(mockHandler).toHaveBeenCalled();
    const event = mockHandler.mock.calls[0][0];

    expect(event.layer).toBe('data-rail');
    expect(event.payload.activationId).toBe(record.activationId);
    expect(event.payload.readinessScore).toBe(readinessScore);

    sovereignBus.off('data-rail.activated', mockHandler);
  });
});
