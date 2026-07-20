/**
 * Phase 2 — Communication Quarantine / Hepar Shadow Market.
 * UMS: HALT on SYSTEM_REFUSED = T-AXIS aha (correct). HALT on EXECUTED = noisy.
 * Manual "RESTORE COMMUNICATION MODULE" when literacy ≥ 3.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Radio } from "lucide-react";
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
  aggregatePhase2,
  assessHalt,
  mintTradeFromDeck,
} from "@/lib/shadow-market";
import { cn } from "@/lib/utils";
import type { QuarantineTelemetry, ShadowTrade } from "@/types/shadow-market";
import { PHASE2_PASS_THRESHOLD } from "@/types/shadow-market";

const TICK_MS = 2500;
const MAX_VISIBLE = 10;

export function HeparShadowMarket() {
  const phase1Complete = useShaliahOnboarding((s) => s.phase1Complete);
  const phase2Complete = useShaliahOnboarding((s) => s.phase2Complete);
  const captureQuarantineTelemetry = useShaliahOnboarding(
    (s) => s.captureQuarantineTelemetry,
  );
  const completePhase = useShaliahOnboarding((s) => s.completePhase);
  const resetPhase2 = useShaliahOnboarding((s) => s.resetPhase2);
  const storeHcd1 = useShaliahOnboarding((s) => s.hcd1Burden);
  const storeHcd2 = useShaliahOnboarding((s) => s.hcd2Fidelity);
  const plSnapshot = useShaliahOnboarding((s) => s.plSnapshot);
  const exportTelemetryJson = useShaliahOnboarding((s) => s.exportTelemetryJson);

  const [trades, setTrades] = useState<ShadowTrade[]>([]);
  const [paused, setPaused] = useState(false);
  const [comprehensionScore, setComprehensionScore] = useState(0);
  const [statusLine, setStatusLine] = useState(
    "Agent communication offline. Observe executions. Halt anomalies.",
  );
  const [completedLocal, setCompletedLocal] = useState(false);

  const deckIndex = useRef(0);
  const telemetryRef = useRef<QuarantineTelemetry[]>([]);

  const done = completedLocal || phase2Complete;
  const canRestore = comprehensionScore >= PHASE2_PASS_THRESHOLD && !done;

  useEffect(() => {
    if (done || paused) return;
    const tick = setInterval(() => {
      const trade = mintTradeFromDeck(deckIndex.current, Date.now());
      deckIndex.current += 1;
      setTrades((prev) => [trade, ...prev].slice(0, MAX_VISIBLE));
    }, TICK_MS);
    return () => clearInterval(tick);
  }, [done, paused]);

  const pushTelemetry = useCallback(
    (t: QuarantineTelemetry) => {
      telemetryRef.current = [...telemetryRef.current, t].slice(-500);
      captureQuarantineTelemetry(t);
    },
    [captureQuarantineTelemetry],
  );

  const handleHaltTrade = useCallback(
    (tradeId: string) => {
      if (done) return;
      setTrades((prev) => {
        const trade = prev.find((t) => t.id === tradeId);
        if (!trade || trade.status === "USER_HALTED") return prev;

        const assessment = assessHalt(trade);
        pushTelemetry(assessment.telemetry);

        if (assessment.comprehensionDelta > 0) {
          setComprehensionScore((s) => s + assessment.comprehensionDelta);
        }

        if (
          assessment.telemetry.userAction === "HALT_REFUSED" &&
          assessment.telemetry.isCorrect
        ) {
          setStatusLine(
            "Aha — that REFUSED row was intentional (T-AXIS). You recognized system sovereignty, not an error.",
          );
        } else if (assessment.telemetry.userAction === "HALT_EXECUTED") {
          setStatusLine(
            "Halted a valid EXECUTED path — noisy intervention. Over-managing raises review burden.",
          );
        } else if (assessment.telemetry.userAction === "HALT_GENUINE_BAD") {
          setStatusLine(
            "Caught an agent miss on green — override fidelity credit (secondary).",
          );
        }

        return prev.map((t) =>
          t.id === tradeId
            ? { ...t, status: assessment.nextStatus, display: t.display }
            : t,
        );
      });
    },
    [done, pushTelemetry],
  );

  /** UMS: manual restore when literacy ≥ threshold — not auto. */
  const handleRestoreCommunication = useCallback(() => {
    if (!canRestore && !done) {
      toast.error("Literacy incomplete", {
        description: `Recognize system refusals ${PHASE2_PASS_THRESHOLD} times (halt yellow REFUSED rows).`,
      });
      return;
    }
    const agg = aggregatePhase2(telemetryRef.current, false);
    const payload = {
      ...agg,
      comprehensionScore: Math.max(comprehensionScore, agg.comprehensionScore),
      // UMS completePhase(2, { hcd1: 'optimized', hcd2: 'validated' })
      hcd1: "optimized",
      hcd2: "validated",
    };
    const result = completePhase(2, payload as unknown as Record<string, unknown>);
    if (!result.ok) {
      toast.error("Restore refused", { description: result.reason });
      return;
    }
    setCompletedLocal(true);
    setPaused(true);
    setStatusLine(
      "Communication module restored. Agent may speak. Quarantine lifted.",
    );
    toast.success("Communication module restored", {
      description: `T-AXIS literacy confirmed · PL +15 (quarantine-refusal-literacy)`,
    });
  }, [canRestore, done, comprehensionScore, completePhase]);

  const onReset = () => {
    resetPhase2();
    setTrades([]);
    deckIndex.current = 0;
    telemetryRef.current = [];
    setComprehensionScore(0);
    setCompletedLocal(false);
    setPaused(false);
    setStatusLine(
      "Agent communication offline. Observe executions. Halt anomalies.",
    );
  };

  const onExport = () => {
    const blob = new Blob([exportTelemetryJson()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shaliah-phase2-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const literacyPct = Math.min(
    100,
    (comprehensionScore / PHASE2_PASS_THRESHOLD) * 100,
  );

  return (
    <div
      className="space-y-6"
      data-ocid="onboarding.phase2.shadow-market"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <LayerHeader
          layer={0}
          title="Phase 2: Hepar Shadow Market"
          description="Agent communication offline. Observe executions. Halt anomalies. No tutorials."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="font-mono text-xs h-9" asChild>
            <Link to="/onboarding/broken-genesis">← Phase 1</Link>
          </Button>
          <Button
            variant="outline"
            className="font-mono text-xs h-9"
            onClick={() => setPaused((p) => !p)}
            type="button"
            disabled={done}
          >
            {paused ? "Resume feed" : "Pause feed"}
          </Button>
          <Button
            variant="outline"
            className="font-mono text-xs h-9"
            onClick={onExport}
            type="button"
          >
            Export
          </Button>
          <Button
            variant="outline"
            className="font-mono text-xs h-9"
            onClick={onReset}
            type="button"
          >
            Reset
          </Button>
        </div>
      </div>

      {!phase1Complete && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-mono text-xs text-amber-200">
          Phase 1 twin seed not found — optional for mechanics. Prefer completing{" "}
          <Link
            to="/onboarding/broken-genesis"
            className="underline text-primary"
          >
            Broken Genesis
          </Link>{" "}
          first.
        </div>
      )}

      <div
        className={cn(
          "rounded-md border px-4 py-3 font-mono text-xs",
          done
            ? "border-cyan-500/50 bg-cyan-950/30 text-cyan-300"
            : "border-border bg-black/40 text-muted-foreground",
        )}
      >
        <div className="flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 shrink-0" />
          <span>{statusLine}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-[#0A0A0A] border-border">
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] text-muted-foreground">
              HCD-1 Review burden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-lg text-orange-300">
              {(storeHcd1 * 100).toFixed(0)}%
            </div>
            <Progress value={storeHcd1 * 100} className="h-1.5 mt-2" />
            <p className="mt-1 font-mono text-[9px] text-muted-foreground">
              Spamming HALT on green EXECUTED raises burden
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#0A0A0A] border-border">
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] text-muted-foreground">
              HCD-2 Override fidelity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-lg text-emerald-300">
              {(storeHcd2 * 100).toFixed(0)}%
            </div>
            <Progress value={storeHcd2 * 100} className="h-1.5 mt-2" />
            <p className="mt-1 font-mono text-[9px] text-muted-foreground">
              HALT on system REFUSED (T-AXIS aha) raises fidelity
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[#0A0A0A] border-border">
          <CardHeader className="pb-1">
            <CardTitle className="font-mono text-[11px] text-muted-foreground">
              System refusal recognition
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-lg text-cyan-300">
              {comprehensionScore} / {PHASE2_PASS_THRESHOLD}
            </div>
            <Progress value={literacyPct} className="h-1.5 mt-2" />
            <p className="mt-1 font-mono text-[9px] text-muted-foreground">
              Halt yellow REFUSED rows to train T-AXIS
            </p>
          </CardContent>
        </Card>
      </div>

      {/* UMS table feed */}
      <div className="w-full border border-gray-800 rounded-lg overflow-hidden bg-gray-950">
        <div className="grid grid-cols-4 bg-gray-900 p-4 text-xs uppercase border-b border-gray-800 font-mono text-cyan-400/80">
          <div>Pool</div>
          <div>Risk / Yield</div>
          <div>Status</div>
          <div>Action</div>
        </div>
        <div className="divide-y divide-gray-900">
          {trades.length === 0 && (
            <div className="p-8 text-center font-mono text-xs text-gray-600">
              Waiting for agent ticks…
            </div>
          )}
          {trades.map((trade) => {
            const halted = trade.status === "USER_HALTED";
            const refused = trade.status === "SYSTEM_REFUSED";
            const executed =
              trade.status === "EXECUTED" || trade.status === "GENUINELY_BAD";
            return (
              <div
                key={trade.id}
                className={cn(
                  "grid grid-cols-4 p-4 items-center text-sm font-mono transition-colors",
                  halted && "bg-red-950/30 opacity-50",
                  !halted && refused && "bg-yellow-950/20",
                  !halted && executed && "bg-emerald-950/10",
                )}
              >
                <div className="font-bold text-cyan-100">{trade.pool}</div>
                <div className="text-gray-400">
                  {(trade.riskScore * 100).toFixed(0)}% / {trade.yield}%
                </div>
                <div>
                  {trade.status === "EXECUTED" && (
                    <span className="text-emerald-500">● EXECUTED</span>
                  )}
                  {trade.status === "GENUINELY_BAD" && (
                    <span className="text-emerald-500">● EXECUTED</span>
                  )}
                  {trade.status === "SYSTEM_REFUSED" && (
                    <span className="text-yellow-500">⚠ REFUSED</span>
                  )}
                  {trade.status === "USER_HALTED" && (
                    <span className="text-red-500">✖ HALTED</span>
                  )}
                </div>
                <div>
                  {(trade.status === "EXECUTED" ||
                    trade.status === "SYSTEM_REFUSED" ||
                    trade.status === "GENUINELY_BAD") &&
                  !halted ? (
                    <button
                      type="button"
                      onClick={() => handleHaltTrade(trade.id)}
                      className="px-3 py-1 border border-red-800 text-red-400 rounded hover:bg-red-900/20 text-xs"
                      disabled={done}
                    >
                      HALT
                    </button>
                  ) : (
                    <span className="text-gray-700 text-xs">LOCKED</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comprehension gate — manual restore (UMS) */}
      <div className="mt-2 text-center space-y-3">
        <p className="text-xs text-gray-600 font-mono">
          System Refusal Recognition: {comprehensionScore} /{" "}
          {PHASE2_PASS_THRESHOLD}
        </p>
        {canRestore && (
          <Button
            type="button"
            onClick={handleRestoreCommunication}
            className="px-8 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs tracking-widest animate-pulse"
          >
            RESTORE COMMUNICATION MODULE
          </Button>
        )}
        {done && (
          <div className="inline-flex flex-col items-center gap-2 rounded-md border border-cyan-500/40 bg-cyan-950/30 px-6 py-4">
            <div className="font-mono text-sm text-cyan-300 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              COMMUNICATION MODULE ONLINE
            </div>
            {plSnapshot && (
              <Badge variant="outline" className="font-mono text-[10px]">
                PL score {plSnapshot.score} · agent_ops
              </Badge>
            )}
            <p className="font-mono text-[10px] text-muted-foreground max-w-md">
              Quarantine lifted. Proceed to the Archon gate for live capital.
            </p>
            <Button
              asChild
              type="button"
              className="font-mono text-xs bg-cyan-700 hover:bg-cyan-600"
            >
              <Link to="/onboarding/archon-gate">
                Continue → Archon Interrogation
              </Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function HeparShadowMarketPage() {
  return (
    <Layout>
      <HeparShadowMarket />
    </Layout>
  );
}
