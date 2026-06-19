/**
 * GnosisStreamPanel.tsx
 *
 * Live GnosisScore stream panel for the Sovereign Monad Control Center.
 *
 * Connects to the gnostic-engine SSE stream via useSignalStream, displays
 * the most recent scores in a ring buffer list with colour-coded verdict
 * badges and real-time coherence metrics.
 *
 * Gracefully degrades when the engine is offline: shows last known state
 * from the REST poll (useLatestGnosisScores) and a reconnecting indicator.
 */

import { useCallback } from "react";
import { useSignalStream, type ConnectionState } from "@/hooks/useSignalStream";
import { useLatestGnosisScores } from "@/hooks/use-gnostic";
import type { GnosisScore } from "@/services/gnostic-api";
import { cn } from "@/lib/utils";

// ── Verdict styling ────────────────────────────────────────────────────────────

function verdictClass(verdict: string): string {
  switch (verdict) {
    case "FOCAL_LOCK":
      return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10";
    case "BLINK":
      return "text-amber-400 border-amber-500/40 bg-amber-500/10";
    case "QUARANTINE":
      return "text-red-400 border-red-500/40 bg-red-500/10";
    case "MAGNITUDE_REJECT":
      return "text-orange-400 border-orange-500/40 bg-orange-500/10";
    default:
      return "text-slate-400 border-slate-500/40 bg-slate-500/10";
  }
}

function connectionDot(state: ConnectionState): string {
  switch (state) {
    case "open":
      return "bg-emerald-400 animate-pulse";
    case "connecting":
      return "bg-amber-400 animate-pulse";
    case "error":
    case "closed":
      return "bg-red-500";
    default:
      return "bg-slate-500";
  }
}

function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case "open":
      return "LIVE";
    case "connecting":
      return "CONNECTING";
    case "error":
      return "ERROR";
    case "closed":
      return "CLOSED";
    default:
      return "IDLE";
  }
}

// ── Score row ──────────────────────────────────────────────────────────────────

function ScoreRow({ score }: { score: GnosisScore }) {
  const scorePercent = Math.round(score.overall_score * 100);
  const ts = new Date(score.window_end).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-md border border-border/40 bg-card/30 hover:bg-card/50 transition-colors font-mono text-[11px]"
      data-ocid={`gnosis-stream.score.${score.sequence_number}`}
    >
      {/* Sequence */}
      <span className="text-muted-foreground w-8 text-right shrink-0">#{score.sequence_number}</span>

      {/* Agent */}
      <span
        className="text-primary truncate w-24 shrink-0"
        title={score.agent_id}
      >
        {score.agent_id.length > 10 ? `${score.agent_id.slice(0, 10)}…` : score.agent_id}
      </span>

      {/* Score bar */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <div className="flex-1 h-1.5 bg-border/40 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              scorePercent >= 85
                ? "bg-emerald-400"
                : scorePercent >= 65
                  ? "bg-amber-400"
                  : "bg-red-500",
            )}
            style={{ width: `${scorePercent}%` }}
          />
        </div>
        <span className="text-foreground/70 w-8 text-right shrink-0">{scorePercent}%</span>
      </div>

      {/* Verdict badge */}
      <span
        className={cn(
          "px-1.5 py-0.5 rounded border text-[9px] tracking-wider uppercase shrink-0",
          verdictClass(score.verdict),
        )}
      >
        {score.verdict.replace("_", " ")}
      </span>

      {/* Timestamp */}
      <span className="text-muted-foreground w-20 text-right shrink-0">{ts}</span>
    </div>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

interface GnosisStreamPanelProps {
  /** Max scores to display. Default: 10. */
  displayLimit?: number;
  className?: string;
}

export function GnosisStreamPanel({
  displayLimit = 10,
  className,
}: GnosisStreamPanelProps) {
  // Polling fallback — provides initial data when SSE hasn't fired yet
  const { data: restData } = useLatestGnosisScores(displayLimit);

  // Live SSE stream
  const { scores: liveScores, connectionState, error, reconnect } = useSignalStream({
    bufferSize: displayLimit,
    enabled: true,
  });

  // Merge: live SSE scores take precedence; fall back to REST poll
  const displayScores: GnosisScore[] =
    liveScores.length > 0
      ? liveScores.slice(0, displayLimit)
      : (restData?.scores ?? []).slice(0, displayLimit);

  const handleReconnect = useCallback(() => {
    reconnect();
  }, [reconnect]);

  return (
    <div
      className={cn("flex flex-col gap-3", className)}
      data-ocid="gnosis-stream.panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-mono tracking-[0.2em] uppercase text-primary font-semibold">
            Gnosis Stream
          </h3>
          <p className="text-[10px] font-mono text-muted-foreground tracking-wider mt-0.5">
            Live Stokes-Mueller coherence scores
          </p>
        </div>

        {/* Connection state badge */}
        <div className="flex items-center gap-2">
          <span
            className={cn("inline-block w-2 h-2 rounded-full", connectionDot(connectionState))}
          />
          <span className="text-[10px] font-mono text-muted-foreground tracking-widest">
            {connectionLabel(connectionState)}
          </span>
          {(connectionState === "error" || connectionState === "closed") && (
            <button
              type="button"
              onClick={handleReconnect}
              className="text-[10px] font-mono text-primary hover:underline tracking-wider"
              data-ocid="gnosis-stream.reconnect.button"
            >
              [reconnect]
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="text-[10px] font-mono text-destructive/80 bg-destructive/5 border border-destructive/20 px-2 py-1.5 rounded">
          {error}
        </div>
      )}

      {/* Score list */}
      <div className="flex flex-col gap-1.5">
        {displayScores.length === 0 ? (
          <div className="text-[11px] font-mono text-muted-foreground text-center py-6 border border-dashed border-border/30 rounded-md">
            Waiting for engine signal…
          </div>
        ) : (
          displayScores.map((score) => (
            <ScoreRow key={`${score.agent_id}-${score.sequence_number}`} score={score} />
          ))
        )}
      </div>

      {/* Footer stats */}
      {displayScores.length > 0 && (
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border/30 pt-2">
          <span>
            {displayScores.length} score{displayScores.length !== 1 ? "s" : ""} displayed
          </span>
          {liveScores.length > 0 && (
            <span className="text-primary/60">SSE active — {liveScores.length} buffered</span>
          )}
        </div>
      )}
    </div>
  );
}
