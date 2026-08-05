/**
 * Financial Graduation session state + getFgMintOpts on each gate attempt.
 */

import { useCallback, useState } from "react";
import { useFgMintOpts } from "@/hooks/useFgMintOpts";
import { useShaliahOnboarding } from "@/hooks/useShaliahOnboarding";
import {
  attemptGateWithMint,
  markLessonsComplete,
  startFgBrowserSession,
  type Fg1Answers,
  type Fg2Answers,
  type Fg3Answers,
  type FgBrowserSession,
  type FgGateId,
  type GateBatteryResult,
} from "@/lib/fgBrowser";
import type { MeshaleachPoC } from "@sovereign/types";

export function useFgGraduation() {
  const principalId = useShaliahOnboarding((s) => s.principalId);
  const boundWallet = useShaliahOnboarding((s) => s.boundWallet);
  const {
    fgMintReady,
    getFgMintOpts,
    error: mintOptsError,
    lastOpts,
  } = useFgMintOpts();

  const [session, setSession] = useState<FgBrowserSession>(() =>
    startFgBrowserSession(boundWallet ?? principalId),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<GateBatteryResult | null>(null);
  const [lastSeal, setLastSeal] = useState<MeshaleachPoC | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const resetSession = useCallback(() => {
    setSession(startFgBrowserSession(boundWallet ?? principalId));
    setLastResult(null);
    setLastSeal(null);
    setError(null);
    setStatus(null);
  }, [boundWallet, principalId]);

  const completeLessons = useCallback((gate: FgGateId) => {
    setSession((s) => markLessonsComplete(s, gate));
    setStatus(`${gate.toUpperCase()} lessons marked complete — gate battery unlocked`);
  }, []);

  /**
   * Resolve FgMintOpts from the bound wallet, then evaluate gate + mint on pass.
   * This is the production UI path for each FG gate.
   */
  const attemptGate = useCallback(
    async (
      gate: FgGateId,
      answers: Fg1Answers | Fg2Answers | Fg3Answers,
      flags?: { withMerkleDisclosure?: boolean; withSnark?: boolean },
    ) => {
      setBusy(true);
      setError(null);
      setStatus(null);
      setLastSeal(null);
      try {
        setStatus("Resolving FgMintOpts from bound wallet…");
        const mintOpts = await getFgMintOpts({
          withMerkleDisclosure: flags?.withMerkleDisclosure ?? true,
          withSnark: flags?.withSnark ?? false,
        });
        if (!mintOpts) {
          setError(
            mintOptsError ??
              "Bind wallet at Live Activation before FG mint (getFgMintOpts returned null).",
          );
          setStatus(null);
          return null;
        }
        setStatus(
          `FgMintOpts ready (${mintOpts.walletAddress.slice(0, 6)}…${mintOpts.walletAddress.slice(-4)}) — evaluating ${gate.toUpperCase()}…`,
        );

        // Keep principal aligned with wallet when bound
        const principal =
          boundWallet ?? mintOpts.walletAddress ?? session.principalId;
        const base =
          session.principalId === principal
            ? session
            : { ...session, principalId: principal };

        const out = await attemptGateWithMint(base, gate, answers, mintOpts);
        setSession(out.session);
        setLastResult(out.result);

        if (!out.result.passed) {
          setStatus(`${gate.toUpperCase()} failed — review feedback and retry`);
          setError(out.result.failures.join("; ") || "Gate battery failed");
          return out;
        }

        if (out.seal) {
          setLastSeal(out.seal);
          setStatus(
            `${gate.toUpperCase()} passed · MeshaleachPoC minted (${out.seal.proof.system}) · MetaMask signed EIP-191`,
          );
        } else if (out.mintError) {
          setStatus(`${gate.toUpperCase()} passed but mint incomplete`);
          setError(out.mintError);
        } else {
          setStatus(`${gate.toUpperCase()} passed`);
        }
        return out;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Gate attempt failed";
        setError(msg);
        setStatus(null);
        return null;
      } finally {
        setBusy(false);
      }
    },
    [boundWallet, getFgMintOpts, mintOptsError, session],
  );

  return {
    session,
    busy,
    error: error ?? mintOptsError,
    status,
    lastResult,
    lastSeal,
    lastOpts,
    fgMintReady,
    boundWallet,
    completeLessons,
    attemptGate,
    resetSession,
  };
}
