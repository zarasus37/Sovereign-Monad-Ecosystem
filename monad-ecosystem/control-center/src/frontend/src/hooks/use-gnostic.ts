/**
 * use-gnostic.ts
 *
 * React Query hooks for the gnostic-engine REST endpoints.
 * These complement the useSignalStream SSE hook with polling-based
 * fallback access to the same data.
 *
 * All hooks use a shared queryKey namespace under "gnostic" to enable
 * targeted invalidation when SSE events arrive.
 */

import { useQuery } from "@tanstack/react-query";
import {
  fetchActiveDoveSignals,
  fetchDoveSignals,
  fetchGnosticHealth,
  fetchLatestScores,
} from "@/services/gnostic-api";
import { fetchLatestHeparAudits } from "@/services/hepar-api";

// ── Query keys ────────────────────────────────────────────────────────────────

export const GNOSTIC_KEYS = {
  health: ["gnostic", "health"] as const,
  latestScores: (limit: number) => ["gnostic", "scores", limit] as const,
  doveSignals: (limit: number) => ["gnostic", "dove", "signals", limit] as const,
  doveActive: ["gnostic", "dove", "active"] as const,
  heparLatest: (limit: number) => ["gnostic", "hepar", "latest", limit] as const,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Poll the gnostic-engine health endpoint every 10 seconds.
 * Used by the system status bar to show engine connectivity.
 */
export function useGnosticHealth() {
  return useQuery({
    queryKey: GNOSTIC_KEYS.health,
    queryFn: ({ signal }) => fetchGnosticHealth(signal),
    refetchInterval: 10_000,
    staleTime: 8_000,
    retry: 3,
    retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 15_000),
  });
}

/**
 * Poll the latest N GnosisScores every 5 seconds.
 * Use in conjunction with useSignalStream — this hook provides
 * initial data and a polling fallback when SSE is unavailable.
 */
export function useLatestGnosisScores(limit = 10) {
  return useQuery({
    queryKey: GNOSTIC_KEYS.latestScores(limit),
    queryFn: ({ signal }) => fetchLatestScores(limit, signal),
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: 2,
  });
}

/**
 * Poll latest N Dove signals every 5 seconds.
 * Covers the Dove monitor panel in the control-center dashboard.
 */
export function useDoveSignals(limit = 20) {
  return useQuery({
    queryKey: GNOSTIC_KEYS.doveSignals(limit),
    queryFn: ({ signal }) => fetchDoveSignals(limit, signal),
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: 2,
  });
}

/**
 * Poll all active (unresolved) Dove signals every 5 seconds.
 * Drives the alignment state badge and governance action panel.
 */
export function useActiveDoveSignals() {
  return useQuery({
    queryKey: GNOSTIC_KEYS.doveActive,
    queryFn: ({ signal }) => fetchActiveDoveSignals(signal),
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: 2,
  });
}

/**
 * Poll the latest Hepar audit results relayed through the gnostic-engine.
 * Drives the Hepar audit history panel.
 */
export function useLatestHeparAudits(limit = 10) {
  return useQuery({
    queryKey: GNOSTIC_KEYS.heparLatest(limit),
    queryFn: ({ signal }) => fetchLatestHeparAudits(limit, signal),
    refetchInterval: 10_000,
    staleTime: 8_000,
    retry: 2,
  });
}
