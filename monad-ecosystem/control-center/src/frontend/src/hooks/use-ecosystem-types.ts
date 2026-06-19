// Re-export ecosystem types for hooks — avoids circular dependency
export type {
  IntegrityReport,
  BuildPipeline,
  KafkaTopology,
  SkillsMatrix,
  CostModel,
  CostEstimate,
  DeployStep,
  DeploymentConfig,
} from "@/backend";
