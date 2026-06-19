/**
 * useSignalStream.ts
 *
 * React hook for consuming the gnostic-engine Server-Sent Events (SSE) stream.
 *
 * Features:
 * - Typed GnosisScore events via EventSource
 * - Automatic reconnect with exponential back-off (capped at 30 s)
 * - AbortController-based cleanup on unmount
 * - Connection state tracking (connecting | open | closed | error)
 * - Ring buffer of last N scores (configurable via bufferSize option)
 *
 * Usage:
 *   const { scores, connectionState, error } = useSignalStream({ bufferSize: 20 });
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { type GnosisScore, gnosisStreamUrl } from "@/services/gnostic-api";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ConnectionState = "idle" | "connecting" | "open" | "closed" | "error";

export interface UseSignalStreamOptions {
  /** Maximum number of scores to keep in the buffer. Default: 50. */
  bufferSize?: number;
  /** Whether the stream should be active. Default: true. */
  enabled?: boolean;
  /** Callback fired each time a new GnosisScore arrives. */
  onScore?: (score: GnosisScore) => void;
}

export interface UseSignalStreamResult {
  /** Ordered ring buffer of recent GnosisScores (newest at index 0). */
  scores: GnosisScore[];
  /** Current SSE connection state. */
  connectionState: ConnectionState;
  /** Last error message if connectionState === 'error'. */
  error: string | null;
  /** Manually close and reopen the SSE connection. */
  reconnect: () => void;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const MIN_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const RECONNECT_MULTIPLIER = 2;

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useSignalStream({
  bufferSize = 50,
  enabled = true,
  onScore,
}: UseSignalStreamOptions = {}): UseSignalStreamResult {
  const [scores, setScores] = useState<GnosisScore[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);

  // Stable ref for the onScore callback to avoid re-connecting on every render
  const onScoreRef = useRef(onScore);
  useEffect(() => {
    onScoreRef.current = onScore;
  });

  const reconnectDelayRef = useRef(MIN_RECONNECT_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current !== null) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Tear down any existing connection first
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    setConnectionState("connecting");
    setError(null);

    const url = gnosisStreamUrl();
    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("open", () => {
      setConnectionState("open");
      setError(null);
      reconnectDelayRef.current = MIN_RECONNECT_MS; // reset back-off on successful connect
    });

    es.addEventListener("gnosis_score", (event: MessageEvent) => {
      try {
        const score = JSON.parse(event.data as string) as GnosisScore;
        onScoreRef.current?.(score);
        setScores((prev) => {
          const next = [score, ...prev];
          return next.length > bufferSize ? next.slice(0, bufferSize) : next;
        });
      } catch {
        // Malformed SSE payload — skip silently; don't break the stream
      }
    });

    es.addEventListener("error", () => {
      es.close();
      esRef.current = null;

      setConnectionState("error");
      setError(`SSE connection to ${url} failed. Reconnecting in ${reconnectDelayRef.current}ms…`);

      // Exponential back-off reconnect
      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        if (enabled) {
          reconnectDelayRef.current = Math.min(
            reconnectDelayRef.current * RECONNECT_MULTIPLIER,
            MAX_RECONNECT_MS,
          );
          connect();
        }
      }, reconnectDelayRef.current);
    });
  }, [bufferSize, clearReconnectTimer, enabled]);

  const disconnect = useCallback(() => {
    clearReconnectTimer();
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    setConnectionState("closed");
  }, [clearReconnectTimer]);

  const reconnect = useCallback(() => {
    clearReconnectTimer();
    reconnectDelayRef.current = MIN_RECONNECT_MS;
    if (enabled) {
      connect();
    }
  }, [clearReconnectTimer, connect, enabled]);

  useEffect(() => {
    if (!enabled) {
      disconnect();
      return;
    }

    connect();

    return () => {
      disconnect();
    };
    // connect and disconnect are stable refs; only re-run when enabled changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { scores, connectionState, error, reconnect };
}
