import { describe, it, expect, vi } from 'vitest';
import { sovereignBus } from '@sovereign/bus';
import type { SignalEvent } from '@sovereign/types';

describe('Event Bus Flow', () => {
  it('should emit and receive a signal with correct typing', async () => {
    const mockHandler = vi.fn();
    sovereignBus.on('test.signal', mockHandler);

    const payload = { testPayload: true, score: 95 };
    sovereignBus.emit('test.signal', 'intelligence', payload);

    // Allow synchronous event to settle (EventEmitter is sync but we await just in case of future changes)
    await new Promise(setImmediate);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    const event: SignalEvent<typeof payload> = mockHandler.mock.calls[0][0];
    
    expect(event.layer).toBe('intelligence');
    expect(event.payload).toEqual(payload);
    expect(event.id).toBeDefined();
    expect(event.timestamp).toBeDefined();

    sovereignBus.off('test.signal', mockHandler);
  });
});
