/**
 * useFundingStatus - Real-time Cardia funding status via SSE
 * 
 * Hook that connects to the SSE endpoint and streams funding events
 * for the bound wallet address.
 */

import { useState, useEffect, useCallback } from 'react';
import type { CardiaFundingKafkaEvent, FundingStatus } from '@sovereign/types';

interface UseFundingStatusResult {
  /** Latest funding event */
  status: CardiaFundingKafkaEvent | null;
  /** Whether the SSE stream is connected */
  isConnected: boolean;
  /** Current funding status enum */
  fundingStatus: FundingStatus | null;
  /** Whether there's an active funding flow */
  isFunding: boolean;
  /** Error if stream failed */
  error: string | null;
  /** Manual reconnect function */
  reconnect: () => void;
}

/**
 * Connect to the Cardia funding SSE stream for a wallet address.
 * 
 * @param walletAddress - The bound 0x principal wallet (null if not bound)
 * @returns Funding status state and connection info
 */
export function useFundingStatus(
  walletAddress: string | null,
): UseFundingStatusResult {
  const [status, setStatus] = useState<CardiaFundingKafkaEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!walletAddress) return;

    // Close existing connection if any
    if (eventSource) {
      eventSource.close();
    }

    const es = new EventSource(
      `/api/v1/cardia/funding/stream/${walletAddress}`,
    );

    es.onopen = () => {
      console.log('[FundingStatus] SSE connected');
      setIsConnected(true);
      setError(null);
    };

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle system messages
        if (data.type === 'CONNECTED') {
          console.log('[FundingStatus] Connected to stream:', data.wallet);
          return;
        }
        
        if (data.type === 'HEARTBEAT') {
          return; // Ignore heartbeats
        }

        // Real funding event
        const fundingEvent = data as CardiaFundingKafkaEvent;
        console.log('[FundingStatus] Received event:', fundingEvent.status);
        setStatus(fundingEvent);
      } catch (err) {
        console.error('[FundingStatus] Parse error:', err);
      }
    };

    es.onerror = (err) => {
      console.error('[FundingStatus] SSE error:', err);
      setIsConnected(false);
      setError('Connection lost. Reconnecting...');
      
      // EventSource auto-reconnects, but we can handle it manually if needed
      es.close();
    };

    setEventSource(es);
  }, [walletAddress]);

  // Connect on wallet change
  useEffect(() => {
    if (walletAddress && /^0x[a-f0-9]{40}$/i.test(walletAddress)) {
      connect();
    }

    return () => {
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
    };
  }, [walletAddress, connect]);

  // Derived state
  const fundingStatus = status?.status ?? null;
  const isFunding = fundingStatus !== null && 
    !['TX_CONFIRMED', 'TX_FAILED', 'TX_SYNTHESIZED'].includes(fundingStatus);

  return {
    status,
    isConnected,
    fundingStatus,
    isFunding,
    error,
    reconnect: connect,
  };
}

/**
 * Get a human-readable label for the funding status.
 */
export function getFundingStatusLabel(status: FundingStatus | null): string {
  if (!status) return 'AWAITING_MANDATE';
  
  const labels: Record<FundingStatus, string> = {
    'PENDING_HEPAR_AUDIT': 'AUDIT_PENDING',
    'AUDIT_PASSED': 'AUDIT_PASSED',
    'AUDIT_FAILED': 'AUDIT_FAILED',
    'TX_BROADCAST': 'TX_PENDING',
    'TX_CONFIRMED': 'TX_CONFIRMED',
    'TX_FAILED': 'TX_FAILED',
    'TX_SYNTHESIZED': 'TX_COMPLETE',
  };
  
  return labels[status] ?? status;
}

/**
 * Get color class for funding status.
 */
export function getFundingStatusColor(status: FundingStatus | null): string {
  if (!status) return 'text-gray-500';
  
  const colors: Record<FundingStatus, string> = {
    'PENDING_HEPAR_AUDIT': 'text-yellow-500',
    'AUDIT_PASSED': 'text-emerald-400',
    'AUDIT_FAILED': 'text-red-500',
    'TX_BROADCAST': 'text-yellow-500 animate-pulse',
    'TX_CONFIRMED': 'text-emerald-500',
    'TX_FAILED': 'text-red-600',
    'TX_SYNTHESIZED': 'text-cyan-400',
  };
  
  return colors[status] ?? 'text-gray-400';
}