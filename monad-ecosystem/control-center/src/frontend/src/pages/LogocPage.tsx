import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
  Cell,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLogocCorpus,
  useFilteredCorpus,
  useLogocFilters,
} from "@/hooks/use-logoc";
import { useNavigate } from "@tanstack/react-router";
import type { LogocEvent, PragmatismBand } from "@/services/logoc-api";
import { computePps, getHumanReviewEvents } from "@/services/logoc-api";
import {
  BookOpen,
  Filter,
  RefreshCw,
  Search,
  XCircle,
  CheckCircle,
  BrainCircuit,
  Flag,
} from "lucide-react";

// ── Color palette (matches dark theme) ──────────────────────────────────────────

const BAND_COLORS: Record<PragmatismBand | "PENDING", string> = {
  INSTINCT: "#ef4444",      // red-500
  EXPERIENCE: "#f59e0b",    // amber-500
  FORMAL_THOUGHT: "#10b981", // emerald-500
  PENDING: "#6b7280",       // gray-500
};

const MODE_COLORS = {
  ICON: "#8b5cf6",    // violet-500
  INDEX: "#3b82f6",   // blue-500
  SYMBOL: "#ec4899",  // pink-500
};

// ── Helpers ─────────────────────────────────────────────────────────────────────

function PragmatismBandBadge({ band }: { band?: PragmatismBand | "PENDING" }) {
  if (!band) return <Badge variant="outline">Unknown</Badge>;
  const color = BAND_COLORS[band] ?? "#6b7280";
  return (
    <Badge
      style={{ backgroundColor: color + "20", borderColor: color + "60", color }}
      variant="outline"
      className="font-mono text-[10px]"
    >
      {band}
    </Badge>
  );
}

function ModeBadge({ mode }: { mode?: "ICON" | "INDEX" | "SYMBOL" }) {
  if (!mode) return <Badge variant="outline">—</Badge>;
  const color = MODE_COLORS[mode] ?? "#6b7280";
  return (
    <Badge
      style={{ backgroundColor: color + "20", borderColor: color + "60", color }}
      variant="outline"
      className="font-mono text-[10px]"
    >
      {mode}
    </Badge>
  );
}

function PeircePathBadge({ path }: { path?: string[] }) {
  if (!path || path.length < 3) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex gap-1">
      {path.map((p, i) => (
        <Badge
          key={i}
          variant="outline"
          className="font-mono text-[9px] px-1 py-0"
        >
          {p}
        </Badge>
      ))}
    </div>
  );
}

function TriadHeatmapCell({
  mode,
  band,
  count,
  maxCount,
}: {
  mode: string;
  band: string;
  count: number;
  maxCount: number;
}) {
  const opacity = maxCount > 0 ? 0.2 + (count / maxCount) * 0.8 : 0.2;
  const bandKey = band as PragmatismBand | "PENDING";
  const color = BAND_COLORS[bandKey] ?? "#6b7280";
  return (
    <div
      className="flex flex-col items-center justify-center p-2 rounded border border-border/40"
      style={{ backgroundColor: color + Math.round(opacity * 255).toString(16).padStart(2, "0") }}
    >
      <span className="text-[10px] font-mono text-muted-foreground">{mode}</span>
      <span className="text-xs font-mono font-bold" style={{ color }}>
        {count}
      </span>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export default function LogocPage() {
  const { data: corpus, isLoading, error, refetch } = useLogocCorpus();
  const { filters, setBand, setMode, setMigrationPending, setSource, reset } = useLogocFilters();
  const { events, total, bandDistribution, classDistribution, ppsScatter, triadHeatmap } =
    useFilteredCorpus(corpus, filters);

  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredEvents = useMemo(() => {
    if (!searchTerm) return events;
    return events.filter(
      (e) =>
        e.narrative.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.event_id.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [events, searchTerm]);

  const maxHeatmapCount = useMemo(() => {
    return Math.max(...triadHeatmap.map((h) => h.count), 1);
  }, [triadHeatmap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-ocid="logoc.page.loading">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-mono text-muted-foreground">Loading LOGOC corpus...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96" data-ocid="logoc.page.error">
        <div className="text-center space-y-2">
          <XCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-mono text-destructive">Failed to load corpus</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-ocid="logoc.page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h1 className="text-sm font-mono tracking-[0.25em] uppercase text-primary font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            LOGOC Corpus Explorer
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest mt-0.5">
            Peirce 66-class semiotic manifold — v5.2 corpus
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[10px] font-mono border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
            onClick={() => navigate({ to: "/logoc-review" })}
          >
            <Flag className="h-3 w-3 mr-1" />
            Review {corpus ? getHumanReviewEvents(corpus.events).length : 0}
          </Button>
          <Badge variant="outline" className="font-mono text-[10px]">
            <CheckCircle className="h-3 w-3 mr-1 text-primary" />
            {corpus?.accepted ?? 0} accepted
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            <XCircle className="h-3 w-3 mr-1 text-muted-foreground" />
            {corpus?.pending ?? 0} pending
          </Badge>
        </div>
      </div>

      {/* Filters */}
      <Card data-ocid="logoc.filters.card">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-mono tracking-widest uppercase flex items-center gap-2">
            <Filter className="h-3 w-3" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">Pragmatism Band</label>
              <Select value={filters.band} onValueChange={(v) => setBand(v as PragmatismBand | "all")}>
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bands</SelectItem>
                  <SelectItem value="INSTINCT">INSTINCT</SelectItem>
                  <SelectItem value="EXPERIENCE">EXPERIENCE</SelectItem>
                  <SelectItem value="FORMAL_THOUGHT">FORMAL_THOUGHT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">Peirce Mode</label>
              <Select value={filters.mode} onValueChange={(v) => setMode(v as "ICON" | "INDEX" | "SYMBOL" | "all")}>
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  <SelectItem value="ICON">ICON</SelectItem>
                  <SelectItem value="INDEX">INDEX</SelectItem>
                  <SelectItem value="SYMBOL">SYMBOL</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">Migration Status</label>
              <Select
                value={String(filters.migrationPending)}
                onValueChange={(v) => setMigrationPending(v === "all" ? "all" : v === "true")}
              >
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="true">Pending</SelectItem>
                  <SelectItem value="false">Classified</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-mono text-muted-foreground uppercase">Source</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Filter by source..."
                  className="h-8 text-xs font-mono"
                  value={filters.source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center mt-3">
            <span className="text-[10px] font-mono text-muted-foreground">
              {total} events match current filters
            </span>
            <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-[10px] font-mono">
              <RefreshCw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts row 1: Band + Class distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-ocid="logoc.band_distribution.card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono tracking-widest uppercase flex items-center gap-2">
              <BrainCircuit className="h-3 w-3" />
              Pragmatism Band Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bandDistribution} margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    dataKey="band"
                    tick={{ fontSize: 10, fontFamily: "monospace", fill: "#a1a1aa" }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontFamily: "monospace", fill: "#a1a1aa" }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {bandDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={BAND_COLORS[entry.band] ?? "#6b7280"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-ocid="logoc.class_distribution.card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono tracking-widest uppercase flex items-center gap-2">
              <BrainCircuit className="h-3 w-3" />
              Top Sign Classes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={classDistribution}
                  layout="vertical"
                  margin={{ left: 80, right: 20, top: 10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fontFamily: "monospace", fill: "#a1a1aa" }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 9, fontFamily: "monospace", fill: "#a1a1aa" }}
                    width={75}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: PPS vs Band Scatter + Triad Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-ocid="logoc.pps_scatter.card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono tracking-widest uppercase flex items-center gap-2">
              <BrainCircuit className="h-3 w-3" />
              PPS vs. Pragmatism Band
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ left: 0, right: 20, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis
                    type="number"
                    dataKey="pps"
                    name="PPS"
                    domain={[0, 1]}
                    tick={{ fontSize: 10, fontFamily: "monospace", fill: "#a1a1aa" }}
                    label={{ value: "PPS (1 - firstness)", position: "bottom", fontSize: 10, fill: "#a1a1aa" }}
                  />
                  <YAxis
                    type="category"
                    dataKey="band"
                    name="Band"
                    tick={{ fontSize: 10, fontFamily: "monospace", fill: "#a1a1aa" }}
                  />
                  <ZAxis type="number" dataKey="pps" range={[40, 100]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{
                      backgroundColor: "#18181b",
                      border: "1px solid #27272a",
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    formatter={(_value: number, _name: string, props: any) => {
                      if (!props?.payload) return ["", ""];
                      const p = props.payload;
                      return [p.pps?.toFixed(2) ?? "", `${p.label} (${p.event_id})`];
                    }}
                    labelFormatter={() => ""}
                  />
                  <Legend />
                  {(["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"] as PragmatismBand[]).map((band) => (
                    <Scatter
                      key={band}
                      name={band}
                      data={ppsScatter.filter((d) => d.band === band)}
                      fill={BAND_COLORS[band]}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card data-ocid="logoc.triad_heatmap.card">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-mono tracking-widest uppercase flex items-center gap-2">
              <BrainCircuit className="h-3 w-3" />
              Triad Heatmap (Mode × Band)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {(["ICON", "INDEX", "SYMBOL"] as const).map((mode) =>
                (["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"] as PragmatismBand[]).map((band) => {
                  const cell = triadHeatmap.find((h) => h.mode === mode && h.band === band);
                  return (
                    <TriadHeatmapCell
                      key={`${mode}-${band}`}
                      mode={mode}
                      band={band}
                      count={cell?.count ?? 0}
                      maxCount={maxHeatmapCount}
                    />
                  );
                }),
              )}
            </div>
            <div className="flex gap-4 mt-3 justify-center">
              {(["ICON", "INDEX", "SYMBOL"] as const).map((mode) => (
                <div key={mode} className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: MODE_COLORS[mode] }}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground">{mode}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event table */}
      <Card data-ocid="logoc.event_table.card">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-xs font-mono tracking-widest uppercase flex items-center gap-2">
              <Search className="h-3 w-3" />
              Events ({filteredEvents.length})
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search events..."
                className="h-7 pl-7 text-xs font-mono w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-[10px] font-mono uppercase w-32">ID</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase w-20">Band</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase w-16">Mode</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase w-48">Path</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase w-16">PPS</TableHead>
                  <TableHead className="text-[10px] font-mono uppercase">Narrative</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.slice(0, 50).map((ev: LogocEvent) => (
                  <TableRow key={ev.event_id} className="border-border/50">
                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                      {ev.event_id}
                    </TableCell>
                    <TableCell>
                      <PragmatismBandBadge
                        band={
                          ev.peirce_migration_pending
                            ? "PENDING"
                            : ev.peirce?.pragmatism_band
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <ModeBadge mode={ev.peirce?.mode} />
                    </TableCell>
                    <TableCell>
                      <PeircePathBadge path={ev.peirce?.path} />
                    </TableCell>
                    <TableCell className="font-mono text-[10px]">
                      {ev.peirce ? computePps(ev).toFixed(2) : "—"}
                    </TableCell>
                    <TableCell className="text-[11px] text-muted-foreground max-w-md truncate">
                      {ev.narrative}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs font-mono">
                      No events match current filters
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredEvents.length > 50 && (
            <div className="px-4 py-2 border-t border-border text-[10px] font-mono text-muted-foreground text-center">
              Showing 50 of {filteredEvents.length} events
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
