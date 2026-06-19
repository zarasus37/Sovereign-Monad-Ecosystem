import { describe, it, expect, vi } from 'vitest';
import { sovereignBus } from '@sovereign/bus';
import { HeparOrchestrator } from '@sovereign/hepar-core';
import type { HeparAuditResult, SignalEvent } from '@sovereign/types';

describe('Hepar to Bus Flow', () => {
  it('should emit a completed audit event after running a full audit', async () => {
    const mockHandler = vi.fn();
    sovereignBus.on('hepar.audit.completed', mockHandler);

    const targetAddress = '0x1234567890abcdef';
    const result = await HeparOrchestrator.runFullAudit(targetAddress, 'monad-mainnet', { tvlTier: 'mid' });

    expect(result).toBeDefined();
    expect(result.payload.target).toBe(targetAddress);
    expect(result.payload.score.tvlTier).toBe('mid');

    expect(mockHandler).toHaveBeenCalled();
    const event: SignalEvent<HeparAuditResult> = mockHandler.mock.calls[0][0];

    expect(event.layer).toBe('intelligence');
    expect(event.payload.auditId).toBe(result.payload.auditId);
    expect(event.payload.stages.length).toBe(4); // A-D

    sovereignBus.off('hepar.audit.completed', mockHandler);
  });
});
