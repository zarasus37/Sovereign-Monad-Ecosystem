// L11: Build Pipeline Tracker — BLOCKED/PARTIAL/DONE status across 15 layers
import { BuildStatus } from "@/backend";
import { LayerHeader } from "@/components/LayerHeader";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { useBuildPipeline } from "@/hooks/use-ecosystem";
import type { BuildArea } from "@/types/ecosystem";
import { AlertTriangle, CheckCircle, Clock, GitBranch } from "lucide-react";
import { useMemo, useState } from "react";

const LAYER_NAMES: Record<number, string> = {
  1: "Foundation & Axioms",
  2: "Agent Core",
  3: "Organ System",
  4: "Signal Routing (Synapse)",
  5: "Narrative Intelligence (Vox)",
  6: "Market Intelligence (Pneuma)",
  7: "Forensic Analysis (Hepar)",
  8: "Capital Allocation (Cardia)",
  9: "Network Coordination (Kardias)",
  10: "Integrity & Gnosis",
  11: "Build Pipeline",
  12: "Deployment Orchestration",
  13: "Cost & Infrastructure",
  14: "Ecosystem Governance",
  15: "System State & Observability",
};

type FilterTab = "ALL" | BuildStatus;

const STATUS_META: Record<
  BuildStatus,
  { label: string; badgeClass: string; dot: string }
> = {
  [BuildStatus.done]: {
    label: "DONE",
    badgeClass: "bg-primary/10 text-primary border-primary/30",
    dot: "bg-primary",
  },
  [BuildStatus.partial]: {
    label: "PARTIAL",
    badgeClass: "bg-secondary/10 text-secondary border-secondary/30",
    dot: "bg-secondary",
  },
  [BuildStatus.blocked]: {
    label: "BLOCKED",
    badgeClass: "bg-accent/10 text-accent border-accent/30",
    dot: "bg-accent",
  },
  [BuildStatus.notStarted]: {
    label: "NOT STARTED",
    badgeClass: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "ALL" },
  { key: BuildStatus.done, label: "DONE" },
  { key: BuildStatus.partial, label: "PARTIAL" },
  { key: BuildStatus.blocked, label: "BLOCKED" },
  { key: BuildStatus.notStarted, label: "NOT STARTED" },
];

export default function PipelinePage() {
  const { data: pipeline, isLoading, error } = useBuildPipeline();
  const [activeFilter, setActiveFilter] = useState<FilterTab>("ALL");

  const statusCounts = useMemo(() => {
    if (!pipeline) return {} as Record<BuildStatus, number>;
    return pipeline.areas.reduce(
      (acc, area) => {
        acc[area.status] = (acc[area.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<BuildStatus, number>,
    );
  }, [pipeline]);

  const filteredAreas = useMemo(() => {
    if (!pipeline) return [];
    return activeFilter === "ALL"
      ? pipeline.areas
      : pipeline.areas.filter((a) => a.status === activeFilter);
  }, [pipeline, activeFilter]);

  const groupedByLayer = useMemo(() => {
    const groups: Record<number, BuildArea[]> = {};
    for (const area of filteredAreas) {
      const layer = Number(area.layer);
      if (!groups[layer]) groups[layer] = [];
      groups[layer].push(area);
    }
    return groups;
  }, [filteredAreas]);

  const blockedAreas = useMemo(
    () => pipeline?.areas.filter((a) => a.status === BuildStatus.blocked) ?? [],
    [pipeline],
  );

  const majorPct = pipeline
    ? Math.round(
        (Number(pipeline.summary.majorDone) /
          Math.max(Number(pipeline.summary.majorAreas), 1)) *
          100,
      )
    : 0;

  const layerPct = pipeline
    ? Math.round(
        (Number(pipeline.summary.layerDone) /
          Math.max(Number(pipeline.summary.layerItems), 1)) *
          100,
      )
    : 0;

  const lastUpdated = pipeline?.summary.lastUpdated
    ? new Date(Number(pipeline.summary.lastUpdated) * 1000).toLocaleString()
    : null;

  return (
    <Layout>
      <div className="space-y-6" data-ocid="pipeline.page">
        {/* Page Header */}
        <LayerHeader
          layer={11}
          title="ECOSYSTEM BUILD PIPELINE"
          description="15-layer architectural build progress tracker — BLOCKED, PARTIAL, DONE component states."
        />

        {/* Loading / Error */}
        {isLoading && (
          <div
            className="bg-card border border-border p-10 flex items-center justify-center gap-3"
            data-ocid="pipeline.loading_state"
          >
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs tracking-widest text-muted-foreground animate-pulse">
              LOADING PIPELINE DATA...
            </span>
          </div>
        )}

        {error && (
          <div
            className="bg-accent/5 border border-accent/40 p-4 flex items-center gap-3"
            data-ocid="pipeline.error_state"
          >
            <AlertTriangle className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="font-mono text-xs text-accent">
              ERROR LOADING PIPELINE — {(error as Error).message}
            </span>
          </div>
        )}

        {pipeline && (
          <>
            {/* Blocked Alert */}
            {blockedAreas.length > 0 && (
              <div
                className="bg-accent/5 border border-accent/40 p-4 space-y-3"
                data-ocid="pipeline.blocked_alert"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-accent" />
                  <span className="font-mono text-xs font-bold text-accent tracking-widest">
                    {blockedAreas.length} COMPONENT
                    {blockedAreas.length !== 1 ? "S" : ""} BLOCKED
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {blockedAreas.map((area) => (
                    <div
                      key={area.id}
                      className="flex items-center gap-2 bg-accent/5 border border-accent/20 px-3 py-2"
                    >
                      <span className="font-mono text-[10px] text-muted-foreground">
                        L{area.layer.toString()}
                      </span>
                      <span className="font-mono text-xs text-accent truncate">
                        {area.id}
                      </span>
                      <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">
                        {area.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                className="bg-card border border-primary/30 p-5 space-y-1 neon-border-cyan"
                data-ocid="pipeline.major_areas_stat"
              >
                <span className="metric-label">Major Areas Complete</span>
                <div className="flex items-end gap-2">
                  <span className="font-mono text-3xl font-bold text-primary">
                    {pipeline.summary.majorDone.toString()}
                  </span>
                  <span className="font-mono text-lg text-muted-foreground mb-0.5">
                    / {pipeline.summary.majorAreas.toString()}
                  </span>
                </div>
                <span className="font-mono text-xs text-primary/70">
                  {majorPct}% complete
                </span>
              </div>

              <div
                className="bg-card border border-primary/30 p-5 space-y-1 neon-border-cyan"
                data-ocid="pipeline.layer_items_stat"
              >
                <span className="metric-label">Layer Items Complete</span>
                <div className="flex items-end gap-2">
                  <span className="font-mono text-3xl font-bold text-primary">
                    {pipeline.summary.layerDone.toString()}
                  </span>
                  <span className="font-mono text-lg text-muted-foreground mb-0.5">
                    / {pipeline.summary.layerItems.toString()}
                  </span>
                </div>
                <span className="font-mono text-xs text-primary/70">
                  {layerPct}% complete
                </span>
              </div>

              <div
                className="bg-card border border-border p-5 space-y-1"
                data-ocid="pipeline.last_updated_stat"
              >
                <span className="metric-label">Last Updated</span>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {lastUpdated ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="bg-card border border-border p-5 space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <GitBranch className="w-4 h-4 text-primary" />
                <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Overall Progress
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
                    MAJOR AREAS COMPLETE
                  </span>
                  <span className="font-mono text-xs text-primary">
                    {majorPct}%
                  </span>
                </div>
                <div
                  className="h-3 bg-muted overflow-hidden"
                  data-ocid="pipeline.major_progress_bar"
                >
                  <div
                    className="h-full bg-primary transition-all duration-700"
                    style={{
                      width: `${majorPct}%`,
                      backgroundImage:
                        "linear-gradient(90deg, oklch(var(--primary)/0.7), oklch(var(--primary)))",
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[10px] tracking-wider text-muted-foreground">
                    LAYER ITEMS COMPLETE
                  </span>
                  <span className="font-mono text-xs text-primary">
                    {layerPct}%
                  </span>
                </div>
                <div
                  className="h-3 bg-muted overflow-hidden"
                  data-ocid="pipeline.layer_progress_bar"
                >
                  <div
                    className="h-full transition-all duration-700"
                    style={{
                      width: `${layerPct}%`,
                      backgroundImage:
                        "linear-gradient(90deg, oklch(var(--primary)/0.6), oklch(var(--secondary)/0.8))",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Status Legend */}
            <div
              className="flex flex-wrap gap-3"
              data-ocid="pipeline.status_legend"
            >
              {(Object.values(BuildStatus) as BuildStatus[]).map((status) => {
                const meta = STATUS_META[status];
                const count = statusCounts[status] ?? 0;
                return (
                  <div
                    key={status}
                    className="flex items-center gap-2 bg-card border border-border px-3 py-2"
                  >
                    <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                    <Badge
                      className={`font-mono text-[9px] border ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Filter Tabs */}
            <div
              className="flex gap-1 flex-wrap"
              data-ocid="pipeline.filter.tab"
            >
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFilter(tab.key)}
                  className={`font-mono text-[10px] tracking-widest px-3 py-1.5 border transition-smooth ${
                    activeFilter === tab.key
                      ? "border-primary text-primary bg-primary/10"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  }`}
                  data-ocid={`pipeline.filter.${tab.key.toLowerCase().replace(/\s/g, "_")}`}
                >
                  {tab.label}
                  {tab.key !== "ALL" && (
                    <span className="ml-1.5 opacity-60">
                      ({statusCounts[tab.key as BuildStatus] ?? 0})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Build Areas — Grouped by Layer */}
            <div className="space-y-4" data-ocid="pipeline.areas.list">
              {Object.keys(groupedByLayer)
                .map(Number)
                .sort((a, b) => a - b)
                .map((layer) => (
                  <LayerGroup
                    key={layer}
                    layer={layer}
                    areas={groupedByLayer[layer]}
                  />
                ))}

              {filteredAreas.length === 0 && (
                <div
                  className="bg-card border border-border p-10 flex items-center justify-center gap-3"
                  data-ocid="pipeline.empty_state"
                >
                  <CheckCircle className="w-5 h-5 text-muted-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">
                    NO AREAS MATCH CURRENT FILTER
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}

function LayerGroup({
  layer,
  areas,
}: {
  layer: number;
  areas: BuildArea[];
}) {
  const layerName = LAYER_NAMES[layer] ?? `Layer ${layer}`;
  const doneCount = areas.filter((a) => a.status === BuildStatus.done).length;

  return (
    <div className="bg-card border border-border overflow-hidden">
      {/* Layer Header Row */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5">
            L{layer}
          </span>
          <span className="font-mono text-xs tracking-wider text-foreground uppercase">
            {layerName}
          </span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">
          {doneCount}/{areas.length} DONE
        </span>
      </div>

      {/* Areas Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              <th className="text-left px-4 py-2 font-mono text-[10px] tracking-widest">
                AREA
              </th>
              <th className="text-center px-4 py-2 font-mono text-[10px] tracking-widest">
                STATUS
              </th>
              <th className="text-right px-4 py-2 font-mono text-[10px] tracking-widest">
                COMPLETION
              </th>
            </tr>
          </thead>
          <tbody>
            {areas.map((area, i) => (
              <AreaRow key={area.id} area={area} index={i} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AreaRow({ area, index }: { area: BuildArea; index: number }) {
  const meta = STATUS_META[area.status];
  const pct = Number(area.completionPct);
  const isBlocked = area.status === BuildStatus.blocked;

  return (
    <tr
      className={`border-b border-border/30 last:border-0 transition-colors ${
        isBlocked ? "bg-accent/5 hover:bg-accent/10" : "hover:bg-muted/20"
      }`}
      data-ocid={`pipeline.area.item.${index + 1}`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isBlocked && (
            <AlertTriangle className="w-3 h-3 text-accent flex-shrink-0" />
          )}
          <span className="font-mono text-[10px] text-muted-foreground">
            {area.id}
          </span>
          <span className="text-xs text-foreground">{area.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <Badge className={`font-mono text-[9px] border ${meta.badgeClass}`}>
          {meta.label}
        </Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <div className="w-24 h-1.5 bg-muted overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background:
                  area.status === BuildStatus.blocked
                    ? "oklch(var(--accent))"
                    : area.status === BuildStatus.done
                      ? "oklch(var(--primary))"
                      : "oklch(var(--secondary))",
              }}
            />
          </div>
          <span
            className={`font-mono text-[10px] w-8 text-right ${
              area.status === BuildStatus.blocked
                ? "text-accent"
                : "text-primary"
            }`}
          >
            {pct}%
          </span>
        </div>
      </td>
    </tr>
  );
}
