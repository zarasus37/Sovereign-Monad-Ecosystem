// Sovereign Monad — ecosystem React Query hooks
// Covers all 6 new backend panel endpoints + mutations

import {
  type BuildPipeline,
  type CostEstimate,
  type CostModel,
  type DeployStep,
  type DeploymentConfig,
  type IntegrityReport,
  type KafkaTopology,
  type SkillsMatrix,
  createActor,
} from "@/backend";
import { useActor } from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type {
  IntegrityReport,
  BuildPipeline,
  KafkaTopology,
  SkillsMatrix,
  CostModel,
  CostEstimate,
  DeployStep,
  DeploymentConfig,
};

function useEcosystemActor() {
  return useActor(createActor);
}

export const ECOSYSTEM_KEYS = {
  integrityReport: ["integrityReport"] as const,
  buildPipeline: ["buildPipeline"] as const,
  kafkaTopology: ["kafkaTopology"] as const,
  skillsMatrix: ["skillsMatrix"] as const,
  costModel: ["costModel"] as const,
  deploymentSteps: ["deploymentSteps"] as const,
  deploymentConfig: ["deploymentConfig"] as const,
};

// ─── Queries ───────────────────────────────────────────────────

export function useIntegrityReport() {
  const { actor, isFetching } = useEcosystemActor();
  return useQuery({
    queryKey: ECOSYSTEM_KEYS.integrityReport,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getIntegrityReport();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}

export function useBuildPipeline() {
  const { actor, isFetching } = useEcosystemActor();
  return useQuery({
    queryKey: ECOSYSTEM_KEYS.buildPipeline,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getBuildPipeline();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 10_000,
    staleTime: 8_000,
  });
}

export function useKafkaTopology() {
  const { actor, isFetching } = useEcosystemActor();
  return useQuery({
    queryKey: ECOSYSTEM_KEYS.kafkaTopology,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getKafkaTopology();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 5_000,
    staleTime: 4_000,
  });
}

export function useSkillsMatrix() {
  const { actor, isFetching } = useEcosystemActor();
  return useQuery({
    queryKey: ECOSYSTEM_KEYS.skillsMatrix,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getSkillsMatrix();
    },
    enabled: !!actor && !isFetching,
    staleTime: 60_000,
  });
}

export function useCostModel() {
  const { actor, isFetching } = useEcosystemActor();
  return useQuery({
    queryKey: ECOSYSTEM_KEYS.costModel,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getCostModel();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

export function useDeploymentSteps() {
  const { actor, isFetching } = useEcosystemActor();
  return useQuery({
    queryKey: ECOSYSTEM_KEYS.deploymentSteps,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getDeploymentSteps();
    },
    enabled: !!actor && !isFetching,
    refetchInterval: 3_000,
    staleTime: 2_000,
  });
}

export function useDeploymentConfig() {
  const { actor, isFetching } = useEcosystemActor();
  return useQuery({
    queryKey: ECOSYSTEM_KEYS.deploymentConfig,
    queryFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      return actor.getDeploymentConfig();
    },
    enabled: !!actor && !isFetching,
    staleTime: 30_000,
  });
}

// ─── Mutations ─────────────────────────────────────────────────

export function useEstimateCost() {
  const { actor } = useEcosystemActor();
  return useMutation<CostEstimate, Error, CostModel>({
    mutationFn: async (model) => {
      if (!actor) throw new Error("Actor not ready");
      return actor.estimateCost(model);
    },
  });
}

export function useUpdateCostModel() {
  const { actor } = useEcosystemActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (model: CostModel) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.updateCostModel(model);
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ECOSYSTEM_KEYS.costModel });
    },
  });
}

export function useMarkStepComplete() {
  const { actor } = useEcosystemActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stepNumber: bigint) => {
      if (!actor) throw new Error("Actor not ready");
      const result = await actor.markStepComplete(stepNumber);
      if (result.__kind__ === "err") throw new Error(result.err);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ECOSYSTEM_KEYS.deploymentSteps });
      qc.invalidateQueries({ queryKey: ECOSYSTEM_KEYS.deploymentConfig });
    },
  });
}

export function useResetDeployment() {
  const { actor } = useEcosystemActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("Actor not ready");
      await actor.resetDeployment();
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ECOSYSTEM_KEYS.deploymentSteps });
      qc.invalidateQueries({ queryKey: ECOSYSTEM_KEYS.deploymentConfig });
    },
  });
}
