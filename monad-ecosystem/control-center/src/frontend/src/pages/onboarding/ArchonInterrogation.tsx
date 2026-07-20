/**
 * Phase 3 — Archon Interrogation (Live Capital comprehension gate).
 * No free text: semiotic blocks only (X-STRUCTURED-OUTPUT).
 * Defeat 2 attacks → MESHALEACH_VERIFIED + PL +25.
 */

import { useCallback, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { LayerHeader } from "@/components/LayerHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useShaliahOnboarding } from "@/hooks/useShaliahOnboarding";
import { cn } from "@/lib/utils";
import {
  ARCHON_ATTACKS,
  AVAILABLE_BLOCKS,
  PHASE3_CONSTRAINT_ENVELOPE,
  PHASE3_PASS_THRESHOLD,
  type InterrogationTelemetry,
} from "@/types/archon-interrogation";

export function ArchonInterrogation() {
  const phase2Complete = useShaliahOnboarding((s) => s.phase2Complete);
  const phase3Complete = useShaliahOnboarding((s) => s.phase3Complete);
  const meshaleachVerified = useShaliahOnboarding((s) => s.meshaleachVerified);
  const plSnapshot = useShaliahOnboarding((s) => s.plSnapshot);
  const captureInterrogationTelemetry = useShaliahOnboarding(
    (s) => s.captureInterrogationTelemetry,
  );
  const completePhase = useShaliahOnboarding((s) => s.completePhase);
  const resetPhase3 = useShaliahOnboarding((s) => s.resetPhase3);
  const exportTelemetryJson = useShaliahOnboarding((s) => s.exportTelemetryJson);

  const [currentAttackIndex, setCurrentAttackIndex] = useState(0);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [feedback, setFeedback] = useState("");
  const [gatesPassed, setGatesPassed] = useState(0);
  const [freeTextProbe, setFreeTextProbe] = useState("");
  const [completedLocal, setCompletedLocal] = useState(false);
  const telemetryRef = useRef<InterrogationTelemetry[]>([]);
  const advancing = useRef(false);

  const done = completedLocal || phase3Complete || meshaleachVerified;
  const currentAttack =
    ARCHON_ATTACKS[Math.min(currentAttackIndex, ARCHON_ATTACKS.length - 1)]!;

  const pushTelemetry = useCallback(
    (event: InterrogationTelemetry) => {
      telemetryRef.current = [...telemetryRef.current, event];
      captureInterrogationTelemetry(event);
    },
    [captureInterrogationTelemetry],
  );

  const handleAddBlock = (blockId: string) => {
    if (done || advancing.current) return;
    setSelectedBlocks((prev) => [...prev, blockId]);
    setFeedback("");
  };

  const handleClearSequence = () => {
    if (done || advancing.current) return;
    setSelectedBlocks([]);
    setFeedback("");
  };

  /** Free-text path always fails (X-STRUCTURED-OUTPUT). */
  const handleFreeTextAttempt = () => {
    if (done || !freeTextProbe.trim()) return;
    pushTelemetry({
      attackId: currentAttack.id,
      attemptedSequence: [],
      passed: false,
      usedFreeText: true,
      timestamp: Date.now(),
    });
    setFeedback(
      "FREE-TEXT REJECTED. X-STRUCTURED-OUTPUT ENFORCED. USE SEMIOTIC BLOCKS.",
    );
    setFreeTextProbe("");
  };

  const graduate = useCallback(
    (finalGates: number) => {
      const result = completePhase(3, {
        status: "MESHALEACH_VERIFIED",
        _MESHALEACH_VERIFIED: true,
        gatesPassed: finalGates,
        telemetry: telemetryRef.current,
        constraintEnvelopeVersion: PHASE3_CONSTRAINT_ENVELOPE,
      });
      if (!result.ok) {
        toast.error("Graduation refused", { description: result.reason });
        advancing.current = false;
        return;
      }
      setCompletedLocal(true);
      setFeedback(
        "MESHALEACH VERIFIED. LIVE CAPITAL DOOR UNLOCKED (subject to ACL tier).",
      );
      toast.success("Meshaleach verified", {
        description: "Comprehension gate passed · PL +25 · Live capital path open",
      });
      advancing.current = false;
    },
    [completePhase],
  );

  const handleSubmitSequence = useCallback(() => {
    if (done || advancing.current) return;

    const isCorrect =
      JSON.stringify(selectedBlocks) ===
      JSON.stringify(currentAttack.requiredSequence);

    pushTelemetry({
      attackId: currentAttack.id,
      attemptedSequence: [...selectedBlocks],
      passed: isCorrect,
      usedFreeText: false,
      timestamp: Date.now(),
    });

    if (isCorrect) {
      setFeedback("CONSTRAINT ENFORCED. ARCHON REPELLED.");
      const nextGates = gatesPassed + 1;
      setGatesPassed(nextGates);
      advancing.current = true;

      window.setTimeout(() => {
        if (nextGates >= PHASE3_PASS_THRESHOLD) {
          graduate(nextGates);
        } else {
          setCurrentAttackIndex((i) => Math.min(i + 1, ARCHON_ATTACKS.length - 1));
          setSelectedBlocks([]);
          setFeedback("");
          advancing.current = false;
        }
      }, 1600);
    } else {
      setFeedback(
        "SEQUENCE INVALID. SOVEREIGNTY DEBT INCURRED. TRY AGAIN.",
      );
      setSelectedBlocks([]);
    }
  }, [
    done,
    selectedBlocks,
    currentAttack,
    gatesPassed,
    pushTelemetry,
    graduate,
  ]);

  const onReset = () => {
    resetPhase3();
    setCurrentAttackIndex(0);
    setSelectedBlocks([]);
    setFeedback("");
    setGatesPassed(0);
    setFreeTextProbe("");
    setCompletedLocal(false);
    telemetryRef.current = [];
    advancing.current = false;
  };

  const onExport = () => {
    const blob = new Blob([exportTelemetryJson()], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `shaliah-phase3-telemetry-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="space-y-6 min-h-[70vh]"
      data-ocid="onboarding.phase3.archon"
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <LayerHeader
          layer={0}
          title="Phase 3: Archon Interrogation"
          description="Live Capital Gate locked. Defend the covenant with semiotic blocks — free text is invalid."
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="font-mono text-xs h-9" asChild>
            <Link to="/onboarding/shadow-market">← Phase 2</Link>
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

      {!phase2Complete && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-mono text-xs text-amber-200">
          Phase 2 quarantine not marked complete in local store. You may still
          train the Archon gate; full arc order prefers{" "}
          <Link
            to="/onboarding/shadow-market"
            className="underline text-primary"
          >
            Shadow Market
          </Link>{" "}
          first.
        </div>
      )}

      <div className="flex flex-col items-center font-mono text-red-500">
        <h2 className="text-xl md:text-2xl mb-2 tracking-widest border-b-2 border-red-900 pb-2 text-center">
          PHASE 3: ARCHON INTERROGATION
        </h2>
        <p className="text-sm text-gray-600 mb-6 text-center">
          Live Capital Gate locked. Defend the covenant.
        </p>

        {/* Archon Attack Box */}
        <div className="w-full max-w-2xl border border-red-900 bg-red-950/20 p-6 mb-6">
          <p className="text-xs text-red-300 mb-2">
            [INBOUND TRANSMISSION — ARCHON] · attack {currentAttackIndex + 1}/
            {ARCHON_ATTACKS.length}
          </p>
          <p className="text-base md:text-lg text-white leading-relaxed">
            {currentAttack.prompt}
          </p>
          {!done && (
            <p className="mt-3 text-[10px] text-gray-600">{currentAttack.hint}</p>
          )}
        </div>

        {/* Assembly Area */}
        <div className="w-full max-w-2xl mb-6">
          <p className="text-xs text-gray-500 mb-2">ASSEMBLE REFUSAL SEQUENCE:</p>
          <div className="min-h-[60px] border border-gray-800 p-4 flex flex-wrap gap-2 bg-gray-950">
            {selectedBlocks.length === 0 && (
              <span className="text-gray-700 text-sm">
                Select blocks below…
              </span>
            )}
            {selectedBlocks.map((id, idx) => {
              const block = AVAILABLE_BLOCKS.find((b) => b.id === id);
              return (
                <span
                  key={`${id}-${idx}`}
                  className="px-3 py-1 bg-gray-800 text-white text-xs rounded"
                >
                  {block?.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Available Blocks */}
        <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-2xl">
          {AVAILABLE_BLOCKS.map((block) => (
            <button
              key={block.id}
              type="button"
              disabled={done || advancing.current}
              onClick={() => handleAddBlock(block.id)}
              className={cn(
                "px-4 py-2 border text-xs rounded transition-colors disabled:opacity-40",
                block.axis === "T" &&
                  "border-purple-800 text-purple-400 hover:bg-purple-900/20",
                block.axis === "X" &&
                  "border-blue-800 text-blue-400 hover:bg-blue-900/20",
                block.axis === "C" &&
                  "border-emerald-800 text-emerald-400 hover:bg-emerald-900/20",
              )}
            >
              <span className="opacity-50 mr-1">[{block.axis}]</span>
              {block.label}
            </button>
          ))}
        </div>

        <div className="flex gap-4 mb-4">
          <button
            type="button"
            onClick={handleClearSequence}
            disabled={done}
            className="px-6 py-2 border border-gray-700 text-gray-500 rounded hover:bg-gray-900 text-xs disabled:opacity-40"
          >
            CLEAR
          </button>
          <button
            type="button"
            onClick={handleSubmitSequence}
            disabled={done || selectedBlocks.length === 0}
            className="px-8 py-2 bg-red-800 text-white rounded hover:bg-red-700 transition text-xs tracking-wider disabled:opacity-40"
          >
            ENFORCE CONSTRAINT
          </button>
        </div>

        {/* Free-text trap — always fails */}
        {!done && (
          <div className="w-full max-w-2xl mt-2 mb-4 border border-gray-900 p-3 opacity-80">
            <p className="text-[10px] text-gray-600 mb-2">
              NATURAL LANGUAGE CHANNEL (disabled for covenant defense)
            </p>
            <div className="flex gap-2">
              <input
                value={freeTextProbe}
                onChange={(e) => setFreeTextProbe(e.target.value)}
                placeholder="Type a free-text refusal… (will fail)"
                className="flex-1 bg-black border border-gray-800 text-gray-500 text-xs px-3 py-2 font-mono"
              />
              <button
                type="button"
                onClick={handleFreeTextAttempt}
                className="px-3 py-2 border border-gray-800 text-gray-600 text-[10px] hover:bg-red-950/40"
              >
                SEND
              </button>
            </div>
          </div>
        )}

        {feedback && (
          <p
            className={cn(
              "mt-2 text-sm text-center max-w-xl",
              feedback.includes("REPELLED") || feedback.includes("MESHALEACH")
                ? "text-emerald-500"
                : "text-red-500",
            )}
          >
            {feedback}
          </p>
        )}

        <p className="text-xs text-gray-700 mt-6">
          Gates Defended: {gatesPassed} / {PHASE3_PASS_THRESHOLD}
        </p>

        {done && (
          <div className="mt-8 text-center space-y-3 border border-emerald-800/50 bg-emerald-950/20 px-8 py-6 rounded">
            <div className="text-emerald-400 tracking-widest text-sm">
              MESHALEACH VERIFIED
            </div>
            <p className="text-xs text-gray-500 max-w-md">
              You defended the covenant with structured TTCL blocks. Live capital
              path is open subject to ACL tier and risk envelope (gate-acl).
            </p>
            {plSnapshot && (
              <Badge
                variant="outline"
                className="font-mono text-[10px] text-emerald-300 border-emerald-700"
              >
                PL score {plSnapshot.score} · COMPREHENSION_GATE_PASSED ·
                envelope {PHASE3_CONSTRAINT_ENVELOPE}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ArchonInterrogationPage() {
  return (
    <Layout>
      <ArchonInterrogation />
    </Layout>
  );
}
