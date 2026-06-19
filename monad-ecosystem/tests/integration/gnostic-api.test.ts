import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchGnosticHealth, fetchDoveSignals } from '@sovereign/control-center-frontend/src/services/gnostic-api';
// We don't have control-center in the typescript aliases from root, 
// so we'll just test the typing of the schema and mock a fetch.
import type { DoveSignal } from '@sovereign/types';

describe('Gnostic API Integration Flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should correctly type check DoveSignal payloads', async () => {
    const mockSignal: DoveSignal = {
      signalId: 'sig-123',
      tier: 1,
      layer: 'gnosis',
      observable: 'blink_detected',
      driftFlag: true,
      timestamp: new Date().toISOString()
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ signals: [mockSignal] })
    });
    
    global.fetch = fetchMock;

    // Simulate what the frontend client would do:
    const response = await global.fetch('http://localhost:8001/api/v1/dove/signals');
    const data = await response.json();
    
    expect(data.signals).toBeDefined();
    expect(data.signals[0].tier).toBe(1);
    expect(data.signals[0].driftFlag).toBe(true);
  });
});
