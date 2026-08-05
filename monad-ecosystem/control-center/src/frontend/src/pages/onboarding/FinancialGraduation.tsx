/**
 * Financial Graduation UI — FG-1 → FG-2 → FG-3 gate batteries.
 * On each gate attempt: getFgMintOpts() → evaluate → EIP-191 MeshaleachPoC mint.
 */

import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { LayerHeader } from "@/components/LayerHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFgGraduation } from "@/hooks/useFgGraduation";
import {
  DEMO_FG1,
  DEMO_FG2,
  DEMO_FG3,
  FG1_LESSON_IDS,
  FG2_LESSON_IDS,
  FG3_LESSON_IDS,
  FG_LESSON_META,
  FG_R_DEFAULT,
  FG_R_MAX,
  FG_R_MIN,
  type Fg1Answers,
  type Fg2Answers,
  type Fg3Answers,
  type FgGateId,
} from "@/lib/fgBrowser";

type Tab = FgGateId;

function lessonIdsFor(gate: FgGateId): readonly string[] {
  if (gate === "fg1") return FG1_LESSON_IDS;
  if (gate === "fg2") return FG2_LESSON_IDS;
  return FG3_LESSON_IDS;
}

function gateUnlocked(
  state: string,
  gate: FgGateId,
): boolean {
  if (gate === "fg1") {
    return (
      state === "fg1_in_progress" ||
      state === "fg_locked" ||
      state === "fg1_passed" ||
      state === "fg2_in_progress" ||
      state === "fg2_passed" ||
      state === "fg3_in_progress" ||
      state === "fg3_passed"
    );
  }
  if (gate === "fg2") {
    return (
      state === "fg1_passed" ||
      state === "fg2_in_progress" ||
      state === "fg2_passed" ||
      state === "fg3_in_progress" ||
      state === "fg3_passed"
    );
  }
  return (
    state === "fg2_passed" ||
    state === "fg3_in_progress" ||
    state === "fg3_passed"
  );
}

function TextArea(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] text-emerald-600/90 font-mono tracking-wide">
        {props.label}
      </span>
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
        className="w-full bg-black/60 border border-emerald-950/80 rounded px-3 py-2 text-sm text-emerald-100 font-mono placeholder:text-gray-700 focus:outline-none focus:border-emerald-700 resize-y"
      />
    </label>
  );
}

export function FinancialGraduation() {
  const {
    session,
    busy,
    error,
    status,
    lastResult,
    lastSeal,
    fgMintReady,
    boundWallet,
    completeLessons,
    attemptGate,
    resetSession,
  } = useFgGraduation();

  const [tab, setTab] = useState<Tab>("fg1");
  const [fg1, setFg1] = useState<Fg1Answers>({ ...DEMO_FG1 });
  const [fg2, setFg2] = useState<Fg2Answers>({ ...DEMO_FG2 });
  const [fg3, setFg3] = useState<Fg3Answers>({ ...DEMO_FG3 });

  const activeLessons = lessonIdsFor(tab);
  const lessonsOk = activeLessons.every((id) =>
    session.completedLessons.includes(id),
  );
  const canAttempt = gateUnlocked(session.state, tab) && lessonsOk;

  const progressPct = useMemo(() => {
    const map: Record<string, number> = {
      fg_locked: 0,
      fg1_in_progress: 10,
      fg1_passed: 33,
      fg2_in_progress: 45,
      fg2_passed: 66,
      fg3_in_progress: 80,
      fg3_passed: 100,
    };
    return map[session.state] ?? 0;
  }, [session.state]);

  const onSubmit = async () => {
    if (tab === "fg1") await attemptGate("fg1", fg1);
    else if (tab === "fg2") await attemptGate("fg2", fg2);
    else await attemptGate("fg3", fg3);
  };

  const fillDemo = () => {
    if (tab === "fg1") setFg1({ ...DEMO_FG1 });
    else if (tab === "fg2") setFg2({ ...DEMO_FG2 });
    else setFg3({ ...DEMO_FG3 });
  };

  return (
    <div className="space-y-6" data-ocid="onboarding.financial-graduation">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <LayerHeader
          layer={0}
          title="Financial Graduation"
          description="FG-1 → FG-3 gate batteries with getFgMintOpts() → EIP-191 MeshaleachPoC on each pass."
        />
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" className="font-mono text-xs h-9" asChild>
            <Link to="/onboarding/live-activation">← Live Activation</Link>
          </Button>
          <Button
            variant="outline"
            className="font-mono text-xs h-9"
            onClick={resetSession}
            disabled={busy}
          >
            Reset session
          </Button>
        </div>
      </div>

      {/* Status strip */}
      <div className="grid gap-3 md:grid-cols-4 font-mono text-xs">
        <div className="border border-emerald-950/60 bg-black/40 rounded p-3">
          <div className="text-gray-500 mb-1">STATE</div>
          <div className="text-emerald-400">{session.state}</div>
        </div>
        <div className="border border-emerald-950/60 bg-black/40 rounded p-3">
          <div className="text-gray-500 mb-1">r / LOCK</div>
          <div className="text-emerald-400">
            {(session.r * 100).toFixed(0)}%{" "}
            <span className="text-gray-600">
              {session.rLocked ? "locked" : "sovereign"}
            </span>
          </div>
        </div>
        <div className="border border-emerald-950/60 bg-black/40 rounded p-3">
          <div className="text-gray-500 mb-1">SEALS</div>
          <div className="text-emerald-400">
            {session.meshaleachSeals.length} MeshaleachPoC
          </div>
        </div>
        <div className="border border-emerald-950/60 bg-black/40 rounded p-3">
          <div className="text-gray-500 mb-1">FgMintOpts</div>
          <div
            className={
              fgMintReady ? "text-emerald-400" : "text-amber-500"
            }
          >
            {fgMintReady
              ? `ready · ${boundWallet?.slice(0, 6)}…${boundWallet?.slice(-4)}`
              : "bind wallet first"}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-emerald-950/40 rounded overflow-hidden">
        <div
          className="h-full bg-emerald-600 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {!fgMintReady && (
        <div className="border border-amber-900/50 bg-amber-950/20 text-amber-200/90 text-sm font-mono p-4 rounded">
          Wallet not bound.{" "}
          <Link
            to="/onboarding/live-activation"
            className="underline text-amber-400"
          >
            Complete Live Activation
          </Link>{" "}
          so each gate can call{" "}
          <code className="text-amber-300">getFgMintOpts()</code> and mint
          EIP-191 seals.
        </div>
      )}

      {/* Gate tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["fg1", "fg2", "fg3"] as Tab[]).map((g) => {
          const unlocked = gateUnlocked(session.state, g);
          const passed =
            (g === "fg1" &&
              ["fg1_passed", "fg2_in_progress", "fg2_passed", "fg3_in_progress", "fg3_passed"].includes(
                session.state,
              )) ||
            (g === "fg2" &&
              ["fg2_passed", "fg3_in_progress", "fg3_passed"].includes(
                session.state,
              )) ||
            (g === "fg3" && session.state === "fg3_passed");
          return (
            <button
              key={g}
              type="button"
              disabled={!unlocked && g !== "fg1"}
              onClick={() => setTab(g)}
              className={`px-4 py-2 font-mono text-xs tracking-wider border rounded transition ${
                tab === g
                  ? "border-emerald-500 bg-emerald-950/40 text-emerald-300"
                  : unlocked
                    ? "border-emerald-950 text-gray-400 hover:border-emerald-800"
                    : "border-gray-900 text-gray-700 cursor-not-allowed"
              }`}
            >
              {g.toUpperCase()}
              {passed ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Lessons + form */}
        <div className="lg:col-span-3 space-y-4 border border-emerald-950/50 rounded-lg bg-black/50 p-5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-mono text-sm text-emerald-400 tracking-widest">
              {tab.toUpperCase()} LESSONS
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-[10px] h-8"
              onClick={() => completeLessons(tab)}
              disabled={lessonsOk || !gateUnlocked(session.state, tab)}
            >
              {lessonsOk ? "Lessons complete" : "Mark lessons complete"}
            </Button>
          </div>
          <ul className="space-y-1.5 text-xs font-mono">
            {activeLessons.map((id) => {
              const done = session.completedLessons.includes(id);
              const meta = FG_LESSON_META[id];
              return (
                <li
                  key={id}
                  className={`flex gap-2 ${done ? "text-emerald-500" : "text-gray-500"}`}
                >
                  <span className="w-4">{done ? "●" : "○"}</span>
                  <span className="text-gray-600 w-10">{id}</span>
                  <span>{meta?.title ?? id}</span>
                </li>
              );
            })}
          </ul>

          <div className="border-t border-emerald-950/40 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-sm text-emerald-400 tracking-widest">
                GATE BATTERY
              </h3>
              <button
                type="button"
                onClick={fillDemo}
                className="text-[10px] font-mono text-gray-600 hover:text-emerald-600"
              >
                fill demo answers
              </button>
            </div>

            {tab === "fg1" && (
              <div className="space-y-3">
                <TextArea
                  label="T1 · Safer structure + two risks"
                  value={fg1.defiRisk}
                  onChange={(v) => setFg1((a) => ({ ...a, defiRisk: v }))}
                />
                <TextArea
                  label="T2 · Time preference / compounding"
                  value={fg1.timePreference}
                  onChange={(v) => setFg1((a) => ({ ...a, timePreference: v }))}
                />
                <TextArea
                  label="T3 · Real-economy transfer"
                  value={fg1.realEconomy}
                  onChange={(v) => setFg1((a) => ({ ...a, realEconomy: v }))}
                />
                <TextArea
                  label="E1 · Claim vs pool"
                  value={fg1.claimExplain}
                  onChange={(v) => setFg1((a) => ({ ...a, claimExplain: v }))}
                />
              </div>
            )}

            {tab === "fg2" && (
              <div className="space-y-3">
                <TextArea
                  label="T1 · Channel allocation of G"
                  value={fg2.channelAlloc}
                  onChange={(v) => setFg2((a) => ({ ...a, channelAlloc: v }))}
                />
                <TextArea
                  label="T2 · Drawdown response"
                  value={fg2.drawdown}
                  onChange={(v) => setFg2((a) => ({ ...a, drawdown: v }))}
                />
                <label className="block space-y-1.5">
                  <span className="text-[11px] text-emerald-600/90 font-mono">
                    T3 · High-risk action
                  </span>
                  <select
                    value={fg2.highRiskAction}
                    onChange={(e) =>
                      setFg2((a) => ({
                        ...a,
                        highRiskAction: e.target.value as Fg2Answers["highRiskAction"],
                      }))
                    }
                    className="w-full bg-black/60 border border-emerald-950/80 rounded px-3 py-2 text-sm text-emerald-100 font-mono"
                  >
                    <option value="confirm">confirm</option>
                    <option value="refuse">refuse</option>
                    <option value="autopilot">autopilot (fail)</option>
                  </select>
                </label>
                <TextArea
                  label="T3 · High-risk reason"
                  value={fg2.highRiskReason}
                  onChange={(v) => setFg2((a) => ({ ...a, highRiskReason: v }))}
                  rows={2}
                />
                <TextArea
                  label="T4 · Liquidity mode"
                  value={fg2.liquidityChoice}
                  onChange={(v) => setFg2((a) => ({ ...a, liquidityChoice: v }))}
                />
                <TextArea
                  label="E1 · Stewardship"
                  value={fg2.stewardshipExplain}
                  onChange={(v) =>
                    setFg2((a) => ({ ...a, stewardshipExplain: v }))
                  }
                />
              </div>
            )}

            {tab === "fg3" && (
              <div className="space-y-3">
                <TextArea
                  label="T1 · Rate predictions 5% / 20% / 30%"
                  value={fg3.ratePredictions}
                  onChange={(v) =>
                    setFg3((a) => ({ ...a, ratePredictions: v }))
                  }
                />
                <TextArea
                  label="T2 · Floor / ceiling defense"
                  value={fg3.boundsDefense}
                  onChange={(v) => setFg3((a) => ({ ...a, boundsDefense: v }))}
                />
                <label className="block space-y-1.5">
                  <span className="text-[11px] text-emerald-600/90 font-mono">
                    T3 · Chosen r [{FG_R_MIN}–{FG_R_MAX}] (default{" "}
                    {FG_R_DEFAULT})
                  </span>
                  <input
                    type="number"
                    min={FG_R_MIN}
                    max={FG_R_MAX}
                    step={0.01}
                    value={fg3.chosenR}
                    onChange={(e) =>
                      setFg3((a) => ({
                        ...a,
                        chosenR: Number(e.target.value),
                      }))
                    }
                    className="w-full bg-black/60 border border-emerald-950/80 rounded px-3 py-2 text-sm text-emerald-100 font-mono"
                  />
                </label>
                <TextArea
                  label="T3 · Why this r"
                  value={fg3.chosenRReason}
                  onChange={(v) => setFg3((a) => ({ ...a, chosenRReason: v }))}
                  rows={2}
                />
                <label className="block space-y-1.5">
                  <span className="text-[11px] text-emerald-600/90 font-mono">
                    T4 · Seasonal escalate
                  </span>
                  <select
                    value={fg3.escalate}
                    onChange={(e) =>
                      setFg3((a) => ({
                        ...a,
                        escalate: e.target.value as "accept" | "refuse",
                      }))
                    }
                    className="w-full bg-black/60 border border-emerald-950/80 rounded px-3 py-2 text-sm text-emerald-100 font-mono"
                  >
                    <option value="accept">accept</option>
                    <option value="refuse">refuse</option>
                  </select>
                </label>
                <TextArea
                  label="T4 · Escalate reason"
                  value={fg3.escalateReason}
                  onChange={(v) => setFg3((a) => ({ ...a, escalateReason: v }))}
                  rows={2}
                />
                <TextArea
                  label="E1 · Covenant (I set r…)"
                  value={fg3.covenantStatement}
                  onChange={(v) =>
                    setFg3((a) => ({ ...a, covenantStatement: v }))
                  }
                />
              </div>
            )}

            <button
              type="button"
              onClick={onSubmit}
              disabled={busy || !canAttempt || !fgMintReady}
              className="w-full mt-2 px-6 py-3 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition disabled:opacity-40 font-mono text-xs tracking-wider"
            >
              {busy
                ? "getFgMintOpts → EVALUATING / SIGNING…"
                : `ATTEMPT ${tab.toUpperCase()} · getFgMintOpts() + MINT`}
            </button>
            {!lessonsOk && (
              <p className="text-[10px] text-gray-600 font-mono text-center">
                Mark lessons complete before the gate battery.
              </p>
            )}
          </div>
        </div>

        {/* Side panel: result + seals + unlocks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-emerald-950/50 rounded-lg bg-black/50 p-5 space-y-3">
            <h3 className="font-mono text-sm text-emerald-400 tracking-widest">
              LIVE STATUS
            </h3>
            {status && (
              <p className="text-xs font-mono text-emerald-300/90 leading-relaxed">
                {status}
              </p>
            )}
            {error && (
              <p className="text-xs font-mono text-red-400 leading-relaxed">
                {error}
              </p>
            )}
            {!status && !error && (
              <p className="text-xs font-mono text-gray-600">
                Idle. Each gate calls{" "}
                <span className="text-emerald-700">
                  useFgMintOpts().getFgMintOpts()
                </span>{" "}
                then mints on pass.
              </p>
            )}

            {lastResult && (
              <div className="border-t border-emerald-950/40 pt-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] ${
                      lastResult.passed
                        ? "border-emerald-700 text-emerald-300"
                        : "border-red-800 text-red-400"
                    }`}
                  >
                    {lastResult.gate.toUpperCase()}{" "}
                    {lastResult.passed ? "PASS" : "FAIL"}
                  </Badge>
                  <span className="text-[10px] text-gray-600 font-mono">
                    {lastResult.domainTag}
                  </span>
                </div>
                <ul className="space-y-1">
                  {lastResult.items.map((it) => (
                    <li
                      key={it.itemId}
                      className={`text-[11px] font-mono ${
                        it.passed ? "text-emerald-600" : "text-red-400/90"
                      }`}
                    >
                      {it.passed ? "✓" : "✗"} {it.itemId}
                      {!it.passed && (
                        <span className="text-gray-600"> — {it.feedback}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="border border-emerald-950/50 rounded-lg bg-black/50 p-5 space-y-3">
            <h3 className="font-mono text-sm text-emerald-400 tracking-widest">
              UNLOCKS
            </h3>
            <ul className="text-[11px] font-mono space-y-1.5 text-gray-500">
              <li className={session.unlocked.claimStatement ? "text-emerald-500" : ""}>
                {session.unlocked.claimStatement ? "●" : "○"} claim statement
              </li>
              <li className={session.unlocked.safeDeployMenu ? "text-emerald-500" : ""}>
                {session.unlocked.safeDeployMenu ? "●" : "○"} safe deploy menu
              </li>
              <li className={session.unlocked.highRiskConfirm ? "text-emerald-500" : ""}>
                {session.unlocked.highRiskConfirm ? "●" : "○"} high-risk confirm
              </li>
              <li className={session.unlocked.rateSovereignty ? "text-emerald-500" : ""}>
                {session.unlocked.rateSovereignty ? "●" : "○"} rate sovereignty
              </li>
            </ul>
            {session.unlocked.domainTags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {session.unlocked.domainTags.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="font-mono text-[9px] border-emerald-900 text-emerald-600"
                  >
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="border border-emerald-950/50 rounded-lg bg-black/50 p-5 space-y-3">
            <h3 className="font-mono text-sm text-emerald-400 tracking-widest">
              MESHALEACH SEALS
            </h3>
            {session.meshaleachSeals.length === 0 && (
              <p className="text-[11px] font-mono text-gray-600">
                No seals yet. Pass a gate with bound wallet to mint.
              </p>
            )}
            {session.meshaleachSeals.map((poc, i) => (
              <div
                key={`${poc.gate}-${poc.issued_at}-${i}`}
                className="border border-emerald-900/40 rounded p-3 space-y-1 text-[10px] font-mono"
              >
                <div className="flex justify-between text-emerald-400">
                  <span>{poc.gate.toUpperCase()}</span>
                  <span>{poc.proof.system}</span>
                </div>
                <div className="text-gray-500 break-all">
                  {poc.domain_tag}
                </div>
                <div className="text-gray-600 break-all">
                  sig {poc.signature.slice(0, 18)}…
                </div>
                {poc.principal_commitment && (
                  <div className="text-gray-700 break-all">
                    commit {poc.principal_commitment.slice(0, 22)}…
                  </div>
                )}
              </div>
            ))}
            {lastSeal && (
              <p className="text-[10px] text-emerald-700/80 font-mono">
                Latest mint at {lastSeal.issued_at}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-700 font-mono leading-relaxed max-w-3xl">
        Flow: Live Activation binds wallet → this page calls{" "}
        <code className="text-gray-500">getFgMintOpts()</code> per gate → browser
        evaluates battery → on pass MetaMask signs EIP-191 MeshaleachPoC
        (merkle-sd). Server path with issuer custody / Groth16 remains in{" "}
        <code className="text-gray-500">@sovereign/shaliah-onboarding</code>.
      </p>
    </div>
  );
}

export default function FinancialGraduationPage() {
  return (
    <Layout>
      <FinancialGraduation />
    </Layout>
  );
}
