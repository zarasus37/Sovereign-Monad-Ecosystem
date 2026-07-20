// ─── Hepar Core: Shared Types ────────────────────────────────────────────────
//
// Stage A–D forensic pipeline types for the Sovereign Monad Hepar scanner.
// All verdicts are deterministic given the same seed and address inputs.

export type AgentId = 'PRIVILEGE' | 'ARITHMETIC' | 'REENTRANCY' | 'ECONOMIC' | 'STATE';
export type ActionBand = 'BLOCK' | 'WARN' | 'ALLOW' | 'INVESTIGATE';
export type ExecutionStatus = 'STUB' | 'LIVE';

// ── Stage A ──────────────────────────────────────────────────────────────────

export type PatternType =
  | 'PROXY_ADMIN'
  | 'LP_UNLOCK'
  | 'WALLET_TAINT'
  | 'ADVERSARIAL_SIGNAL'
  | 'BYTECODE_ANOMALY';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface StaticFinding {
  id: string;
  pattern: PatternType;
  severity: Severity;
  confidence: number; // 0.0–1.0
  description: string;
  address?: string;
}

export interface StageAResult {
  protocolId: string;
  addresses: string[];
  findings: StaticFinding[];
  executionStatus: ExecutionStatus;
  durationMs: number;
}

export interface StageAConfig {
  bytecodeThreshold?: number;
  patternMatchingDepth?: number;
}

// ── Stage B ──────────────────────────────────────────────────────────────────

export interface InvariantViolation {
  findingId: string;
  invariant: string;
  proved: boolean;
  confidence: number;
  proofTerm: string;
  severity: Severity;
}

export interface StageBResult {
  protocolId: string;
  violations: InvariantViolation[];
  executionStatus: ExecutionStatus;
  durationMs: number;
}

export interface StageBConfig {
  timeoutPerInvariant?: number;
  allowStubMode?: boolean;
}

// ── Stage C ──────────────────────────────────────────────────────────────────

export interface AgentFinding {
  agentId: AgentId;
  findingId: string;
  severity: Severity;
  confidence: number;
  description: string;
  pathHash: string;
}

export interface AgentCampaignResult {
  agentId: AgentId;
  findings: AgentFinding[];
  pathsExplored: number;
  coverageRatio: number;
  executionTimeMs: number;
  vote: ActionBand;
}

export interface StageCResult {
  protocolId: string;
  campaigns: AgentCampaignResult[];
  aggregatedFindings: AgentFinding[];
  executionStatus: ExecutionStatus;
  durationMs: number;
}

export interface StageCConfig {
  pathsPerAgent?: number;
  agentsToRun?: AgentId[];
  masterSeed?: string;
  timeoutMs?: number;
  allowStubMode?: boolean;
}

// ── Stage D ──────────────────────────────────────────────────────────────────

export interface AttestationPayload {
  protocolId: string;
  decision: ActionBand;
  confidence: number;
  timestamp: string;
  stageAFindings: number;
  stageBViolations: number;
  stageCCampaigns: number;
  topSeverity: Severity;
  executionStatus: ExecutionStatus;
}

export interface StageDResult {
  protocolId: string;
  decision: ActionBand;
  confidence: number;
  votes: Record<string, ActionBand>;
  attestation: AttestationPayload;
  escalationPaths: string[];
  executionStatus: ExecutionStatus;
  durationMs: number;
}

export interface StageDConfig {
  consensusThreshold?: number;
  severityWeights?: Partial<Record<ActionBand, number>>;
  allowPartialConsensus?: boolean;
}

// ── Full Pipeline ─────────────────────────────────────────────────────────────

export interface HeparPipelineResult {
  protocolId: string;
  addresses: string[];
  stageA?: StageAResult;
  stageB?: StageBResult;
  stageC?: StageCResult;
  stageD?: StageDResult;
  totalDurationMs: number;
}

export interface HeparOrchestratorConfig {
  stageA?: StageAConfig;
  stageB?: StageBConfig;
  stageC?: StageCConfig;
  stageD?: StageDConfig;
}

// ── HTTP Request/Response (for the microservice) ───────────────────────────

export interface HeparAuditRequest {
  walletAddress: string;
  protocolId?: string;
  contractAddresses?: string[];
  campaignSeed?: string;
}

export interface HeparAuditResponse {
  auditId: string;
  walletAddress: string;
  verdict: 'PASS' | 'FAIL_MALICIOUS_CONTRACT' | 'FAIL_ADVERSE_SELECTION' | 'WARN_INVESTIGATE';
  score: number;         // 0.0 = clean, 1.0 = fully malicious
  decision: ActionBand;
  confidence: number;
  attestation: AttestationPayload;
  stageResults: {
    stageA: { findings: number; topSeverity: Severity | null };
    stageB: { violations: number };
    stageC: { campaigns: number; aggregatedFindings: number };
  };
  executionStatus: ExecutionStatus;
  durationMs: number;
}
