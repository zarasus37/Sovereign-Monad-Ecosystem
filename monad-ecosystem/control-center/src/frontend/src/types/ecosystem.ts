// Sovereign Monad — ecosystem TypeScript types
// Mirrors backend.d.ts with camelCase and BigInt for Nat fields

export type {
  Axiom,
  IntegrityAgent,
  IntegrityReport,
  BuildArea,
  BuildPipeline,
  BuildSummary,
  KafkaTopic,
  KafkaConnection,
  KafkaTopology,
  AgentSkill,
  AgentCapabilities,
  SkillsMatrix,
  CostModel,
  CostEstimate,
  DeployStep,
  DeploymentConfig,
} from "@/backend";

export {
  AgentStatus,
  AlertLevel,
  BuildStatus,
  DeployStepStatus,
  SkillCategory,
  TopicRole,
} from "@/backend";
