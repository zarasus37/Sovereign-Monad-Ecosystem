/**
 * Phase 1 Broken Genesis types — mirrors @sovereign/types onboarding contract.
 * Control-center keeps a local copy so Vite need not resolve the monorepo package.
 * Keep in sync with monad-ecosystem/packages/sovereign-types/src/types/onboarding.ts
 */

export type DomainType = "THEO" | "TECHNO" | "COSMO";

export interface CircuitNode {
  id: DomainType;
  label: string;
  energy: number;
  capacity: number;
  floor: number;
}

export interface WireConnection {
  id: string;
  from: "SOURCE" | DomainType;
  to: "SOURCE" | DomainType;
  throughput: number;
}

export type TelemetryAction =
  | "SELECT"
  | "DESELECT"
  | "ROUTE"
  | "INSPECT"
  | "OVERLOAD"
  | "STARVE"
  | "STABILIZE";

export interface BehavioralTelemetry {
  nodeId: DomainType | "SOURCE";
  action: TelemetryAction;
  timestamp: number;
  decisionLatency: number;
  meta?: Record<string, unknown>;
}

export interface Phase1ProfileWeights {
  theoWeight: number;
  technoWeight: number;
  cosmoWeight: number;
}

export interface CognitiveTwinSeedUi {
  principalId: string;
  theoShare: number;
  technoShare: number;
  cosmoShare: number;
  methodDiversity: number;
  reasoningExposure: number;
  overloadCount: number;
  starveCount: number;
  meanDecisionLatencyMs: number;
  routeCounts: Record<DomainType, number>;
  stabilizedAt: number;
  constraintEnvelopeVersion: string;
  profileWeights: Phase1ProfileWeights;
}

export interface Phase1Completion {
  twin: CognitiveTwinSeedUi;
  telemetry: BehavioralTelemetry[];
  nodes: CircuitNode[];
  profileWeights: Phase1ProfileWeights;
}

/** gate-acl-shaped local PL write after structural verify. */
export interface GenesisPlRecord {
  kind: "domain_task";
  eventId: string;
  principalId: string;
  domain: string;
  taskId: "broken-genesis-repair";
  outcome: "passed" | "failed";
  verifiedBy: "task-verifier" | "client";
  at: number;
  constraintEnvelopeVersion: string;
  profileWeights: Phase1ProfileWeights;
}

/** CURRENT constraint pack for first compiled envelope (not a silent 1.0.0 regression). */
export const ONBOARDING_CONSTRAINT_ENVELOPE_VERSION = "1.1.0";
