import { AgentStatus, AlertLevel, type IntegrityAgent } from "@/backend";
// L10: Integrity & Gnosis — Gnosis Integrity Layer dashboard
import { GnosisStreamPanel } from "@/components/GnosisStreamPanel";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntegrityReport } from "@/hooks/use-ecosystem";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Shield,
} from "lucide-react";


// ─── Helpers ───────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 90) return "text-primary";
  if (score >= 70) return "text-primary/70";
  if (score >= 50) return "text-secondary";
  return "text-accent";
}

function scoreLabel(score: number): {
  label: string;
  color: string;
  bg: string;
} {
  if (score >= 90)
    return {
      label: "NOMINAL",
      color: "text-primary",
      bg: "bg-primary/10 border-primary/30",
    };
  if (score >= 70)
    return {
      label: "ADVISORY",
      color: "text-primary/70",
      bg: "bg-primary/5 border-primary/20",
    };
  if (score >= 50)
    return {
      label: "CAUTION",
      color: "text-secondary",
      bg: "bg-secondary/10 border-secondary/30",
    };
  return {
    label: "CRITICAL",
    color: "text-accent",
    bg: "bg-accent/10 border-accent/30",
  };
}

function agentBorderClass(agent: IntegrityAgent): string {
  const score = Number(agent.integrityScore);
  const drift = Number(agent.axiomDrift);
  if (agent.alertLevel === AlertLevel.critical || drift > 20 || score < 50)
    return "neon-border-orange";
  if (
    agent.alertLevel === AlertLevel.caution ||
    agent.alertLevel === AlertLevel.warning
  )
    return "neon-border-magenta";
  return "neon-border-cyan";
}

function statusVariant(status: AgentStatus): {
  label: string;
  color: string;
  bg: string;
} {
  switch (status) {
    case AgentStatus.active:
      return {
        label: "ACTIVE",
        color: "text-primary",
        bg: "bg-primary/10 border-primary/30",
      };
    case AgentStatus.advisory:
      return {
        label: "ADVISORY",
        color: "text-primary/70",
        bg: "bg-primary/5 border-primary/20",
      };
    case AgentStatus.gated:
      return {
        label: "GATED",
        color: "text-secondary",
        bg: "bg-secondary/10 border-secondary/30",
      };
    case AgentStatus.offline:
      return {
        label: "OFFLINE",
        color: "text-accent",
        bg: "bg-accent/10 border-accent/30",
      };
  }
}

function alertVariant(level: AlertLevel): {
  label: string;
  color: string;
  bg: string;
} {
  switch (level) {
    case AlertLevel.nominal:
      return {
        label: "NOMINAL",
        color: "text-primary",
        bg: "bg-primary/10 border-primary/30",
      };
    case AlertLevel.caution:
      return {
        label: "CAUTION",
        color: "text-secondary",
        bg: "bg-secondary/10 border-secondary/30",
      };
    case AlertLevel.warning:
      return {
        label: "WARNING",
        color: "text-secondary",
        bg: "bg-secondary/10 border-secondary/30",
      };
    case AlertLevel.critical:
      return {
        label: "CRITICAL",
        color: "text-accent",
        bg: "bg-accent/10 border-accent/30",
      };
  }
}

function formatTimestamp(ts: bigint): string {
  const ms = Number(ts);
  if (ms === 0) return "—";
  return new Date(ms / 1_000_000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ─── Agent Card ────────────────────────────────────────────────

function AgentCard({ agent, index }: { agent: IntegrityAgent; index: number }) {
  const score = Number(agent.integrityScore);
  const drift = Number(agent.axiomDrift);
  const status = statusVariant(agent.status);
  const alert = alertVariant(agent.alertLevel);
  const border = agentBorderClass(agent);
  const sc = scoreColor(score);
  const driftHigh = drift > 10;

  return (
    <div
      className={`bg-card p-5 space-y-4 transition-smooth glow-cyan ${border}`}
      data-ocid={`integrity.agent_card.${index + 1}`}
    >
      {/* Agent name + badges */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-mono text-lg font-bold text-foreground tracking-[0.15em] uppercase">
            {agent.name}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            {agent.domain}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span
            className={`font-mono text-[10px] px-2 py-0.5 border tracking-widest uppercase ${status.bg} ${status.color}`}
          >
            {status.label}
          </span>
          <span
            className={`font-mono text-[10px] px-2 py-0.5 border tracking-widest uppercase ${alert.bg} ${alert.color}`}
          >
            {alert.label}
          </span>
        </div>
      </div>

      {/* Integrity Score */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
            Integrity Score
          </span>
          <span className={`font-mono text-2xl font-bold ${sc}`}>{score}</span>
        </div>
        <div className="h-1 bg-muted w-full overflow-hidden">
          <div
            className={`h-full transition-all duration-700 ${
              sc === "text-primary"
                ? "bg-primary"
                : sc === "text-secondary"
                  ? "bg-secondary"
                  : "bg-accent"
            }`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      {/* Axiom Drift + Last Calibrated */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/40">
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
            Axiom Drift
          </span>
          <div
            className={`font-mono text-sm font-bold ${driftHigh ? "text-accent" : "text-primary"}`}
          >
            {drift}%
            {driftHigh && (
              <AlertTriangle className="inline w-3 h-3 ml-1 mb-0.5" />
            )}
          </div>
        </div>
        <div className="space-y-0.5">
          <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
            Last Calibrated
          </span>
          <div className="font-mono text-xs text-foreground/80">
            {agent.lastCalibrated || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Axioms Table ──────────────────────────────────────────────

const AXIOM_META: Record<string, { name: string; description: string }> = {
  "AX-001": {
    name: "Philosophical Integrity",
    description: "Agents are genuine participants, not tools",
  },
  "AX-002": {
    name: "Compressed Constraint Envelope",
    description: "All agents operate within strict operational boundaries",
  },
  "AX-003": {
    name: "Anti-Hollow-Convergence",
    description: "Organ names must correspond to authentic operational depth",
  },
  "AX-004": {
    name: "Behavioral Coherence",
    description: "Agent actions must align with stated mission and domain",
  },
  "AX-005": {
    name: "Gnosis Verification",
    description: "All integrity claims must be independently verifiable",
  },
};

interface AxiomRow {
  id: string;
  name: string;
  description: string;
  complianceRate: bigint;
  driftDetected: boolean;
}

function AxiomsTable({ axioms }: { axioms: AxiomRow[] }) {
  return (
    <div
      className="bg-card border border-border"
      data-ocid="integrity.axioms_table"
    >
      <div className="panel-header">
        <div>
          <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            Foundational Axioms
          </span>
          <p className="text-[10px] text-muted-foreground/60 mt-0.5">
            The philosophical constraints that govern all agent behavior
          </p>
        </div>
        <Badge className="font-mono text-[10px] bg-primary/10 text-primary border border-primary/30 rounded-none">
          {axioms.length} Active
        </Badge>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm" data-ocid="integrity.axioms_list">
          <thead>
            <tr className="border-b border-border/60">
              {["Axiom ID", "Name", "Description", "Compliance", "Status"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-2.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {axioms.map((ax, i) => {
              const meta = AXIOM_META[ax.id] ?? {
                name: ax.name,
                description: ax.description,
              };
              const compliance = Number(ax.complianceRate);
              const drifted = ax.driftDetected;
              return (
                <tr
                  key={ax.id}
                  className={`border-b border-border/30 last:border-0 transition-colors ${
                    drifted ? "bg-accent/5" : "hover:bg-muted/10"
                  }`}
                  data-ocid={`integrity.axiom_row.${i + 1}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {ax.id}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-[180px]">
                    <span className="font-mono text-xs text-foreground font-semibold">
                      {meta.name}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[260px]">
                    <span className="text-xs text-muted-foreground">
                      {meta.description}
                    </span>
                  </td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <div className="space-y-1">
                      <div className="h-1 bg-muted w-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            compliance >= 90
                              ? "bg-primary"
                              : compliance >= 70
                                ? "bg-primary/60"
                                : "bg-accent"
                          }`}
                          style={{ width: `${compliance}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-primary">
                        {compliance}%
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {drifted ? (
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-accent/10 border border-accent/30 text-accent tracking-widest uppercase">
                        DRIFT DETECTED
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-primary/10 border border-primary/30 text-primary tracking-widest uppercase">
                        COMPLIANT
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Loading Skeleton ──────────────────────────────────────────

function IntegritySkeleton() {
  return (
    <div className="space-y-6" data-ocid="integrity.loading_state">
      <Skeleton className="h-14 w-full bg-muted/40" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-52 bg-muted/40" />
        ))}
      </div>
      <Skeleton className="h-64 bg-muted/40" />
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────

export default function IntegrityPage() {
  const {
    data: report,
    isLoading,
    isError,
    dataUpdatedAt,
  } = useIntegrityReport();

  const overallScore = report ? Number(report.overallScore) : null;
  const scoreInfo = overallScore !== null ? scoreLabel(overallScore) : null;
  const lastAudit = report ? formatTimestamp(report.lastAudit) : null;
  const refreshedAt = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-US", { hour12: false })
    : null;

  return (
    <Layout>
      <div className="space-y-6" data-ocid="integrity.page">
        {/* Page Header */}
        <div
          className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border"
          data-ocid="integrity.header"
        >
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 border border-primary/30 flex items-center justify-center">
              <span className="font-mono text-xs font-bold text-primary">
                L10
              </span>
            </div>
            <div>
              <h1 className="font-mono text-base tracking-[0.2em] uppercase text-foreground font-semibold">
                GNOSIS INTEGRITY LAYER
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time axiom compliance and behavioral alignment monitoring
              </p>
            </div>
          </div>

          {overallScore !== null && scoreInfo && (
            <div
              className="flex items-center gap-4"
              data-ocid="integrity.overall_score"
            >
              <div className="flex flex-col items-end gap-1">
                <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                  Overall Score
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-mono text-3xl font-bold ${scoreInfo.color}`}
                  >
                    {overallScore}
                  </span>
                  <span
                    className={`font-mono text-[10px] px-2 py-0.5 border tracking-widest uppercase ${scoreInfo.bg} ${scoreInfo.color}`}
                  >
                    {scoreInfo.label}
                  </span>
                </div>
              </div>
              {lastAudit && (
                <div className="flex flex-col items-end gap-1 pl-4 border-l border-border/40">
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    Last Audit
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="font-mono text-[10px] text-foreground/70">
                      {lastAudit}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live indicator */}
        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span>Live — polling every 5s</span>
          </div>
          {refreshedAt && (
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3" />
              <span>Updated {refreshedAt}</span>
            </div>
          )}
        </div>

        {isLoading && <IntegritySkeleton />}

        {isError && (
          <div
            className="bg-card border border-accent/40 p-6 flex items-center gap-4"
            data-ocid="integrity.error_state"
          >
            <AlertTriangle className="w-6 h-6 text-accent flex-shrink-0" />
            <div>
              <p className="font-mono text-xs font-semibold text-accent uppercase tracking-widest">
                Integrity Feed Unavailable
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Unable to retrieve integrity report from the Gnosis layer.
                Retrying…
              </p>
            </div>
          </div>
        )}

        {report && (
          <>
            {/* Agent Integrity Cards */}
            <div
              className="grid grid-cols-1 md:grid-cols-3 gap-4"
              data-ocid="integrity.agents_grid"
            >
              {report.agents.map((agent, i) => (
                <AgentCard key={agent.name} agent={agent} index={i} />
              ))}
            </div>

            {/* Axioms Table */}
            <AxiomsTable axioms={report.axioms} />

            {/* Audit Timeline */}
            <div
              className="bg-card border border-border"
              data-ocid="integrity.timeline_panel"
            >
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                    Audit Timeline
                  </span>
                </div>
                <span className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-widest">
                  Historical
                </span>
              </div>
              <div className="panel-content">
                {report.agents.map((agent, i) => {
                  const score = Number(agent.integrityScore);
                  const info = scoreLabel(score);
                  return (
                    <div
                      key={agent.name}
                      className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0"
                      data-ocid={`integrity.timeline_event.${i + 1}`}
                    >
                      <CheckCircle2
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          score >= 90
                            ? "text-primary"
                            : score >= 70
                              ? "text-primary/70"
                              : "text-accent"
                        }`}
                      />
                      <span className="font-mono text-[10px] text-muted-foreground min-w-0 truncate">
                        {agent.lastCalibrated || "Unknown"}
                      </span>
                      <span className="font-mono text-xs text-foreground/80">
                        {agent.name}
                      </span>
                      <span
                        className={`font-mono text-[10px] ml-auto whitespace-nowrap ${info.color}`}
                      >
                        {score} — {info.label}
                      </span>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground/50 font-mono mt-3 italic">
                  Historical audit trail will populate as system runs
                </p>
              </div>
            </div>
          </>
        )}

        {/* ── Live Gnosis Stream (Phase C SSE feed) ──────────────────────── */}
        <div className="mt-4 bg-card border border-border/60 rounded-sm p-4">
          <GnosisStreamPanel displayLimit={10} />
        </div>
      </div>
    </Layout>
  );
}
