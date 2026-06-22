/**
 * use-logoc.ts
 *
 * React Query hooks for the LOGOC corpus REST endpoints.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  type LogocCorpusSnapshot,
  type LogocEvent,
  type LogocFilters,
  type PragmatismBand,
  fetchCorpusSnapshot,
  filterEvents,
  buildBandDistribution,
  buildClassDistribution,
  buildPpsBandScatter,
  buildTriadHeatmap,
  computePps,
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

// ── Filter state hook ──────────────────────────────────────────────────────────

export function useLogocFilters() {
  const [filters, setFilters] = useState<LogocFilters>({
    band: "all",
    mode: "all",
    signClassId: "all",
    migrationPending: "all",
    source: "",
  });

  const setBand = (band: PragmatismBand | "all") =>
    setFilters((f) => ({ ...f, band }));
  const setMode = (mode: "ICON" | "INDEX" | "SYMBOL" | "all") =>
    setFilters((f) => ({ ...f, mode }));
  const setMigrationPending = (v: boolean | "all") =>
    setFilters((f) => ({ ...f, migrationPending: v }));
  const setSource = (source: string) =>
    setFilters((f) => ({ ...f, source }));
  const reset = () =>
    setFilters({
      band: "all",
      mode: "all",
      signClassId: "all",
      migrationPending: "all",
      source: "",
    });

  return { filters, setBand, setMode, setMigrationPending, setSource, reset };
}
