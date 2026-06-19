import type { backendInterface } from "../backend";
import {
  AgentStatus,
  AlertLevel,
  BuildStatus,
  DeployStepStatus,
  PrimaryMode,
  SecondaryMode,
  SkillCategory,
  TopicRole,
} from "../backend";

export const mockBackend: backendInterface = {
  getMetrics: async () => ({
    cpuLoad: BigInt(42),
    memoryUsage: BigInt(58),
    uptime: BigInt(3600),
    timestamp: BigInt(Date.now() * 1_000_000),
  }),
  getControls: async () => ({
    primaryMode: PrimaryMode.standby,
    armed: false,
    secondaryMode: SecondaryMode.monitor,
  }),
  getConfig: async () => ({
    pollingInterval: BigInt(2000),
    cpuThreshold: BigInt(80),
    responseDelay: BigInt(100),
    memoryThreshold: BigInt(85),
  }),
  getActivityLog: async () => [
    {
      action: "setPrimaryMode",
      oldValue: "active",
      newValue: "standby",
      timestamp: BigInt(Date.now() * 1_000_000 - 60_000_000_000),
    },
    {
      action: "setArmed",
      oldValue: "true",
      newValue: "false",
      timestamp: BigInt(Date.now() * 1_000_000 - 120_000_000_000),
    },
  ],
  setArmed: async (_value: boolean) => ({ __kind__: "ok", ok: null }),
  setPrimaryMode: async (_mode: PrimaryMode) => ({ __kind__: "ok", ok: null }),
  setSecondaryMode: async (_mode: SecondaryMode) => ({ __kind__: "ok", ok: null }),
  updateAgentStatus: async (_update) => ({ __kind__: "ok", ok: null }),
  pushKafkaSignal: async (_signal) => ({ __kind__: "ok", ok: null }),
  updateConfig: async (_cpu: bigint, _mem: bigint, _poll: bigint, _delay: bigint) => ({ __kind__: "ok", ok: null }),

  getIntegrityReport: async () => ({
    overallScore: BigInt(97),
    lastAudit: BigInt(Date.now() * 1_000_000),
    axioms: [
      { id: "AX-001", name: "Philosophical Integrity", description: "Agents are genuine participants, not tools", complianceRate: BigInt(97), driftDetected: false },
      { id: "AX-002", name: "Compressed Constraint Envelope", description: "All agents operate within strict operational boundaries", complianceRate: BigInt(94), driftDetected: false },
      { id: "AX-003", name: "Anti-Hollow-Convergence", description: "Organ names must correspond to authentic operational depth", complianceRate: BigInt(100), driftDetected: false },
      { id: "AX-004", name: "Behavioral Coherence", description: "Agent actions must align with stated mission and domain", complianceRate: BigInt(89), driftDetected: false },
      { id: "AX-005", name: "Gnosis Verification", description: "All integrity claims must be independently verifiable", complianceRate: BigInt(92), driftDetected: false },
    ],
    agents: [
      { name: "Synapse", domain: "Signal Routing", integrityScore: BigInt(98), axiomDrift: BigInt(1), status: AgentStatus.active, lastCalibrated: "2026-05-07T09:42:00Z", alertLevel: AlertLevel.nominal },
      { name: "Vox", domain: "Narrative Intelligence", integrityScore: BigInt(96), axiomDrift: BigInt(2), status: AgentStatus.active, lastCalibrated: "2026-05-07T09:30:00Z", alertLevel: AlertLevel.caution },
      { name: "Pneuma", domain: "Market Intelligence", integrityScore: BigInt(94), axiomDrift: BigInt(4), status: AgentStatus.advisory, lastCalibrated: "2026-05-07T08:00:00Z", alertLevel: AlertLevel.warning },
    ],
  }),

  getBuildPipeline: async () => ({
    summary: { majorAreas: BigInt(28), majorDone: BigInt(21), layerItems: BigInt(99), layerDone: BigInt(81), lastUpdated: BigInt(Date.now() * 1_000_000) },
    areas: [
      // Layer 1 — Foundation & Axioms
      { id: "l1-axioms", name: "Core Axiom Framework", layer: BigInt(1), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l1-philosophy", name: "Philosophical Ground Rules", layer: BigInt(1), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 2 — Agent Core
      { id: "l2-synapse", name: "Synapse Agent Runtime", layer: BigInt(2), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l2-vox", name: "Vox Agent Runtime", layer: BigInt(2), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l2-pneuma", name: "Pneuma Agent Runtime", layer: BigInt(2), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 3 — Organ System
      { id: "l3-hepar", name: "Hepar Forensic Engine", layer: BigInt(3), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l3-cortex", name: "Cortex Strategic Intelligence", layer: BigInt(3), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l3-cardia", name: "Cardia Capital Engine", layer: BigInt(3), status: BuildStatus.partial, completionPct: BigInt(70) },
      // Layer 4 — Signal Routing
      { id: "l4-routing", name: "4-Domain Signal Router", layer: BigInt(4), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l4-escalation", name: "Adaptive Escalation Logic", layer: BigInt(4), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 5 — Narrative Intelligence
      { id: "l5-capture", name: "Narrative Capture Pipeline", layer: BigInt(5), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l5-truth", name: "Truth Verification Engine", layer: BigInt(5), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 6 — Market Intelligence
      { id: "l6-intake", name: "Price & Liquidity Intake", layer: BigInt(6), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l6-regime", name: "Market Regime Classifier", layer: BigInt(6), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 7 — Forensic Analysis
      { id: "l7-static", name: "Static Analysis Stage", layer: BigInt(7), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l7-symbolic", name: "Symbolic Execution Stage", layer: BigInt(7), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l7-consensus", name: "Consensus Fusion Stage", layer: BigInt(7), status: BuildStatus.partial, completionPct: BigInt(80) },
      // Layer 8 — Capital Allocation
      { id: "l8-cardia-gate", name: "Cardia Capital Gate", layer: BigInt(8), status: BuildStatus.blocked, completionPct: BigInt(40) },
      { id: "l8-authorization", name: "Capital Authorization Flow", layer: BigInt(8), status: BuildStatus.blocked, completionPct: BigInt(30) },
      // Layer 9 — Network Coordination
      { id: "l9-kafka", name: "Kafka Event Bus Integration", layer: BigInt(9), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l9-topology", name: "Agent Topology Wiring", layer: BigInt(9), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 10 — Integrity & Gnosis
      { id: "l10-gnosis", name: "Gnosis Integrity Layer", layer: BigInt(10), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l10-axiom-drift", name: "Axiom Drift Detection", layer: BigInt(10), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 11 — Build Pipeline
      { id: "l11-tracker", name: "Build Progress Tracker", layer: BigInt(11), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l11-status", name: "Component Status System", layer: BigInt(11), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 12 — Deployment
      { id: "l12-docker", name: "Docker Compose Configuration", layer: BigInt(12), status: BuildStatus.partial, completionPct: BigInt(60) },
      { id: "l12-dfx", name: "DFX Canister Deploy Scripts", layer: BigInt(12), status: BuildStatus.partial, completionPct: BigInt(50) },
      // Layer 13 — Cost & Infrastructure
      { id: "l13-model", name: "Cost Modeling Engine", layer: BigInt(13), status: BuildStatus.done, completionPct: BigInt(100) },
      { id: "l13-cycles", name: "IC Cycles Estimator", layer: BigInt(13), status: BuildStatus.done, completionPct: BigInt(100) },
      // Layer 14 — Ecosystem Governance
      { id: "l14-governance", name: "Governance Framework", layer: BigInt(14), status: BuildStatus.notStarted, completionPct: BigInt(0) },
      { id: "l14-rules", name: "Governance Rule Engine", layer: BigInt(14), status: BuildStatus.notStarted, completionPct: BigInt(0) },
      // Layer 15 — System State
      { id: "l15-observability", name: "System Observability Layer", layer: BigInt(15), status: BuildStatus.partial, completionPct: BigInt(65) },
      { id: "l15-telemetry", name: "Real-time Telemetry", layer: BigInt(15), status: BuildStatus.done, completionPct: BigInt(100) },
    ],
  }),

  getKafkaTopology: async () => ({
    totalMessages: BigInt(142580),
    topics: [
      { id: "t1", name: "topic.market_data", description: "Market data events", messageCount: BigInt(50000), throughput: BigInt(120) },
      { id: "t2", name: "topic.auth_events", description: "Authentication events", messageCount: BigInt(12000), throughput: BigInt(30) },
      { id: "t3", name: "topic.pattern_analysis", description: "Pattern recognition outputs", messageCount: BigInt(80580), throughput: BigInt(200) },
    ],
    connections: [
      { fromAgent: "agent.synapse", toTopic: "topic.market_data", connectionType: TopicRole.publisher },
      { fromAgent: "agent.pneuma", toTopic: "topic.market_data", connectionType: TopicRole.subscriber },
      { fromAgent: "agent.vox", toTopic: "topic.pattern_analysis", connectionType: TopicRole.publisher },
      { fromAgent: "agent.hepar", toTopic: "topic.auth_events", connectionType: TopicRole.both },
    ],
  }),

  getSkillsMatrix: async () => ({
    sharedSkills: ["Aligning Adaptability", "Self-Improvement", "Pattern Recognition"],
    agents: [
      {
        agentName: "Synapse",
        domain: "Signal Routing",
        overallRating: BigInt(92),
        skills: [
          { name: "Event Bus Management", category: SkillCategory.core, level: BigInt(9), isShared: false },
          { name: "Aligning Adaptability", category: SkillCategory.integrity, level: BigInt(8), isShared: true },
          { name: "Message Queue Optimization", category: SkillCategory.domain, level: BigInt(9), isShared: false },
        ],
      },
      {
        agentName: "Vox",
        domain: "Narrative Intelligence",
        overallRating: BigInt(88),
        skills: [
          { name: "Narrative Synthesis", category: SkillCategory.domain, level: BigInt(9), isShared: false },
          { name: "Aligning Adaptability", category: SkillCategory.integrity, level: BigInt(7), isShared: true },
          { name: "Self-Improvement", category: SkillCategory.integrity, level: BigInt(8), isShared: true },
        ],
      },
      {
        agentName: "Pneuma",
        domain: "Market Intelligence",
        overallRating: BigInt(85),
        skills: [
          { name: "Market Pattern Recognition", category: SkillCategory.domain, level: BigInt(9), isShared: false },
          { name: "Pattern Recognition", category: SkillCategory.core, level: BigInt(8), isShared: true },
          { name: "Self-Improvement", category: SkillCategory.integrity, level: BigInt(7), isShared: true },
        ],
      },
    ],
  }),

  getCostModel: async () => ({
    cyclesPerHour: BigInt(1_000_000_000),
    rpcCallsPerHour: BigInt(500),
    gasFeePerTx: BigInt(10000),
    agentCount: BigInt(3),
    storageGB: BigInt(10),
  }),

  estimateCost: async (_model) => ({
    cycleCost: BigInt(2_400_000_000),
    rpcCost: BigInt(12000),
    gasCost: BigInt(240000),
    storageCost: BigInt(50000),
    totalCostIcp: BigInt(3),
    totalCostUsd: BigInt(35),
  }),

  updateCostModel: async (_model) => ({ __kind__: "ok", ok: null }),

  getDeploymentSteps: async () => [
    { stepNumber: BigInt(1), component: "HEPAR", command: "docker compose -f docker-compose.hepar.yml up -d && dfx deploy hepar --network ic", status: DeployStepStatus.pending, description: "Deploy Hepar forensic intelligence engine", notes: "Hepar must be live before routing agents" },
    { stepNumber: BigInt(2), component: "SYNAPSE", command: "docker compose -f docker-compose.synapse.yml up -d && dfx deploy synapse --network ic", status: DeployStepStatus.pending, description: "Deploy Synapse signal intake and adaptive routing", notes: undefined },
    { stepNumber: BigInt(3), component: "VOX", command: "docker compose -f docker-compose.vox.yml up -d && dfx deploy vox --network ic", status: DeployStepStatus.pending, description: "Deploy Vox narrative intelligence and truth verification", notes: undefined },
    { stepNumber: BigInt(4), component: "PNEUMA", command: "docker compose -f docker-compose.pneuma.yml up -d && dfx deploy pneuma --network ic", status: DeployStepStatus.pending, description: "Deploy Pneuma market intelligence and execution engine", notes: undefined },
    { stepNumber: BigInt(5), component: "CARDIA", command: "docker compose -f docker-compose.cardia.yml up -d && dfx deploy cardia --network ic", status: DeployStepStatus.pending, description: "Deploy Cardia capital allocation engine — CAPITAL-GATED", notes: "Requires explicit capital authorization before activation" },
    { stepNumber: BigInt(6), component: "ECOSYSTEM", command: "docker compose -f docker-compose.sovereign-monad.yml up -d", status: DeployStepStatus.pending, description: "Activate full ecosystem coordination", notes: "All agents must be live before activating full coordination" },
  ],

  getDeploymentConfig: async () => ({
    environment: "mainnet",
    networkId: "ic",
    deployedComponents: ["ICP Network", "Synapse Agent"],
    lastDeployTime: BigInt(Date.now() * 1_000_000 - 3_600_000_000_000),
  }),

  markStepComplete: async (_stepNumber: bigint) => ({ __kind__: "ok", ok: null }),
  resetDeployment: async () => {},
};
