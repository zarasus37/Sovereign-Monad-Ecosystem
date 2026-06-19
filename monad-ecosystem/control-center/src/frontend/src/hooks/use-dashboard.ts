// Dashboard React Query hooks — all backend data + mutations
// Polls metrics every 3s, controls/config/log every 5s
// Uses generated backend.d.ts types — PrimaryMode/SecondaryMode are enums

import { PrimaryMode, SecondaryMode, createActor } from "@/backend";
import type { Config, Controls, LogEntry, Metrics } from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// Re-export enum types for use in components
export { PrimaryMode, SecondaryMode };

// Query keys
export const QUERY_KEYS = {
  metrics: ["metrics"] as const,
  controls: ["controls"] as const,
  config: ["config"] as const,
  activityLog: ["activityLog"] as const,
};

function useDashboardActor() {
  const { actor, isFetching } = useActor(createActor);
  return { actor, isFetching };
}

// Helper to check backend result — uses __kind__ discriminant
function assertOk(
  result: { __kind__: "ok"; ok: null } | { __kind__: "err"; err: string },
): void {
  if (result.__kind__ === "err") throw new Error(result.err);
}

// ─── Queries ───────────────────────────────────────────────────

export function useMetrics() {
  const { actor, isFetching } = useDashboardActor();
  return useQuery<Metrics>({
    queryKey: QUERY_KEYS.metrics,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getMetrics();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 3_000,
    staleTime: 2_000,
  });
}

export function useControls() {
  const { actor, isFetching } = useDashboardActor();
  return useQuery<Controls>({
    queryKey: QUERY_KEYS.controls,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getControls();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}

export function useConfig() {
  const { actor, isFetching } = useDashboardActor();
  return useQuery<Config>({
    queryKey: QUERY_KEYS.config,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getConfig();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}

export function useActivityLog() {
  const { actor, isFetching } = useDashboardActor();
  return useQuery<LogEntry[]>({
    queryKey: QUERY_KEYS.activityLog,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getActivityLog();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}

// ─── Mutations ─────────────────────────────────────────────────

export function useSetArmed() {
  const { actor } = useDashboardActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (armed: boolean) => {
      if (!actor) throw new Error("Actor not ready");
      assertOk(await actor.setArmed(armed));
    },
    onMutate: async (armed) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.controls });
      const prev = qc.getQueryData<Controls>(QUERY_KEYS.controls);
      qc.setQueryData<Controls>(QUERY_KEYS.controls, (old) =>
        old ? { ...old, armed } : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.controls, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.controls });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.activityLog });
    },
  });
}

export function useSetPrimaryMode() {
  const { actor } = useDashboardActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: PrimaryMode) => {
      if (!actor) throw new Error("Actor not ready");
      assertOk(await actor.setPrimaryMode(mode));
    },
    onMutate: async (primaryMode) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.controls });
      const prev = qc.getQueryData<Controls>(QUERY_KEYS.controls);
      qc.setQueryData<Controls>(QUERY_KEYS.controls, (old) =>
        old ? { ...old, primaryMode } : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.controls, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.controls });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.activityLog });
    },
  });
}

export function useSetSecondaryMode() {
  const { actor } = useDashboardActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: SecondaryMode) => {
      if (!actor) throw new Error("Actor not ready");
      assertOk(await actor.setSecondaryMode(mode));
    },
    onMutate: async (secondaryMode) => {
      await qc.cancelQueries({ queryKey: QUERY_KEYS.controls });
      const prev = qc.getQueryData<Controls>(QUERY_KEYS.controls);
      qc.setQueryData<Controls>(QUERY_KEYS.controls, (old) =>
        old ? { ...old, secondaryMode } : old,
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEYS.controls, ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.controls });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.activityLog });
    },
  });
}

export function useUpdateConfig() {
  const { actor } = useDashboardActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      cpuThreshold: number;
      memoryThreshold: number;
      pollingInterval: number;
      responseDelay: number;
    }) => {
      if (!actor) throw new Error("Actor not ready");
      assertOk(
        await actor.updateConfig(
          BigInt(params.cpuThreshold),
          BigInt(params.memoryThreshold),
          BigInt(params.pollingInterval),
          BigInt(params.responseDelay),
        ),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.config });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.activityLog });
    },
  });
}
