// L1: Foundation & Axioms — Primary command surface for the Sovereign Monad OS
// Six core panel cards + live system telemetry (MetricsPanel, ControlPanel, ConfigPanel, ActivityLog)

import {
  AgentStatus,
  AlertLevel,
  BuildStatus,
  DeployStepStatus,
} from "@/backend";
import type {
  BuildPipeline,
  DeployStep,
  IntegrityReport,
  KafkaTopology,
  SkillsMatrix,
} from "@/backend";
import { ActivityLog } from "@/components/ActivityLog";
import { ConfigPanel } from "@/components/ConfigPanel";
import { ControlPanel } from "@/components/ControlPanel";
import { Layout } from "@/components/Layout";
import { MetricsPanel } from "@/components/MetricsPanel";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useControls } from "@/hooks/use-dashboard";
import {
  useBuildPipeline,
  useCostModel,
  useDeploymentSteps,
  useIntegrityReport,
  useKafkaTopology,
  useSkillsMatrix,
} from "@/hooks/use-ecosystem";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  ArrowRight,
  Box,
  CircuitBoard,
  DollarSign,
  GitBranch,
  Radio,
  Shield,
  TrendingUp,
  Zap,
} from "lucide-react";

// ─── Agent Status Badge ──────────────────────────────────────────

function statusColor(status: AgentStatus) {
  switch (status) {
    case AgentStatus.active:
      return "text-primary border-primary/40 bg-primary/10";
    case AgentStatus.gated:
      return "text-accent border-accent/40 bg-accent/10";
    case AgentStatus.advisory:
      return "text-secondary border-secondary/40 bg-secondary/10";
    case AgentStatus.offline:
      return "text-muted-foreground border-border bg-muted/30";
    default:
      return "text-muted-foreground border-border";
  }
}

function alertDot(level: AlertLevel) {
  switch (level) {
    case AlertLevel.nominal:
      return "bg-primary";
    case AlertLevel.caution:
      return "bg-accent";
    case AlertLevel.warning:
      return "bg-accent animate-pulse";
    case AlertLevel.critical:
      return "bg-destructive animate-ping";
    default:
      return "bg-muted-foreground";
  }
}

// ─── Hero Section ────────────────────────────────────────────────

function HeroSection() {
  const { data: integrity, isLoading: intLoading } = useIntegrityReport();
  const { data: controls, isLoading: ctrlLoading } = useControls();

  const overallScore = integrity ? Number(integrity.overallScore) : null;
  const scoreColor =
    overallScore === null
      ? "text-muted-foreground"
      : overallScore >= 80
        ? "text-primary"
        : overallScore >= 60
          ? "text-secondary"
          : "text-accent";

  return (
    <div
      className="relative bg-card border border-border rounded-sm overflow-hidden mb-6"
      data-ocid="overview.hero.section"
    >
      {/* Scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, oklch(0.95 0 0) 2px, oklch(0.95 0 0) 3px)",
        }}
      />
      {/* Corner accents */}
      <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-primary opacity-60" />
      <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-primary opacity-60" />
      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-primary opacity-60" />
      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-primary opacity-60" />

      <div className="px-8 py-6 relative">
        {/* Title row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-2 bg-primary animate-pulse" />
              <span className="font-mono text-[10px] tracking-[0.4em] text-primary uppercase">
                SYSTEM ONLINE {/* 15-LAYER ECOSYSTEM */}
              </span>
            </div>
            <h1 className="font-mono text-3xl lg:text-4xl font-bold tracking-[0.15em] text-foreground uppercase leading-tight">
              SOVEREIGN MONAD
            </h1>
            <p className="font-mono text-xs text-muted-foreground tracking-[0.25em] mt-1 uppercase">
              CONTROL CENTER v2.4.0 — Self-Governing Ecosystem OS
            </p>
          </div>

          {/* Status cluster */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Overall Integrity Score */}
            <div
              className="flex flex-col items-center bg-background border border-border rounded-sm px-4 py-3 min-w-[80px]"
              data-ocid="overview.integrity_score"
            >
              <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase mb-1">
                INTEGRITY
              </span>
              {intLoading ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                <span
                  className={cn("font-mono text-2xl font-bold", scoreColor)}
                >
                  {overallScore !== null ? `${overallScore}%` : "—"}
                </span>
              )}
            </div>

            {/* Armed badge */}
            <div
              className="flex flex-col items-center bg-background border border-border rounded-sm px-4 py-3 min-w-[80px]"
              data-ocid="overview.armed_badge"
            >
              <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase mb-1">
                ARMED
              </span>
              {ctrlLoading ? (
                <Skeleton className="h-5 w-16" />
              ) : (
                <span
                  className={cn(
                    "font-mono text-xs font-bold tracking-widest uppercase",
                    controls?.armed ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {controls?.armed ? "● ARMED" : "○ SAFE"}
                </span>
              )}
            </div>

            {/* Agent status badges */}
            <div className="flex flex-col gap-1.5">
              {intLoading ? (
                <>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-6 w-32" />
                </>
              ) : integrity ? (
                integrity.agents.map((agent) => (
                  <div
                    key={agent.name}
                    className={cn(
                      "flex items-center gap-2 px-2.5 py-1 rounded-sm border font-mono text-[10px] tracking-widest uppercase",
                      statusColor(agent.status),
                    )}
                    data-ocid={`overview.agent_badge.${agent.name.toLowerCase()}`}
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full flex-shrink-0",
                        alertDot(agent.alertLevel),
                      )}
                    />
                    <span>{agent.name}</span>
                    <span className="opacity-60">|</span>
                    <span>{agent.status}</span>
                  </div>
                ))
              ) : (
                ["SYNAPSE", "VOX", "PNEUMA"].map((n) => (
                  <div
                    key={n}
                    className="flex items-center gap-2 px-2.5 py-1 rounded-sm border border-border font-mono text-[10px] text-muted-foreground"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground opacity-30" />
                    {n} | —
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Axiom drift warning if any */}
        {integrity?.axioms.some((ax) => ax.driftDetected) && (
          <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-accent/10 border border-accent/30 rounded-sm">
            <Zap className="w-3 h-3 text-accent flex-shrink-0" />
            <span className="font-mono text-[10px] text-accent tracking-widest uppercase">
              AXIOM DRIFT DETECTED —{" "}
              {integrity.axioms.filter((ax) => ax.driftDetected).length}{" "}
              axiom(s) require attention
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Core Panel Card ─────────────────────────────────────────────

interface CorePanelProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  route: string;
  borderVariant: "cyan" | "magenta" | "orange";
  isLoading?: boolean;
  children: React.ReactNode;
  ocid: string;
}

function CorePanel({
  icon,
  title,
  subtitle,
  route,
  borderVariant,
  isLoading,
  children,
  ocid,
}: CorePanelProps) {
  const navigate = useNavigate();
  const borderClass = {
    cyan: "border-primary/40 hover:border-primary",
    magenta: "border-secondary/40 hover:border-secondary",
    orange: "border-accent/40 hover:border-accent",
  }[borderVariant];
  const labelClass = {
    cyan: "text-primary",
    magenta: "text-secondary",
    orange: "text-accent",
  }[borderVariant];
  const dotClass = {
    cyan: "bg-primary",
    magenta: "bg-secondary",
    orange: "bg-accent",
  }[borderVariant];

  return (
    <button
      type="button"
      className={cn(
        "bg-card border rounded-sm flex flex-col transition-all duration-200 cursor-pointer group relative overflow-hidden w-full text-left",
        borderClass,
      )}
      data-ocid={ocid}
      onClick={() => navigate({ to: route })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") navigate({ to: route });
      }}
      aria-label={`View ${title}`}
    >
      {/* Top accent line */}
      <div
        className={cn(
          "h-[2px] w-full transition-all duration-200",
          borderVariant === "cyan"
            ? "bg-primary/40 group-hover:bg-primary"
            : borderVariant === "magenta"
              ? "bg-secondary/40 group-hover:bg-secondary"
              : "bg-accent/40 group-hover:bg-accent",
        )}
      />

      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Panel header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("flex-shrink-0", labelClass)}>{icon}</div>
            <div>
              <div
                className={cn(
                  "font-mono text-[10px] tracking-[0.2em] uppercase font-bold",
                  labelClass,
                )}
              >
                {title}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground tracking-wider mt-0.5">
                {subtitle}
              </div>
            </div>
          </div>
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0",
              dotClass,
            )}
          />
        </div>

        {/* Panel content */}
        <div className="flex-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ) : (
            children
          )}
        </div>

        {/* View link */}
        <div
          className={cn(
            "flex items-center gap-1 font-mono text-[9px] tracking-widest uppercase mt-auto pt-2 border-t border-border/40 transition-colors duration-200",
            labelClass,
            "opacity-60 group-hover:opacity-100",
          )}
        >
          <span>VIEW FULL PANEL</span>
          <ArrowRight className="w-2.5 h-2.5" />
        </div>
      </div>
    </button>
  );
}

// ─── Mini progress bar ───────────────────────────────────────────

function MiniBar({
  pct,
  variant = "cyan",
  label,
}: {
  pct: number;
  variant?: "cyan" | "magenta" | "orange";
  label?: string;
}) {
  const fillClass = {
    cyan: "bg-primary",
    magenta: "bg-secondary",
    orange: "bg-accent",
  }[variant];
  return (
    <div className="space-y-0.5">
      {label && (
        <div className="flex justify-between">
          <span className="font-mono text-[9px] text-muted-foreground truncate max-w-[70%]">
            {label}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground">
            {pct}%
          </span>
        </div>
      )}
      <div className="h-1 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full", fillClass)}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

// ─── Panel 1: Integrity Auditor ──────────────────────────────────

function IntegrityPanelCard() {
  const { data, isLoading } = useIntegrityReport();
  const score = data ? Number(data.overallScore) : null;
  const borderVariant: "cyan" | "magenta" | "orange" =
    score === null
      ? "cyan"
      : score >= 80
        ? "cyan"
        : score >= 60
          ? "magenta"
          : "orange";

  return (
    <CorePanel
      icon={<Shield className="w-4 h-4" />}
      title="Gnosis Integrity Layer"
      subtitle="Integrity Auditor"
      route="/integrity"
      borderVariant={borderVariant}
      isLoading={isLoading}
      ocid="overview.panel.integrity"
    >
      {data ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-3xl font-bold",
                borderVariant === "cyan"
                  ? "text-primary"
                  : borderVariant === "magenta"
                    ? "text-secondary"
                    : "text-accent",
              )}
            >
              {score}%
            </span>
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="space-y-1.5">
            {data.agents.slice(0, 3).map((agent) => (
              <MiniBar
                key={agent.name}
                pct={Number(agent.integrityScore)}
                variant={
                  Number(agent.integrityScore) >= 80
                    ? "cyan"
                    : Number(agent.integrityScore) >= 60
                      ? "magenta"
                      : "orange"
                }
                label={agent.name}
              />
            ))}
          </div>
        </div>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">No data</span>
      )}
    </CorePanel>
  );
}

// ─── Panel 2: Build Pipeline ─────────────────────────────────────

function BuildPipelineCard() {
  const { data, isLoading } = useBuildPipeline();

  const summary = data?.summary;
  const doneCount = summary ? Number(summary.majorDone) : 0;
  const totalCount = summary ? Number(summary.majorAreas) : 0;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <CorePanel
      icon={<GitBranch className="w-4 h-4" />}
      title="Ecosystem Build Pipeline"
      subtitle="Build Pipeline"
      route="/pipeline"
      borderVariant="cyan"
      isLoading={isLoading}
      ocid="overview.panel.pipeline"
    >
      {data ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-bold text-primary">
              {pct}%
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              COMPLETE
            </span>
          </div>
          <MiniBar pct={pct} variant="cyan" />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">
              {doneCount} / {totalCount} areas done
            </span>
            <PipelineStatusCounts pipeline={data} />
          </div>
        </div>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">No data</span>
      )}
    </CorePanel>
  );
}

function PipelineStatusCounts({ pipeline }: { pipeline: BuildPipeline }) {
  const counts = pipeline.areas.reduce(
    (acc, area) => {
      acc[area.status] = (acc[area.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );
  return (
    <div className="flex items-center gap-2">
      {counts[BuildStatus.done] !== undefined && (
        <span className="font-mono text-[9px] text-primary">
          {counts[BuildStatus.done]}✓
        </span>
      )}
      {counts[BuildStatus.partial] !== undefined && (
        <span className="font-mono text-[9px] text-accent">
          {counts[BuildStatus.partial]}~
        </span>
      )}
      {counts[BuildStatus.blocked] !== undefined && (
        <span className="font-mono text-[9px] text-secondary">
          {counts[BuildStatus.blocked]}✗
        </span>
      )}
    </div>
  );
}

// ─── Panel 3: Kafka Topology ─────────────────────────────────────

function KafkaMiniDiagram({ topology }: { topology: KafkaTopology }) {
  // Build agent → topics map from connections
  const agentTopics: Record<string, string[]> = {};
  for (const conn of topology.connections) {
    if (!agentTopics[conn.fromAgent]) agentTopics[conn.fromAgent] = [];
    agentTopics[conn.fromAgent].push(conn.toTopic);
  }
  const agents = Object.keys(agentTopics).slice(0, 3);
  const allTopics = [
    ...new Set(topology.connections.map((c) => c.toTopic)),
  ].slice(0, 4);

  return (
    <div className="font-mono text-[9px] space-y-1 mt-1">
      <div className="flex gap-2 items-start">
        {/* Agent column */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          {agents.map((a) => (
            <div
              key={a}
              className="px-1.5 py-0.5 bg-secondary/10 border border-secondary/30 text-secondary truncate max-w-[60px] text-[8px]"
            >
              {a.substring(0, 7)}
            </div>
          ))}
        </div>
        {/* Connector */}
        <div className="flex items-center self-center text-muted-foreground/40 text-[8px]">
          ──▶
        </div>
        {/* Topics column */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          {allTopics.map((t) => (
            <div
              key={t}
              className="px-1.5 py-0.5 bg-primary/5 border border-primary/20 text-primary truncate text-[8px]"
            >
              {t.length > 16 ? `${t.substring(0, 14)}…` : t}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function KafkaTopologyCard() {
  const { data, isLoading } = useKafkaTopology();
  const topicCount = data ? data.topics.length : 0;
  const connCount = data ? data.connections.length : 0;
  const throughput = data ? Number(data.totalMessages) : 0;

  return (
    <CorePanel
      icon={<Radio className="w-4 h-4" />}
      title="Signal Event Bus"
      subtitle="Kafka Topology"
      route="/network"
      borderVariant="magenta"
      isLoading={isLoading}
      ocid="overview.panel.kafka"
    >
      {data ? (
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            <div>
              <div className="font-mono text-2xl font-bold text-secondary">
                {topicCount}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">
                Topics
              </div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold text-secondary">
                {connCount}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">
                Connections
              </div>
            </div>
            <div>
              <div className="font-mono text-lg font-bold text-primary">
                {throughput.toLocaleString()}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">
                Messages
              </div>
            </div>
          </div>
          <KafkaMiniDiagram topology={data} />
        </div>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">No data</span>
      )}
    </CorePanel>
  );
}

// ─── Panel 4: Skills Matrix ──────────────────────────────────────

function SkillsMatrixCard() {
  const { data, isLoading } = useSkillsMatrix();
  const sharedCount = data ? data.sharedSkills.length : 0;

  return (
    <CorePanel
      icon={<CircuitBoard className="w-4 h-4" />}
      title="Agent Capabilities Matrix"
      subtitle="Skills Matrix"
      route="/agent-core"
      borderVariant="cyan"
      isLoading={isLoading}
      ocid="overview.panel.skills"
    >
      {data && data.agents.length > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] text-muted-foreground">
              {sharedCount} shared skill{sharedCount !== 1 ? "s" : ""}
            </span>
          </div>
          {data.agents.slice(0, 3).map((agent) => (
            <div key={agent.agentName} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] text-foreground truncate max-w-[60%]">
                  {agent.agentName}
                </span>
                <span className="font-mono text-[9px] text-primary font-bold">
                  {Number(agent.overallRating)}
                </span>
              </div>
              <MiniBar pct={Number(agent.overallRating)} variant="cyan" />
            </div>
          ))}
        </div>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">No data</span>
      )}
    </CorePanel>
  );
}

// ─── Panel 5: Cost Estimator ─────────────────────────────────────

function CostEstimatorCard() {
  const { data, isLoading } = useCostModel();

  // Derive rough estimates from model parameters
  const cyclesPerDay = data ? Number(data.cyclesPerHour) * 24 : null;
  const rpcPerDay = data ? Number(data.rpcCallsPerHour) * 24 : null;
  const gasEstimate = data ? Number(data.gasFeePerTx) : null;
  const storageGB = data ? Number(data.storageGB) : null;

  return (
    <CorePanel
      icon={<DollarSign className="w-4 h-4" />}
      title="Infrastructure Cost Model"
      subtitle="Cost Estimator"
      route="/cost"
      borderVariant="orange"
      isLoading={isLoading}
      ocid="overview.panel.cost"
    >
      {data ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <div>
              <div className="font-mono text-sm font-bold text-accent">
                {cyclesPerDay !== null ? cyclesPerDay.toLocaleString() : "—"}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">
                Cycles/day
              </div>
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-accent">
                {rpcPerDay !== null ? rpcPerDay.toLocaleString() : "—"}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">
                RPC/day
              </div>
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-accent">
                {gasEstimate !== null ? gasEstimate.toLocaleString() : "—"}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">
                Gas/tx
              </div>
            </div>
            <div>
              <div className="font-mono text-sm font-bold text-accent">
                {storageGB !== null ? `${storageGB} GB` : "—"}
              </div>
              <div className="font-mono text-[9px] text-muted-foreground uppercase">
                Storage
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
            <span className="font-mono text-[9px] text-muted-foreground">
              {data.agentCount.toString()} active agent
              {Number(data.agentCount) !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">No data</span>
      )}
    </CorePanel>
  );
}

// ─── Panel 6: Deployment ─────────────────────────────────────────

function DeploymentCard() {
  const { data: steps, isLoading } = useDeploymentSteps();

  const completedSteps = steps
    ? steps.filter((s) => s.status === DeployStepStatus.complete).length
    : 0;
  const totalSteps = steps ? steps.length : 0;
  const hasFailures = steps
    ? steps.some((s) => s.status === DeployStepStatus.failed)
    : false;
  const nextPending: DeployStep | undefined = steps?.find(
    (s) =>
      s.status === DeployStepStatus.pending ||
      s.status === DeployStepStatus.running,
  );
  const pct =
    totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  return (
    <CorePanel
      icon={<Box className="w-4 h-4" />}
      title="Deployment Orchestration"
      subtitle="Deploy Status"
      route="/deployment"
      borderVariant={hasFailures ? "magenta" : "cyan"}
      isLoading={isLoading}
      ocid="overview.panel.deployment"
    >
      {steps ? (
        <div className="space-y-2">
          <div className="flex items-baseline gap-1.5">
            <span
              className={cn(
                "font-mono text-3xl font-bold",
                hasFailures ? "text-secondary" : "text-primary",
              )}
            >
              {completedSteps}/{totalSteps}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              STEPS
            </span>
          </div>
          <MiniBar pct={pct} variant={hasFailures ? "magenta" : "cyan"} />
          {nextPending && (
            <div className="space-y-0.5">
              <div className="font-mono text-[9px] text-muted-foreground uppercase">
                Next:
              </div>
              <div
                className={cn(
                  "font-mono text-[9px] truncate",
                  nextPending.status === DeployStepStatus.running
                    ? "text-accent animate-pulse"
                    : "text-foreground",
                )}
              >
                {nextPending.component}
              </div>
            </div>
          )}
          {hasFailures && (
            <Badge className="font-mono text-[9px] bg-secondary/10 text-secondary border-secondary/40 border px-1.5 py-0.5">
              FAILURES DETECTED
            </Badge>
          )}
        </div>
      ) : (
        <span className="font-mono text-xs text-muted-foreground">No data</span>
      )}
    </CorePanel>
  );
}

// ─── Six Core Panels Grid ─────────────────────────────────────────

function SixCorePanels() {
  return (
    <section className="mb-8" data-ocid="overview.core_panels.section">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
          CORE CONTROL PANELS
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <IntegrityPanelCard />
        <BuildPipelineCard />
        <KafkaTopologyCard />
        <SkillsMatrixCard />
        <CostEstimatorCard />
        <DeploymentCard />
      </div>
    </section>
  );
}

// ─── Live System Telemetry ────────────────────────────────────────

function LiveTelemetry() {
  return (
    <section className="space-y-6" data-ocid="overview.telemetry.section">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2">
          <Activity className="w-3 h-3 text-primary" />
          <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">
            LIVE SYSTEM TELEMETRY
          </span>
          <div className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
          </div>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Metrics Row */}
      <MetricsPanel />

      {/* Controls + Config side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ControlPanel />
        <ConfigPanel />
      </div>

      {/* Activity Log full width */}
      <ActivityLog />
    </section>
  );
}

// ─── Overview Page ────────────────────────────────────────────────

export default function OverviewPage() {
  return (
    <Layout>
      <div className="space-y-2" data-ocid="overview.page">
        <HeroSection />
        <SixCorePanels />
        <LiveTelemetry />
      </div>
    </Layout>
  );
}

