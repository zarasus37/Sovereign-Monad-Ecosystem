/**
 * Derive Cognitive Twin seed from Phase 1 behavioral telemetry.
 * Pure functions — testable without React.
 */

import type {
  BehavioralTelemetry,
  CircuitNode,
  CognitiveTwinSeedUi,
  DomainType,
  Phase1ProfileWeights,
} from "@/types/broken-genesis";
import { ONBOARDING_CONSTRAINT_ENVELOPE_VERSION } from "@/types/broken-genesis";

export function entropyNormalized(items: string[]): number {
  if (items.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  const n = items.length;
  let h = 0;
  for (const c of counts.values()) {
    const p = c / n;
    h -= p * Math.log(p);
  }
  const max = Math.log(counts.size || 1);
  return max === 0 ? 0 : h / max;
}

export function profileWeightsFromNodes(nodes: CircuitNode[]): Phase1ProfileWeights {
  return {
    theoWeight: nodes.find((n) => n.id === "THEO")?.energy ?? 0,
    technoWeight: nodes.find((n) => n.id === "TECHNO")?.energy ?? 0,
    cosmoWeight: nodes.find((n) => n.id === "COSMO")?.energy ?? 0,
  };
}

export function buildTwinSeed(
  principalId: string,
  nodes: CircuitNode[],
  telemetry: BehavioralTelemetry[],
  stabilizedAt: number = Date.now(),
): CognitiveTwinSeedUi {
  const routeCounts: Record<DomainType, number> = {
    THEO: 0,
    TECHNO: 0,
    COSMO: 0,
  };
  const routeTemplates: string[] = [];
  let inspectCount = 0;
  let routeCount = 0;
  let overloadCount = 0;
  let starveCount = 0;
  let latencySum = 0;
  let latencyN = 0;

  for (const e of telemetry) {
    if (e.action === "ROUTE" && e.nodeId !== "SOURCE") {
      routeCounts[e.nodeId] += 1;
      routeTemplates.push(`ROUTE:${e.nodeId}`);
      routeCount += 1;
      latencySum += e.decisionLatency;
      latencyN += 1;
    }
    if (e.action === "INSPECT") inspectCount += 1;
    if (e.action === "OVERLOAD") overloadCount += 1;
    if (e.action === "STARVE") starveCount += 1;
    // HCD-5-style: high latency on any consequential action
    if (
      (e.action === "ROUTE" || e.action === "SELECT" || e.action === "INSPECT") &&
      e.decisionLatency > 0
    ) {
      if (e.action !== "ROUTE") {
        latencySum += e.decisionLatency;
        latencyN += 1;
      }
    }
  }

  const energyTotal = nodes.reduce((s, n) => s + n.energy, 0) || 1;
  const fromEnergy = {
    THEO: (nodes.find((n) => n.id === "THEO")?.energy ?? 0) / energyTotal,
    TECHNO: (nodes.find((n) => n.id === "TECHNO")?.energy ?? 0) / energyTotal,
    COSMO: (nodes.find((n) => n.id === "COSMO")?.energy ?? 0) / energyTotal,
  };
  const routeTotal = routeCounts.THEO + routeCounts.TECHNO + routeCounts.COSMO;
  const theoShare =
    routeTotal > 0 ? routeCounts.THEO / routeTotal : fromEnergy.THEO;
  const technoShare =
    routeTotal > 0 ? routeCounts.TECHNO / routeTotal : fromEnergy.TECHNO;
  const cosmoShare =
    routeTotal > 0 ? routeCounts.COSMO / routeTotal : fromEnergy.COSMO;

  const profileWeights = profileWeightsFromNodes(nodes);

  return {
    principalId,
    theoShare,
    technoShare,
    cosmoShare,
    methodDiversity: entropyNormalized(routeTemplates),
    reasoningExposure: routeCount === 0 ? 0 : Math.min(1, inspectCount / routeCount),
    overloadCount,
    starveCount,
    meanDecisionLatencyMs: latencyN === 0 ? 0 : latencySum / latencyN,
    routeCounts,
    stabilizedAt,
    constraintEnvelopeVersion: ONBOARDING_CONSTRAINT_ENVELOPE_VERSION,
    profileWeights,
  };
}

/** Stability band (UMS): floors met, no overloads, total energy in (60, 95). */
export function isCircuitStable(nodes: CircuitNode[]): boolean {
  const allFloorsMet = nodes.every((n) => n.energy >= n.floor);
  const noOverloads = nodes.every((n) => n.energy <= n.capacity);
  const total = nodes.reduce((sum, n) => sum + n.energy, 0);
  return allFloorsMet && noOverloads && total > 60 && total < 95;
}
