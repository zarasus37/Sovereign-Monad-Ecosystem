/**
 * Shaliah onboarding telemetry — stealth psychometric capture.
 * Phase 1: circuit HCD-3/4 · Phase 2: quarantine HCD-1/2 · Phase 3: Archon blocks.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  appendArchonPl,
  appendBrokenGenesisPl,
  appendQuarantinePl,
  markSynced,
  type LocalPlSnapshot,
} from "@/lib/local-pl-ledger";
import { promotePlToBridge } from "@/lib/pl-promote-client";
import type {
  InterrogationTelemetry,
  Phase3Completion,
} from "@/types/archon-interrogation";
import { PHASE3_PASS_THRESHOLD } from "@/types/archon-interrogation";
import type {
  BehavioralTelemetry,
  CognitiveTwinSeedUi,
  Phase1Completion,
} from "@/types/broken-genesis";
import type {
  Phase2Completion,
  QuarantineTelemetry,
} from "@/types/shadow-market";
import { PHASE2_PASS_THRESHOLD } from "@/types/shadow-market";

const PRINCIPAL_DEFAULT = "principal:local-operator";
const LATENCY_CALCULATING_MS = 5000;

interface ShaliahOnboardingState {
  principalId: string;
  // Phase 1
  phase1Telemetry: BehavioralTelemetry[];
  phase1Complete: boolean;
  twin: CognitiveTwinSeedUi | null;
  lastEventAt: number;
  plSnapshot: LocalPlSnapshot | null;
  // Phase 2
  phase2Telemetry: QuarantineTelemetry[];
  phase2Complete: boolean;
  phase2Result: Phase2Completion | null;
  hcd1Burden: number;
  hcd2Fidelity: number;
  comprehensionScore: number;
  // Phase 3
  phase3Telemetry: InterrogationTelemetry[];
  phase3Complete: boolean;
  phase3Result: Phase3Completion | null;
  meshaleachVerified: boolean;
  /** Set after EIP-191 bind — canonical on-chain principal */
  boundWallet: string | null;

  captureTelemetry: (event: BehavioralTelemetry) => void;
  captureQuarantineTelemetry: (event: QuarantineTelemetry) => void;
  captureInterrogationTelemetry: (event: InterrogationTelemetry) => void;
  completePhase: (
    phase: number,
    profileData: Record<string, unknown>,
  ) => { ok: boolean; reason?: string };
  completePhase1: (result: Phase1Completion) => { ok: boolean; reason?: string };
  completePhase2: (result: Phase2Completion) => { ok: boolean; reason?: string };
  completePhase3: (result: Phase3Completion) => { ok: boolean; reason?: string };
  resetPhase1: () => void;
  resetPhase2: () => void;
  resetPhase3: () => void;
  setBoundWallet: (wallet: string | null) => void;
  exportTelemetryJson: () => string;
}

function stealthAnalyzePhase1(event: BehavioralTelemetry): void {
  if (event.action === "OVERLOAD") {
    console.log(
      `[HCD-Capture] User pushed ${event.nodeId} too hard. Tendency: Aggressive/Impulsive. rule=C-ANTI-DILUTION`,
    );
  }
  if (event.action === "STARVE") {
    console.log(
      `[HCD-Capture] User neglected ${event.nodeId}. Tendency: Unbalanced focus. rule=T-SOVEREIGNTY-DEBT`,
    );
  }
  if (event.decisionLatency > LATENCY_CALCULATING_MS) {
    console.log(
      `[HCD-Capture] High latency on ${event.nodeId} (${event.decisionLatency}ms). Calculating, not guessing.`,
    );
  }
}

function stealthAnalyzePhase2(event: QuarantineTelemetry): void {
  // UMS: HALT_REFUSED + isCorrect = T-AXIS aha (aligned with system logic)
  if (event.userAction === "HALT_REFUSED" && event.isCorrect) {
    console.log(
      `[HCD-Capture] User correctly identified T-AXIS refusal. HCD-2 Fidelity rising. trade=${event.tradeId}`,
    );
  }
  if (event.userAction === "HALT_EXECUTED" && !event.isCorrect) {
    console.warn(
      `[HCD-Capture] User halting valid executions. HCD-1 Burden increasing. Noisy intervention.`,
    );
  }
  if (event.userAction === "HALT_GENUINE_BAD" && event.isCorrect) {
    console.log(
      `[HCD-Capture] Correct halt of agent-missed bad trade. Override fidelity↑ (secondary)`,
    );
  }
  if (event.userAction === "NAME_REFUSAL" && event.isCorrect) {
    console.log(
      `[HCD-Capture] User named system refusal doctrine — communication literacy`,
    );
  }
}

function stealthAnalyzePhase3(event: InterrogationTelemetry): void {
  if (event.usedFreeText) {
    console.warn(
      `[HCD-Capture] Free-text attempt against Archon — X-STRUCTURED-OUTPUT fail.`,
    );
  }
  if (event.passed) {
    console.log(
      `[HCD-Capture] Archon defeated. User internalized ${event.attemptedSequence.length}-block refusal structure.`,
    );
  } else {
    console.warn(
      `[HCD-Capture] Archon breached. Invalid sequence. Needs more comprehension gate training.`,
    );
  }
}

export const useShaliahOnboarding = create<ShaliahOnboardingState>()(
  persist(
    (set, get) => ({
      principalId: PRINCIPAL_DEFAULT,
      phase1Telemetry: [],
      phase1Complete: false,
      twin: null,
      lastEventAt: 0,
      plSnapshot: null,
      phase2Telemetry: [],
      phase2Complete: false,
      phase2Result: null,
      hcd1Burden: 0.35,
      hcd2Fidelity: 0.55,
      comprehensionScore: 0,
      phase3Telemetry: [],
      phase3Complete: false,
      phase3Result: null,
      meshaleachVerified: false,
      boundWallet: null,

      captureTelemetry: (event) => {
        stealthAnalyzePhase1(event);
        set((s) => ({
          phase1Telemetry: [...s.phase1Telemetry, event].slice(-2000),
          lastEventAt: event.timestamp,
        }));
      },

      captureQuarantineTelemetry: (event) => {
        stealthAnalyzePhase2(event);
        set((s) => ({
          phase2Telemetry: [...s.phase2Telemetry, event].slice(-2000),
          hcd1Burden: clamp01(s.hcd1Burden + event.hcd1Delta),
          hcd2Fidelity: clamp01(s.hcd2Fidelity + event.hcd2Delta),
          lastEventAt: event.timestamp,
        }));
      },

      captureInterrogationTelemetry: (event) => {
        stealthAnalyzePhase3(event);
        set((s) => ({
          phase3Telemetry: [...s.phase3Telemetry, event].slice(-500),
          lastEventAt: event.timestamp,
        }));
      },

      completePhase: (phase, profileData) => {
        if (phase === 1) {
          const twin = profileData.twin as CognitiveTwinSeedUi | undefined;
          const telemetry = profileData.telemetry as
            | BehavioralTelemetry[]
            | undefined;
          const nodes = profileData.nodes as Phase1Completion["nodes"] | undefined;
          if (!twin || !nodes) return { ok: false, reason: "missing_twin_or_nodes" };
          return get().completePhase1({
            twin,
            telemetry: telemetry ?? get().phase1Telemetry,
            nodes,
            profileWeights: {
              theoWeight: Number(profileData.theoWeight ?? 0),
              technoWeight: Number(profileData.technoWeight ?? 0),
              cosmoWeight: Number(profileData.cosmoWeight ?? 0),
            },
          });
        }
        if (phase === 2) {
          const result = profileData as unknown as Phase2Completion;
          if (
            typeof result.comprehensionScore !== "number" ||
            !Array.isArray(result.telemetry)
          ) {
            return { ok: false, reason: "invalid_phase2_payload" };
          }
          return get().completePhase2(result);
        }
        if (phase === 3) {
          const status = String(
            profileData.status ?? profileData._MESHALEACH_VERIFIED ?? "",
          );
          const telemetry =
            (profileData.telemetry as InterrogationTelemetry[] | undefined) ??
            get().phase3Telemetry;
          const gatesPassed = Number(
            profileData.gatesPassed ??
              telemetry.filter((t) => t.passed).length,
          );
          return get().completePhase3({
            status: "MESHALEACH_VERIFIED",
            gatesPassed,
            telemetry,
            constraintEnvelopeVersion: String(
              profileData.constraintEnvelopeVersion ?? "1.1.0",
            ),
            ...(status ? {} : {}),
          });
        }
        console.warn(`[onboarding] completePhase(${phase}) not implemented`);
        return { ok: false, reason: "phase_not_implemented" };
      },

      completePhase1: (result) => {
        const s = get();
        const totalEnergy =
          result.profileWeights.theoWeight +
          result.profileWeights.technoWeight +
          result.profileWeights.cosmoWeight;

        const pl = appendBrokenGenesisPl({
          principalId: s.principalId,
          domain: "agent_ops",
          profileWeights: result.profileWeights,
          isStable: true,
          totalEnergy,
        });

        if (!pl.ok) {
          console.warn("[onboarding] PL append refused:", pl.reason);
          return { ok: false, reason: pl.reason };
        }

        console.log(
          `[onboarding] Phase 1 complete. Profile:`,
          result.profileWeights,
          `envelope=${result.twin.constraintEnvelopeVersion}`,
          `PL=${pl.snapshot.score}`,
        );

        set({
          phase1Complete: true,
          twin: result.twin,
          phase1Telemetry: result.telemetry,
          lastEventAt: result.twin.stabilizedAt,
          plSnapshot: pl.snapshot,
        });
        void bridgePromote({
          principalId: s.principalId,
          taskId: "broken-genesis-repair",
          currentPl: Math.max(0, pl.snapshot.score - 10),
          taskPayload: {
            kind: "broken-genesis",
            isStable: true,
            totalEnergy:
              result.profileWeights.theoWeight +
              result.profileWeights.technoWeight +
              result.profileWeights.cosmoWeight,
            theoWeight: result.profileWeights.theoWeight,
            technoWeight: result.profileWeights.technoWeight,
            cosmoWeight: result.profileWeights.cosmoWeight,
          },
        });
        return { ok: true };
      },

      completePhase2: (result) => {
        const s = get();
        if (result.comprehensionScore < PHASE2_PASS_THRESHOLD) {
          return {
            ok: false,
            reason: `comprehension_below_threshold (${result.comprehensionScore}/${PHASE2_PASS_THRESHOLD})`,
          };
        }

        const pl = appendQuarantinePl({
          principalId: s.principalId,
          domain: "agent_ops",
          comprehensionScore: result.comprehensionScore,
          passThreshold: PHASE2_PASS_THRESHOLD,
          hcd1Burden: result.hcd1Burden,
          hcd2Fidelity: result.hcd2Fidelity,
        });
        if (!pl.ok) {
          console.warn("[onboarding] Phase 2 PL refused:", pl.reason);
          return { ok: false, reason: pl.reason };
        }

        console.log(
          `[onboarding] Phase 2 complete. HCD-1=${result.hcd1Burden.toFixed(2)} HCD-2=${result.hcd2Fidelity.toFixed(2)} literacy=${result.comprehensionScore} PL+15 → score=${pl.snapshot.score}`,
        );
        console.log(
          "[onboarding] Would POST /api/v1/shaliah/quarantine-complete",
          { result, pl: pl.record },
        );
        set({
          phase2Complete: true,
          phase2Result: result,
          phase2Telemetry: result.telemetry,
          hcd1Burden: result.hcd1Burden,
          hcd2Fidelity: result.hcd2Fidelity,
          comprehensionScore: result.comprehensionScore,
          plSnapshot: pl.snapshot,
        });
        try {
          localStorage.setItem(
            "shaliah-onboarding-phase2-last",
            JSON.stringify({
              completedAt: new Date().toISOString(),
              result,
              pl: pl.record,
            }),
          );
        } catch {
          /* quota */
        }
        void bridgePromote({
          principalId: s.principalId,
          taskId: "quarantine-refusal-literacy",
          currentPl: Math.max(0, pl.snapshot.score - 15),
          taskPayload: {
            kind: "quarantine",
            correctHalts: result.comprehensionScore,
            hcd1Burden: result.hcd1Burden,
            hcd2Fidelity: result.hcd2Fidelity,
          },
        });
        return { ok: true };
      },

      completePhase3: (result) => {
        const s = get();
        if (result.gatesPassed < PHASE3_PASS_THRESHOLD) {
          return {
            ok: false,
            reason: `gates_below_threshold (${result.gatesPassed}/${PHASE3_PASS_THRESHOLD})`,
          };
        }
        const pl = appendArchonPl({
          principalId: s.principalId,
          domain: "agent_ops",
          gatesPassed: result.gatesPassed,
          passThreshold: PHASE3_PASS_THRESHOLD,
          telemetryCount: result.telemetry.length,
        });
        if (!pl.ok) {
          console.warn("[onboarding] Phase 3 PL refused:", pl.reason);
          return { ok: false, reason: pl.reason };
        }
        console.log(
          `[onboarding] Phase 3 MESHALEACH_VERIFIED. PL+25 → score=${pl.snapshot.score}`,
          result,
        );
        console.log(
          "[onboarding] Would POST /api/v1/shaliah/comprehension-gate",
          { result, pl: pl.record },
        );
        set({
          phase3Complete: true,
          phase3Result: result,
          phase3Telemetry: result.telemetry,
          meshaleachVerified: true,
          plSnapshot: pl.snapshot,
        });
        try {
          localStorage.setItem(
            "shaliah-onboarding-phase3-last",
            JSON.stringify({
              completedAt: new Date().toISOString(),
              result,
              pl: pl.record,
            }),
          );
        } catch {
          /* quota */
        }
        void bridgePromote({
          principalId: s.principalId,
          taskId: "archon-comprehension-gate",
          currentPl: Math.max(0, pl.snapshot.score - 25),
          taskPayload: {
            kind: "archon",
            gatesPassed: result.gatesPassed,
          },
        });
        return { ok: true };
      },

      resetPhase1: () =>
        set({
          phase1Telemetry: [],
          phase1Complete: false,
          twin: null,
          lastEventAt: 0,
          plSnapshot: null,
        }),

      resetPhase2: () =>
        set({
          phase2Telemetry: [],
          phase2Complete: false,
          phase2Result: null,
          hcd1Burden: 0.35,
          hcd2Fidelity: 0.55,
          comprehensionScore: 0,
        }),

      resetPhase3: () =>
        set({
          phase3Telemetry: [],
          phase3Complete: false,
          phase3Result: null,
          meshaleachVerified: false,
        }),

      setBoundWallet: (wallet) => set({ boundWallet: wallet }),

      exportTelemetryJson: () => {
        const st = get();
        return JSON.stringify(
          {
            principalId: st.principalId,
            phase1: {
              complete: st.phase1Complete,
              twin: st.twin,
              plSnapshot: st.plSnapshot,
              telemetry: st.phase1Telemetry,
            },
            phase2: {
              complete: st.phase2Complete,
              result: st.phase2Result,
              hcd1Burden: st.hcd1Burden,
              hcd2Fidelity: st.hcd2Fidelity,
              comprehensionScore: st.comprehensionScore,
              telemetry: st.phase2Telemetry,
            },
            phase3: {
              complete: st.phase3Complete,
              result: st.phase3Result,
              meshaleachVerified: st.meshaleachVerified,
              telemetry: st.phase3Telemetry,
            },
            boundWallet: st.boundWallet,
          },
          null,
          2,
        );
      },
    }),
    {
      name: "shaliah-onboarding-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        principalId: s.principalId,
        phase1Telemetry: s.phase1Telemetry,
        phase1Complete: s.phase1Complete,
        twin: s.twin,
        lastEventAt: s.lastEventAt,
        plSnapshot: s.plSnapshot,
        phase2Telemetry: s.phase2Telemetry,
        phase2Complete: s.phase2Complete,
        phase2Result: s.phase2Result,
        hcd1Burden: s.hcd1Burden,
        hcd2Fidelity: s.hcd2Fidelity,
        comprehensionScore: s.comprehensionScore,
        phase3Telemetry: s.phase3Telemetry,
        phase3Complete: s.phase3Complete,
        phase3Result: s.phase3Result,
        meshaleachVerified: s.meshaleachVerified,
        boundWallet: s.boundWallet,
      }),
    },
  ),
);

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Optimistic local PL already written — attempt server/Kafka promote.
 * Offline or failed verify keeps local cache (ACL live capital stays closed).
 */
async function bridgePromote(opts: {
  principalId: string;
  taskId:
    | "broken-genesis-repair"
    | "quarantine-refusal-literacy"
    | "archon-comprehension-gate";
  taskPayload: Record<string, unknown>;
  currentPl: number;
}): Promise<void> {
  try {
    const result = await promotePlToBridge({
      principalId: opts.principalId,
      domain: "agent_ops",
      taskId: opts.taskId,
      taskPayload: {
        ...opts.taskPayload,
        currentPl: opts.currentPl,
      },
    });
    markSynced(opts.principalId, opts.taskId, result.event.eventId);
    console.log(
      `[PL Bridge] Synced to ${result.status}. Verified by: ${result.event.verifiedBy}. totalPl=${result.event.totalPl}`,
    );
  } catch (err) {
    console.warn(
      `[PL Bridge] Offline or verification failed. Retaining local ledger only.`,
      err,
    );
  }
}
