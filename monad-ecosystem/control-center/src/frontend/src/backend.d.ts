import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Axiom {
    id: string;
    complianceRate: bigint;
    name: string;
    description: string;
    driftDetected: boolean;
}
export interface IntegrityReport {
    axioms: Array<Axiom>;
    overallScore: bigint;
    agents: Array<IntegrityAgent>;
    lastAudit: bigint;
}
export interface KafkaTopic {
    id: string;
    name: string;
    description: string;
    messageCount: bigint;
    throughput: bigint;
}
export interface CostModel {
    cyclesPerHour: bigint;
    gasFeePerTx: bigint;
    storageGB: bigint;
    agentCount: bigint;
    rpcCallsPerHour: bigint;
}
export interface SkillsMatrix {
    agents: Array<AgentCapabilities>;
    sharedSkills: Array<string>;
}
export interface CostEstimate {
    cycleCost: bigint;
    storageCost: bigint;
    rpcCost: bigint;
    totalCostIcp: bigint;
    totalCostUsd: bigint;
    gasCost: bigint;
}
export interface BuildSummary {
    lastUpdated: bigint;
    layerItems: bigint;
    layerDone: bigint;
    majorAreas: bigint;
    majorDone: bigint;
}
export interface KafkaConnection {
    connectionType: TopicRole;
    fromAgent: string;
    toTopic: string;
}
export interface DeploymentConfig {
    lastDeployTime?: bigint;
    environment: string;
    deployedComponents: Array<string>;
    networkId: string;
}
export interface DeployStep {
    status: DeployStepStatus;
    component: string;
    description: string;
    command: string;
    stepNumber: bigint;
    notes?: string;
}
export interface BuildArea {
    id: string;
    status: BuildStatus;
    completionPct: bigint;
    name: string;
    layer: bigint;
}
export interface BuildPipeline {
    areas: Array<BuildArea>;
    summary: BuildSummary;
}
export interface KafkaTopology {
    totalMessages: bigint;
    connections: Array<KafkaConnection>;
    topics: Array<KafkaTopic>;
}
export interface Controls {
    primaryMode: PrimaryMode;
    armed: boolean;
    secondaryMode: SecondaryMode;
}
export interface AgentCapabilities {
    domain: string;
    agentName: string;
    overallRating: bigint;
    skills: Array<AgentSkill>;
}
export interface Config {
    pollingInterval: bigint;
    cpuThreshold: bigint;
    responseDelay: bigint;
    memoryThreshold: bigint;
}
export interface IntegrityAgent {
    lastCalibrated: string;
    status: AgentStatus;
    domain: string;
    axiomDrift: bigint;
    name: string;
    alertLevel: AlertLevel;
    integrityScore: bigint;
}
export type Result = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: string;
};
export interface LogEntry {
    action: string;
    oldValue: string;
    newValue: string;
    timestamp: bigint;
}
export interface AgentStatusUpdate {
    agentName: string;
    domain: string;
    status: AgentStatus;
    alertLevel: AlertLevel;
    integrityScore: bigint;
    axiomDrift: bigint;
    lastCalibrated: string;
    cpuLoad?: bigint;
    memoryUsage?: bigint;
    uptime?: bigint;
    source: string;
}
export interface KafkaSignal {
    sourceAgent: string;
    topicId: string;
    topicName: string;
    description: string;
    messageCountDelta: bigint;
    throughput: bigint;
}
export interface AgentSkill {
    name: string;
    level: bigint;
    isShared: boolean;
    category: SkillCategory;
}
export interface Metrics {
    cpuLoad: bigint;
    memoryUsage: bigint;
    uptime: bigint;
    timestamp: bigint;
}
export enum AgentStatus {
    active = "active",
    gated = "gated",
    offline = "offline",
    advisory = "advisory"
}
export enum AlertLevel {
    warning = "warning",
    nominal = "nominal",
    caution = "caution",
    critical = "critical"
}
export enum BuildStatus {
    notStarted = "notStarted",
    done = "done",
    blocked = "blocked",
    partial = "partial"
}
export enum DeployStepStatus {
    pending = "pending",
    skipped = "skipped",
    complete = "complete",
    failed = "failed",
    running = "running"
}
export enum PrimaryMode {
    active = "active",
    standby = "standby",
    diagnostic = "diagnostic"
}
export enum SecondaryMode {
    control = "control",
    optimize = "optimize",
    monitor = "monitor"
}
export enum SkillCategory {
    integration = "integration",
    domain = "domain",
    core = "core",
    integrity = "integrity"
}
export enum TopicRole {
    both = "both",
    publisher = "publisher",
    subscriber = "subscriber"
}
export interface backendInterface {
    estimateCost(model: CostModel): Promise<CostEstimate>;
    getActivityLog(): Promise<Array<LogEntry>>;
    getBuildPipeline(): Promise<BuildPipeline>;
    getConfig(): Promise<Config>;
    getControls(): Promise<Controls>;
    getCostModel(): Promise<CostModel>;
    getDeploymentConfig(): Promise<DeploymentConfig>;
    getDeploymentSteps(): Promise<Array<DeployStep>>;
    getIntegrityReport(): Promise<IntegrityReport>;
    getKafkaTopology(): Promise<KafkaTopology>;
    getMetrics(): Promise<Metrics>;
    getSkillsMatrix(): Promise<SkillsMatrix>;
    pushKafkaSignal(signal: KafkaSignal): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    markStepComplete(stepNumber: bigint): Promise<Result>;
    resetDeployment(): Promise<void>;
    setArmed(value: boolean): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setPrimaryMode(mode: PrimaryMode): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setSecondaryMode(mode: SecondaryMode): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateAgentStatus(update: AgentStatusUpdate): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateConfig(newCpuThreshold: bigint, newMemThreshold: bigint, newPollingInterval: bigint, newResponseDelay: bigint): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    updateCostModel(model: CostModel): Promise<Result>;
}
