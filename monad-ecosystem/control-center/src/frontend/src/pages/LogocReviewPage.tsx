import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLogocCorpus } from "@/hooks/use-logoc";
import type { LogocEvent } from "@/services/logoc-api";
import { getHumanReviewEvents, buildTriadAlternatives, computePps } from "@/services/logoc-api";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  Eye,
  EyeOff,
  Flag,
  BrainCircuit,
  ChevronLeft,
} from "lucide-react";

// ── Color palette (matches dark theme) ───────────────────────────────────────────

const TRIAD_COLORS: Record<string, string> = {
  Qualisign: "#8b5cf6",
  Sinsign: "#3b82f6",
  Legisign: "#ec4899",
  Icon: "#8b5cf6",
  Index: "#3b82f6",
  Symbol: "#ec4899",
  Rheme: "#f59e0b",
  Dicent: "#10b981",
  Argument: "#ef4444",
};

// ── Helpers ──────────────────────────────────────────────────────────────────────

function TriadNode({ node, size = "sm" }: { node: string; size?: "sm" | "md" | "lg" }) {
  const color = TRIAD_COLORS[node] ?? "#6b7280";
  const sizeClasses = {
    sm: "text-[9px] px-1 py-0",
    md: "text-[10px] px-1.5 py-0.5",
    lg: "text-xs px-2 py-1",
  };
  return (
    <Badge
      style={{
        backgroundColor: color + "20",
        borderColor: color + "60",
        color,
      }}
      variant="outline"
      className={`font-mono ${sizeClasses[size]} border`}
    >
      {node}
    </Badge>
  );
}

function ConfidenceBadge({ confidence, reason }: { confidence?: number | null; reason?: string | null }) {
  if (confidence === null || confidence === undefined) return <Badge variant="outline">—</Badge>;
  let color = "#10b981"; // high
  let label = "HIGH";
  if (confidence < 0.55) {
    color = "#ef4444";
    label = "LOW";
  } else if (confidence < 0.85) {
    color = "#f59e0b";
    label = "MED";
  }
  return (
    <Badge
      style={{ backgroundColor: color + "20", borderColor: color + "60", color }}
      variant="outline"
      className="font-mono text-[10px]"
    >
      {label} {confidence.toFixed(2)}
    </Badge>
  );
}

function FlagToggle({
  label,
  checked,
  onChange,
  color,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 px-2 rounded border border-border/40 hover:bg-muted/30 transition-smooth">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: checked ? color : "#27272a" }} />
        <span className="text-[10px] font-mono uppercase text-muted-foreground">{label}</span>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}

// ── Single event card ───────────────────────────────────────────────────────────

function ReviewEventCard({
  event,
  index,
  onAccept,
  onReject,
  onEscalate,
}: {
  event: LogocEvent;
  index: number;
  onAccept: (ev: LogocEvent, updatedFlags: Record<string, boolean>) => void;
  onReject: (ev: LogocEvent) => void;
  onEscalate: (ev: LogocEvent) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [flags, setFlags] = useState<Record<string, boolean>>({
    single_occurrence: false,
    rule_based: false,
    similarity: false,
    causality: false,
    convention: false,
    possibility: false,
    fact: false,
    reason: false,
    ...event.semiotic_flags,
  });
  const [flagsDirty, setFlagsDirty] = useState(false);

  const triad = useMemo(() => buildTriadAlternatives(flags), [flags]);

  const updateFlag = (key: string, value: boolean) => {
    setFlags((prev) => {
      const next = { ...prev, [key]: value };
      setFlagsDirty(true);
      return next;
    });
  };

  const reason = event.pipeline_triage_reason || event.peirce_migration_source || "unknown";
  const confidence = event.pipeline_ml_confidence;
  const rubricClass = event.pipeline_rubric_class_id ?? event.peirce?.sign_class_id ?? "—";
  const mlClass = event.pipeline_ml_class_id ?? "—";

  return (
    <Card data-ocid={`logoc.review.card.${index}`} className="border-border/60">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">#{index + 1}</span>
              <span className="font-mono text-xs text-foreground">{event.event_id}</span>
              {event.peirce_migration_pending && (
                <Badge variant="outline" className="font-mono text-[9px] border-amber-500/40 text-amber-500">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                  PENDING
                </Badge>
              )}
              {event.pipeline_triage_status === "human_review" && (
                <Badge variant="outline" className="font-mono text-[9px] border-rose-500/40 text-rose-500">
                  <Flag className="h-2.5 w-2.5 mr-0.5" />
                  HUMAN REVIEW
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <span>{new Date(event.timestamp).toLocaleDateString()}</span>
              <span>•</span>
              <span>
                PPS {event.peirce ? computePps(event).toFixed(2) : "—"}
              </span>
              {confidence !== null && confidence !== undefined && (
                <>
                  <span>•</span>
                  <ConfidenceBadge confidence={confidence} reason={reason} />
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] font-mono"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {expanded ? "Collapse" : "Inspect"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Narrative */}
        <div className="bg-muted/30 rounded p-3 border border-border/30">
          <p className="text-[11px] text-muted-foreground leading-relaxed font-mono">
            {expanded || event.narrative.length < 200
              ? event.narrative
              : event.narrative.slice(0, 200) + "…"}
          </p>
          {!expanded && event.narrative.length >= 200 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-[10px] font-mono text-primary mt-1 hover:underline"
            >
              Show full narrative
            </button>
          )}
        </div>

        {/* Pipeline metadata */}
        {(event.pipeline_triage_status || event.pipeline_rubric_class_id !== undefined) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-muted/20 rounded p-2 border border-border/30">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">Rubric Class</div>
              <div className="text-xs font-mono text-foreground mt-0.5">{rubricClass}</div>
            </div>
            <div className="bg-muted/20 rounded p-2 border border-border/30">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">ML Class</div>
              <div className="text-xs font-mono text-foreground mt-0.5">{mlClass}</div>
            </div>
            <div className="bg-muted/20 rounded p-2 border border-border/30">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">Confidence</div>
              <div className="text-xs font-mono text-foreground mt-0.5">
                {confidence?.toFixed(3) ?? "—"}
              </div>
            </div>
            <div className="bg-muted/20 rounded p-2 border border-border/30">
              <div className="text-[9px] font-mono text-muted-foreground uppercase">Reason</div>
              <div className="text-[10px] font-mono text-foreground mt-0.5 truncate" title={reason}>
                {reason}
              </div>
            </div>
          </div>
        )}

        {/* Triad inspector */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              Triad Inspector
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground mr-1">Current:</span>
            <TriadNode node={triad.canonical.vehicle} size="md" />
            <TriadNode node={triad.canonical.object} size="md" />
            <TriadNode node={triad.canonical.interpretant} size="md" />
          </div>
          {expanded && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-muted-foreground">Alternatives (one triad changed):</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {triad.alternatives.map((alt) => (
                  <div
                    key={alt.changed}
                    className="flex items-center gap-1.5 bg-muted/20 rounded px-2 py-1.5 border border-border/30"
                  >
                    <span className="text-[9px] font-mono text-muted-foreground uppercase w-12">
                      {alt.changed}
                    </span>
                    <TriadNode node={alt.vehicle} size="sm" />
                    <TriadNode node={alt.object} size="sm" />
                    <TriadNode node={alt.interpretant} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Flag override */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flag className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Flag Override
              </span>
            </div>
            {flagsDirty && (
              <Badge variant="outline" className="font-mono text-[9px] border-amber-500/40 text-amber-500">
                Modified
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <FlagToggle label="Single Occurrence" checked={flags.single_occurrence} onChange={(v) => updateFlag("single_occurrence", v)} color="#3b82f6" />
            <FlagToggle label="Rule Based" checked={flags.rule_based} onChange={(v) => updateFlag("rule_based", v)} color="#ec4899" />
            <FlagToggle label="Similarity" checked={flags.similarity} onChange={(v) => updateFlag("similarity", v)} color="#8b5cf6" />
            <FlagToggle label="Causality" checked={flags.causality} onChange={(v) => updateFlag("causality", v)} color="#3b82f6" />
            <FlagToggle label="Convention" checked={flags.convention} onChange={(v) => updateFlag("convention", v)} color="#ec4899" />
            <FlagToggle label="Possibility" checked={flags.possibility} onChange={(v) => updateFlag("possibility", v)} color="#f59e0b" />
            <FlagToggle label="Fact" checked={flags.fact} onChange={(v) => updateFlag("fact", v)} color="#10b981" />
            <FlagToggle label="Reason" checked={flags.reason} onChange={(v) => updateFlag("reason", v)} color="#ef4444" />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
          <Button
            size="sm"
            className="h-8 text-[10px] font-mono bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onAccept(event, flags)}
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px] font-mono border-rose-500/40 text-rose-500 hover:bg-rose-500/10"
            onClick={() => onReject(event)}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-[10px] font-mono border-amber-500/40 text-amber-500 hover:bg-amber-500/10"
            onClick={() => onEscalate(event)}
          >
            <ArrowUpCircle className="h-3 w-3 mr-1" />
            Escalate
          </Button>
          {flagsDirty && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-[10px] font-mono"
              onClick={() => {
                setFlags({ ...event.semiotic_flags });
                setFlagsDirty(false);
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset Flags
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────────

export default function ReviewPage() {
  const navigate = useNavigate();
  const { data: corpus, isLoading, error, refetch } = useLogocCorpus();
  const [searchTerm, setSearchTerm] = useState("");
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());

  const hrEvents = useMemo(() => {
    if (!corpus) return [];
    const all = getHumanReviewEvents(corpus.events);
    if (!searchTerm) return all.filter((e) => !resolvedIds.has(e.event_id));
    return all.filter(
      (e) =>
        !resolvedIds.has(e.event_id) &&
        (e.narrative.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.event_id.toLowerCase().includes(searchTerm.toLowerCase())),
    );
  }, [corpus, searchTerm, resolvedIds]);

  const handleAccept = (ev: LogocEvent, updatedFlags: Record<string, boolean>) => {
    // In a real implementation, this would POST to the backend
    console.log("ACCEPT", ev.event_id, updatedFlags);
    setResolvedIds((prev) => new Set(prev).add(ev.event_id));
  };

  const handleReject = (ev: LogocEvent) => {
    console.log("REJECT", ev.event_id);
    setResolvedIds((prev) => new Set(prev).add(ev.event_id));
  };

  const handleEscalate = (ev: LogocEvent) => {
    console.log("ESCALATE", ev.event_id);
    setResolvedIds((prev) => new Set(prev).add(ev.event_id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-ocid="logoc.review.loading">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-mono text-muted-foreground">Loading review queue...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96" data-ocid="logoc.review.error">
        <div className="text-center space-y-2">
          <XCircle className="h-8 w-8 text-destructive mx-auto" />
          <p className="text-sm font-mono text-destructive">Failed to load review queue</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  const totalHr = corpus ? getHumanReviewEvents(corpus.events).length : 0;
  const remaining = hrEvents.length;
  const resolved = resolvedIds.size;

  return (
    <div className="space-y-6" data-ocid="logoc.review.page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
        <div>
          <h1 className="text-sm font-mono tracking-[0.25em] uppercase text-primary font-semibold flex items-center gap-2">
            <Flag className="h-4 w-4" />
            LOGOC Human Review
          </h1>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest mt-0.5">
            Pipeline-flagged events requiring manual triad inspection
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] font-mono"
            onClick={() => navigate({ to: "/logoc" })}
          >
            <ChevronLeft className="h-3 w-3 mr-1" />
            Back to Corpus
          </Button>
          <div className="h-4 w-px bg-border" />
          <Badge variant="outline" className="font-mono text-[10px]">
            <AlertTriangle className="h-3 w-3 mr-1 text-amber-500" />
            {remaining} pending
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            <CheckCircle className="h-3 w-3 mr-1 text-emerald-500" />
            {resolved} resolved
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px]">
            {totalHr} total flagged
          </Badge>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events by ID or narrative..."
            className="w-full h-8 pl-7 pr-3 text-xs font-mono bg-muted/30 border border-border/40 rounded focus:outline-none focus:border-primary/60"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="ghost" size="sm" className="h-8 text-[10px] font-mono" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Refresh
        </Button>
      </div>

      {/* Queue */}
      <div className="space-y-4">
        {hrEvents.map((ev, i) => (
          <ReviewEventCard
            key={ev.event_id}
            event={ev}
            index={i}
            onAccept={handleAccept}
            onReject={handleReject}
            onEscalate={handleEscalate}
          />
        ))}

        {hrEvents.length === 0 && (
          <Card className="border-border/40">
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-3" />
              <p className="text-sm font-mono text-muted-foreground">
                {totalHr === 0
                  ? "No events flagged for human review. Pipeline is operating autonomously."
                  : "All flagged events have been resolved. Queue is clear."}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
