/**
 * Phase 1 — Broken Genesis / Llull Circuit Board.
 * Behavioral telemetry engine disguised as a puzzle (HCD-3 / HCD-4).
 * Completing a stable circuit writes the Cognitive Twin seed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Cpu, Eye, Sparkles, Zap } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { LayerHeader } from "@/components/LayerHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useShaliahOnboarding } from "@/hooks/useShaliahOnboarding";
import {
  buildTwinSeed,
  isCircuitStable,
  profileWeightsFromNodes,
} from "@/lib/phase1-twin";
import { cn } from "@/lib/utils";
import type {
  BehavioralTelemetry,
  CircuitNode,
  DomainType,
} from "@/types/broken-genesis";

const INITIAL_NODES: CircuitNode[] = [
  { id: "THEO", label: "Theology (Vision)", energy: 0, capacity: 80, floor: 20 },
  {
    id: "TECHNO",
    label: "Technology (Execution)",
    energy: 0,
    capacity: 90,
    floor: 30,
  },
  {
    id: "COSMO",
    label: "Cosmology (Structure)",
    energy: 0,
    capacity: 70,
    floor: 25,
  },
];

const ROUTE_AMOUNTS = [8, 12, 18] as const;
const DECAY_PER_TICK = 0.45;
const TICK_MS = 1000;

const DOMAIN_STYLE: Record<
  DomainType,
  { ring: string; bar: string; glow: string; icon: string }
> = {
  THEO: {
    ring: "border-violet-500/50",
    bar: "bg-violet-500",
    glow: "shadow-violet-500/30",
    icon: "Θ",
  },
  TECHNO: {
    ring: "border-cyan-500/50",
    bar: "bg-cyan-500",
    glow: "shadow-cyan-500/30",
    icon: "Ξ",
  },
  COSMO: {
    ring: "border-amber-500/50",
    bar: "bg-amber-500",
    glow: "shadow-amber-500/30",
    icon: "Ω",
  },
};

export function BrokenGenesisPuzzle() {
  const principalId = useShaliahOnboarding((s) => s.principalId);
  const captureTelemetry = useShaliahOnboarding((s) => s.captureTelemetry);
  const completePhase = useShaliahOnboarding((s) => s.completePhase);
  const phase1Complete = useShaliahOnboarding((s) => s.phase1Complete);
  const twin = useShaliahOnboarding((s) => s.twin);
  const plSnapshot = useShaliahOnboarding((s) => s.plSnapshot);
  const resetPhase1 = useShaliahOnboarding((s) => s.resetPhase1);
  const exportTelemetryJson = useShaliahOnboarding((s) => s.exportTelemetryJson);

  const [nodes, setNodes] = useState<CircuitNode[]>(() =>
    INITIAL_NODES.map((n) => ({ ...n })),
  );
  const [sourceEnergy, setSourceEnergy] = useState(100);
  const [selected, setSelected] = useState<DomainType | null>(null);
  const [inspected, setInspected] = useState<DomainType | null>(null);
  const [routeAmount, setRouteAmount] = useState<(typeof ROUTE_AMOUNTS)[number]>(
    12,
  );
  const [isStable, setIsStable] = useState(false);
  const [completedLocal, setCompletedLocal] = useState(false);
  const [statusLine, setStatusLine] = useState(
    "Genesis fault: Cognitive Twin mute. Route SOURCE → domain nodes. Stop the leak.",
  );
  const [liveLog, setLiveLog] = useState<string[]>([]);

  const lastActionTime = useRef(Date.now());
  const localTelemetry = useRef<BehavioralTelemetry[]>([]);
  const starveLatched = useRef<Set<DomainType>>(new Set());
  const overloadLatched = useRef<Set<DomainType>>(new Set());

  const pushLocal = useCallback(
    (event: BehavioralTelemetry) => {
      localTelemetry.current = [...localTelemetry.current, event].slice(-2000);
      captureTelemetry(event);
      const line = `${event.timestamp}|${event.action} ${event.nodeId} Δt=${event.decisionLatency}ms`;
      setLiveLog((prev) => [line, ...prev].slice(0, 12));
    },
    [captureTelemetry],
  );

  // Energy decay + starvation edge detection (once per below-floor episode)
  useEffect(() => {
    if (completedLocal || phase1Complete) return;
    const tick = setInterval(() => {
      setNodes((prev) =>
        prev.map((node) => {
          const newEnergy = Math.max(0, node.energy - DECAY_PER_TICK);
          if (newEnergy < node.floor) {
            if (!starveLatched.current.has(node.id)) {
              starveLatched.current.add(node.id);
              pushLocal({
                nodeId: node.id,
                action: "STARVE",
                timestamp: Date.now(),
                decisionLatency: Date.now() - lastActionTime.current,
                meta: { rule: "T-SOVEREIGNTY-DEBT", energy: newEnergy },
              });
              setStatusLine(
                `Starve — ${node.label}: energy below floor (T-SOVEREIGNTY-DEBT). Agent is starving.`,
              );
            }
          } else {
            starveLatched.current.delete(node.id);
          }
          return { ...node, energy: newEnergy };
        }),
      );
      setSourceEnergy((s) => Math.min(100, s + 0.35)); // slow SOURCE regen
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [completedLocal, phase1Complete, pushLocal]);

  // Stability band — user must still press COMPILE (UMS resolution act)
  useEffect(() => {
    if (completedLocal || phase1Complete) return;
    const stable = isCircuitStable(nodes);
    setIsStable(stable);
    if (stable) {
      setStatusLine(
        "STRUCTURAL INTEGRITY ACHIEVED — compile the constraint envelope to wake the twin.",
      );
    }
  }, [nodes, completedLocal, phase1Complete]);

  /**
   * UMS handleComplete — energy distribution → psychometric weights →
   * twin seed + local gate-acl-shaped PL task (broken-genesis-repair).
   */
  const handleComplete = useCallback(() => {
    if (completedLocal || phase1Complete) return;
    if (!isCircuitStable(nodes)) {
      toast.error("Circuit not stable", {
        description: "Floors met · no overload · Σ energy in (60, 95).",
      });
      return;
    }
    const profileWeights = profileWeightsFromNodes(nodes);
    const seed = buildTwinSeed(
      principalId,
      nodes,
      localTelemetry.current,
      Date.now(),
    );
    pushLocal({
      nodeId: "SOURCE",
      action: "STABILIZE",
      timestamp: Date.now(),
      decisionLatency: 0,
      meta: { twin: seed, profileWeights },
    });
    const result = completePhase(1, {
      ...profileWeights,
      twin: seed,
      telemetry: [...localTelemetry.current],
      nodes: nodes.map((n) => ({ ...n })),
      isStable: true,
      totalEnergy:
        profileWeights.theoWeight +
        profileWeights.technoWeight +
        profileWeights.cosmoWeight,
    } as unknown as Record<string, unknown>);
    if (!result.ok) {
      toast.error("Compile refused", { description: result.reason });
      return;
    }
    setCompletedLocal(true);
    setStatusLine(
      `Constraint envelope ${seed.constraintEnvelopeVersion} compiled. Cognitive Twin online. PL task broken-genesis-repair recorded.`,
    );
    toast.success("Genesis repaired — Shaliah wakes", {
      description:
        "You authored the first envelope by stabilizing density — not by taking a quiz.",
    });
  }, [
    completedLocal,
    phase1Complete,
    nodes,
    principalId,
    completePhase,
    pushLocal,
  ]);

  const handleInspect = useCallback(
    (domain: DomainType) => {
      if (completedLocal || phase1Complete) return;
      const latency = Date.now() - lastActionTime.current;
      lastActionTime.current = Date.now();
      setInspected(domain);
      pushLocal({
        nodeId: domain,
        action: "INSPECT",
        timestamp: Date.now(),
        decisionLatency: latency,
        meta: { label: INITIAL_NODES.find((n) => n.id === domain)?.label },
      });
      setStatusLine(
        `Inspect ${domain}: capacity / floor constraints visible. Routing without inspection is HCD-4 weak.`,
      );
    },
    [completedLocal, phase1Complete, pushLocal],
  );

  const handleSelect = useCallback(
    (domain: DomainType) => {
      if (completedLocal || phase1Complete) return;
      const latency = Date.now() - lastActionTime.current;
      lastActionTime.current = Date.now();
      const next = selected === domain ? null : domain;
      setSelected(next);
      pushLocal({
        nodeId: domain,
        action: next ? "SELECT" : "DESELECT",
        timestamp: Date.now(),
        decisionLatency: latency,
      });
    },
    [completedLocal, phase1Complete, selected, pushLocal],
  );

  const handleRouteEnergy = useCallback(
    (targetDomain: DomainType, amount: number) => {
      if (completedLocal || phase1Complete) return;
      if (sourceEnergy < amount) {
        setStatusLine("SOURCE depleted — wait for regen or reduce throughput.");
        return;
      }

      const latency = Date.now() - lastActionTime.current;
      lastActionTime.current = Date.now();

      setSourceEnergy((s) => Math.max(0, s - amount));
      setNodes((prev) =>
        prev.map((node) => {
          if (node.id !== targetDomain) return node;
          let newEnergy = node.energy + amount;
          if (newEnergy > node.capacity) {
            if (!overloadLatched.current.has(node.id)) {
              overloadLatched.current.add(node.id);
              pushLocal({
                nodeId: node.id,
                action: "OVERLOAD",
                timestamp: Date.now(),
                decisionLatency: latency,
                meta: {
                  rule: "C-ANTI-DILUTION",
                  attempted: newEnergy,
                  capacity: node.capacity,
                },
              });
              setStatusLine(
                `Overload — ${node.label}: C-ANTI-DILUTION. Volume without density fractures the twin.`,
              );
            }
            // Spill / clamp with penalty
            newEnergy = node.capacity * 0.55;
          } else {
            overloadLatched.current.delete(node.id);
          }
          return { ...node, energy: newEnergy };
        }),
      );

      pushLocal({
        nodeId: targetDomain,
        action: "ROUTE",
        timestamp: Date.now(),
        decisionLatency: latency,
        meta: {
          amount,
          inspectedFirst: inspected === targetDomain,
          ruleHints: ["constraint_link"],
        },
      });
      setStatusLine(
        `Routed ${amount} → ${targetDomain}${inspected === targetDomain ? " (inspected)" : " (blind)"}.`,
      );
    },
    [
      completedLocal,
      phase1Complete,
      sourceEnergy,
      inspected,
      pushLocal,
    ],
  );

  const totalAllocated = useMemo(
    () => nodes.reduce((s, n) => s + n.energy, 0),
    [nodes],
  );

  const done = completedLocal || phase1Complete;

  const onReset = () => {
    resetPhase1();
    setNodes(INITIAL_NODES.map((n) => ({ ...n })));
    setSourceEnergy(100);
    setSelected(null);
    setInspected(null);
    setIsStable(false);
    setCompletedLocal(false);
    localTelemetry.current = [];
    starveLatched.current.clear();
    overloadLatched.current.clear();
    lastActionTime.current = Date.now();
    setLiveLog([]);
    setStatusLine(
      "Genesis fault: Cognitive Twin mute. Route SOURCE → domain nodes. Stop the leak.",
    );
  };

  const onExport = () => {
    const blob = new Blob([exportTelemetryJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shaliah-phase1-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-ocid="onboarding.phase1.broken-genesis">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <LayerHeader
          layer={0}
          title="Genesis Act: Circuit Repair"
          description="Agent cognitive core offline. Route energy to stabilize density. Friction is the teacher — not a quiz."
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="font-mono text-xs h-9"
            onClick={onExport}
            type="button"
          >
            Export telemetry
          </Button>
          <Button
            variant="outline"
            className="font-mono text-xs h-9"
            onClick={onReset}
            type="button"
          >
            Reset circuit
          </Button>
        </div>
      </div>

      {/* Status strip */}
      <div
        className={cn(
          "rounded-md border px-4 py-3 font-mono text-xs tracking-wide",
          done
            ? "border-primary/50 bg-primary/10 text-primary"
            : isStable
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-border bg-black/40 text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span>{statusLine}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* SOURCE */}
        <Card className="bg-[#0A0A0A] border-border lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              SOURCE (Breath residual)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mb-1">
                <span>AVAILABLE</span>
                <span>{sourceEnergy.toFixed(1)}</span>
              </div>
              <Progress value={sourceEnergy} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground mb-1">
                <span>ALLOCATED Σ</span>
                <span>{totalAllocated.toFixed(1)}</span>
              </div>
              <Progress
                value={Math.min(100, totalAllocated)}
                className="h-2"
              />
              <p className="mt-2 font-mono text-[10px] text-muted-foreground/70">
                Stability band: floors met · no overload · Σ ∈ (60, 95)
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ROUTE_AMOUNTS.map((a) => (
                <Button
                  key={a}
                  type="button"
                  size="sm"
                  variant={routeAmount === a ? "default" : "outline"}
                  className="font-mono text-xs"
                  onClick={() => setRouteAmount(a)}
                  disabled={done}
                >
                  thr={a}
                </Button>
              ))}
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              Select a domain, optionally <strong className="text-foreground">Inspect</strong>{" "}
              its envelope, then <strong className="text-foreground">Route</strong>.
              Fast blind dumps overload; neglect starves.
            </p>
          </CardContent>
        </Card>

        {/* Nodes */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {nodes.map((node) => {
            const style = DOMAIN_STYLE[node.id];
            const starving = node.energy < node.floor;
            const overloading = node.energy > node.capacity * 0.98;
            const pct = Math.min(100, (node.energy / node.capacity) * 100);
            return (
              <Card
                key={node.id}
                className={cn(
                  "bg-[#0A0A0A] border transition-shadow",
                  style.ring,
                  selected === node.id && `shadow-lg ${style.glow}`,
                  starving && "border-red-500/60",
                  overloading && "border-orange-500/70",
                )}
              >
                <CardHeader className="pb-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-lg text-primary">
                      {style.icon}
                    </span>
                    {starving && (
                      <Badge variant="destructive" className="font-mono text-[9px]">
                        STARVE
                      </Badge>
                    )}
                    {overloading && (
                      <Badge className="font-mono text-[9px] bg-orange-600">
                        OVERLOAD
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="font-mono text-xs leading-snug">
                    {node.label}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="flex justify-between font-mono text-[10px] text-muted-foreground mb-1">
                      <span>
                        {node.energy.toFixed(1)} / {node.capacity}
                      </span>
                      <span>floor {node.floor}</span>
                    </div>
                    <div className="h-2 w-full rounded bg-muted/30 overflow-hidden">
                      <div
                        className={cn("h-full transition-all", style.bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {/* floor marker */}
                    <div className="relative h-0">
                      <div
                        className="absolute -top-2 w-px h-3 bg-red-400/70"
                        style={{ left: `${(node.floor / node.capacity) * 100}%` }}
                        title="floor"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="font-mono text-[10px] gap-1"
                      disabled={done}
                      onClick={() => handleInspect(node.id)}
                    >
                      <Eye className="w-3 h-3" />
                      Inspect
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={selected === node.id ? "default" : "secondary"}
                      className="font-mono text-[10px]"
                      disabled={done}
                      onClick={() => handleSelect(node.id)}
                    >
                      {selected === node.id ? "Selected" : "Select"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="font-mono text-[10px] gap-1"
                      disabled={done || sourceEnergy < routeAmount}
                      onClick={() => handleRouteEnergy(node.id, routeAmount)}
                    >
                      <Cpu className="w-3 h-3" />
                      Route {routeAmount}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Stability + twin */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-[#0A0A0A] border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Constraint telemetry (live)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="font-mono text-[10px] space-y-1 text-muted-foreground max-h-40 overflow-y-auto">
              {liveLog.length === 0 && (
                <li className="opacity-50">No actions yet — begin routing.</li>
              )}
              {liveLog.map((line) => (
                <li key={line} className="border-l border-primary/30 pl-2">
                  {line.includes("|") ? line.slice(line.indexOf("|") + 1) : line}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-[10px]",
                  isStable
                    ? "border-emerald-500 text-emerald-400"
                    : "border-gray-700 text-muted-foreground",
                )}
              >
                {isStable
                  ? "STRUCTURAL INTEGRITY ACHIEVED"
                  : "CRITICAL FAILURE IMMINENT"}
              </Badge>
              {done && (
                <Badge className="font-mono text-[10px] bg-primary text-primary-foreground">
                  PHASE 1 COMPLETE
                </Badge>
              )}
              {plSnapshot && (
                <Badge variant="outline" className="font-mono text-[10px]">
                  PL score {plSnapshot.score} · agent_ops
                </Badge>
              )}
            </div>
            {isStable && !done && (
              <Button
                type="button"
                className="mt-4 w-full font-mono text-xs tracking-widest bg-emerald-600 hover:bg-emerald-500"
                onClick={handleComplete}
              >
                COMPILE CONSTRAINT ENVELOPE
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="bg-[#0A0A0A] border-border">
          <CardHeader className="pb-2">
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Cognitive Twin seed
            </CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-[11px] space-y-2">
            {!twin && (
              <p className="text-muted-foreground">
                Written when the circuit holds the density band. Method imprint
                (HCD-3 diversity, HCD-4 inspect-before-route) — not a quiz score.
              </p>
            )}
            {twin && (
              <div className="space-y-1 text-muted-foreground">
                <div className="text-foreground">principal: {twin.principalId}</div>
                <div>
                  T/X/C shares:{" "}
                  {(twin.theoShare * 100).toFixed(0)}% /{" "}
                  {(twin.technoShare * 100).toFixed(0)}% /{" "}
                  {(twin.cosmoShare * 100).toFixed(0)}%
                </div>
                <div>
                  methodDiversity (HCD-3): {twin.methodDiversity.toFixed(3)}
                </div>
                <div>
                  reasoningExposure (HCD-4): {twin.reasoningExposure.toFixed(3)}
                </div>
                <div>
                  overloads / starves: {twin.overloadCount} / {twin.starveCount}
                </div>
                <div>
                  mean decision latency: {twin.meanDecisionLatencyMs.toFixed(0)}
                  ms
                </div>
                <div>
                  envelope: {twin.constraintEnvelopeVersion}
                </div>
                <div>
                  weights T/X/C:{" "}
                  {twin.profileWeights.theoWeight.toFixed(0)} /{" "}
                  {twin.profileWeights.technoWeight.toFixed(0)} /{" "}
                  {twin.profileWeights.cosmoWeight.toFixed(0)}
                </div>
                <Button
                  asChild
                  type="button"
                  className="mt-3 w-full font-mono text-xs"
                  variant="default"
                >
                  <Link to="/onboarding/shadow-market">
                    Continue → Communication Quarantine
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Page shell for router */
export default function BrokenGenesisPage() {
  return (
    <Layout>
      <BrokenGenesisPuzzle />
    </Layout>
  );
}
