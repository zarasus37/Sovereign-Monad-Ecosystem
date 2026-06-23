/**
 * use-logoc.ts
 *
 * React Query hooks + persistent Zustand stores for the LOGOC corpus UI.
 *
 * The filter state and human-review decisions are persisted to localStorage
 * so analysts don't lose work on reload. Decisions can be exported as a
 * JSON file for ingestion by the next correction cycle (v5.10+).
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import {
  type LogocCorpusSnapshot,
  type LogocFilters,
  type PragmatismBand,
  type LogocEvent,
  fetchCorpusSnapshot,
  filterEvents,
  buildBandDistribution,
  buildClassDistribution,
  buildPpsBandScatter,
  buildTriadHeatmap,
} from "@/services/logoc-api";

// ── Query keys ────────────────────────────────────────────────────────────────

export const LOGOC_KEYS = {
  corpus: ["logoc", "corpus"] as const,
};

// ── Corpus fetch hook ─────────────────────────────────────────────────────────

export function useLogocCorpus() {
  return useQuery({
    queryKey: LOGOC_KEYS.corpus,
    queryFn: ({ signal }) => fetchCorpusSnapshot(signal),
    refetchInterval: 30_000,
    staleTime: 25_000,
    retry: 2,
  });
}

// ── Filtered view hook ─────────────────────────────────────────────────────────

export function useFilteredCorpus(
  corpus: LogocCorpusSnapshot | undefined,
  filters: LogocFilters,
) {
  return useMemo(() => {
    if (!corpus) return { events: [], total: 0, bandDistribution: [], classDistribution: [], ppsScatter: [], triadHeatmap: [] };
    const events = filterEvents(corpus.events, filters);
    return {
      events,
      total: events.length,
      bandDistribution: buildBandDistribution(events),
      classDistribution: buildClassDistribution(events, 12),
      ppsScatter: buildPpsBandScatter(events),
      triadHeatmap: buildTriadHeatmap(events),
    };
  }, [corpus, filters]);
}

// ── Persisted filter store ─────────────────────────────────────────────────────

const DEFAULT_FILTERS: LogocFilters = {
  band: "all",
  mode: "all",
  signClassId: "all",
  migrationPending: "all",
  source: "",
};

interface LogocFilterStore {
  filters: LogocFilters;
  setBand: (band: PragmatismBand | "all") => void;
  setMode: (mode: "ICON" | "INDEX" | "SYMBOL" | "all") => void;
  setSignClassId: (id: number | "all") => void;
  setMigrationPending: (v: boolean | "all") => void;
  setSource: (source: string) => void;
  reset: () => void;
}

export const useLogocFilterStore = create<LogocFilterStore>()(
  persist(
    (set) => ({
      filters: DEFAULT_FILTERS,
      setBand: (band) =>
        set((s) => ({ filters: { ...s.filters, band } })),
      setMode: (mode) =>
        set((s) => ({ filters: { ...s.filters, mode } })),
      setSignClassId: (signClassId) =>
        set((s) => ({ filters: { ...s.filters, signClassId } })),
      setMigrationPending: (migrationPending) =>
        set((s) => ({ filters: { ...s.filters, migrationPending } })),
      setSource: (source) =>
        set((s) => ({ filters: { ...s.filters, source } })),
      reset: () => set({ filters: DEFAULT_FILTERS }),
    }),
    {
      name: "logoc-filters-v1",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({ filters: state.filters }),
    }
  )
);

// ── Persisted HR decisions store ───────────────────────────────────────────────

export type DecisionKind = "approved" | "reclassify" | "rejected" | "escalated";

export interface HRDecision {
  /** Event id this decision applies to. */
  eventId: string;
  /** What the analyst chose. */
  kind: DecisionKind;
  /** For reclassify: the new class id. */
  newClassId?: number;
  /** Optional free-text rationale. */
  note?: string;
  /** ISO timestamp of the decision. */
  decidedAt: string;
}

interface HRDecisionStore {
  byId: Record<string, HRDecision>;
  set: (decision: HRDecision) => void;
  clear: (eventId: string) => void;
  clearAll: () => void;
  importMany: (decisions: HRDecision[]) => void;
  exportAll: () => HRDecision[];
}

export const useHRDecisionStore = create<HRDecisionStore>()(
  persist(
    (set, get) => ({
      byId: {},
      set: (decision) =>
        set((s) => ({ byId: { ...s.byId, [decision.eventId]: decision } })),
      clear: (eventId) =>
        set((s) => {
          const { [eventId]: _, ...rest } = s.byId;
          return { byId: rest };
        }),
      clearAll: () => set({ byId: {} }),
      importMany: (decisions) =>
        set(() => {
          const next: Record<string, HRDecision> = {};
          for (const d of decisions) next[d.eventId] = d;
          return { byId: next };
        }),
      exportAll: () => Object.values(get().byId),
    }),
    {
      name: "logoc-hr-decisions-v1",
      storage: createJSONStorage(() => safeLocalStorage),
    }
  )
);

// ── Derived helpers ────────────────────────────────────────────────────────────

/** Returns the decision for an event, or undefined. */
export function useDecisionFor(eventId: string): HRDecision | undefined {
  return useHRDecisionStore((s) => s.byId[eventId]);
}

/**
 * Apply local HR decisions to a snapshot's events for display purposes.
 * Adds a synthetic `_local_decision` field on the event so consumers can
 * badge/render without leaking decision store internals everywhere.
 */
export function decorateWithDecisions(
  snapshot: LogocCorpusSnapshot | undefined,
  byId: Record<string, HRDecision>
): LogocCorpusSnapshot | undefined {
  if (!snapshot) return snapshot;
  return {
    ...snapshot,
    events: snapshot.events.map((e: LogocEvent & { _local_decision?: HRDecision }) => {
      const d = byId[e.event_id];
      return d ? { ...e, _local_decision: d } : e;
    }),
  };
}

/** Hook: returns the decorated snapshot. */
export function useDecoratedCorpus(snapshot: LogocCorpusSnapshot | undefined) {
  const byId = useHRDecisionStore((s) => s.byId);
  return useMemo(() => decorateWithDecisions(snapshot, byId), [snapshot, byId]);
}

/** Stable selectors for the filter hook. */
export function useLogocFilters() {
  const filters = useLogocFilterStore((s) => s.filters);
  const setters = useLogocFilterStore(
    useShallow((s) => ({
      setBand: s.setBand,
      setMode: s.setMode,
      setSignClassId: s.setSignClassId,
      setMigrationPending: s.setMigrationPending,
      setSource: s.setSource,
      reset: s.reset,
    }))
  );
  return { filters, ...setters };
}

// ── Safe localStorage wrapper (SSR / private mode safe) ───────────────────────

const safeLocalStorage: Storage = {
  get length() {
    return typeof window !== "undefined" ? window.localStorage.length : 0;
  },
  clear() {
    if (typeof window !== "undefined") window.localStorage.clear();
  },
  getItem(key) {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  key(index) {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.key(index);
    } catch {
      return null;
    }
  },
  removeItem(key) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore quota / private mode errors
    }
  },
  setItem(key, value) {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore quota / private mode errors
    }
  },
};
