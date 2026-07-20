/**
 * Live Activation Gate — wallet bind after Meshaleach verification.
 * Cryptographic principal replaces local UUID before Cardia funding.
 */

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { LayerHeader } from "@/components/LayerHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBindWallet } from "@/hooks/useBindWallet";
import { useShaliahOnboarding } from "@/hooks/useShaliahOnboarding";

export function LiveActivationGate() {
  const { bindWallet, isBinding, error, currentPl } = useBindWallet();
  const meshaleachVerified = useShaliahOnboarding((s) => s.meshaleachVerified);
  const phase3Complete = useShaliahOnboarding((s) => s.phase3Complete);
  const boundWalletFromStore = useShaliahOnboarding((s) => s.boundWallet);
  const [boundWallet, setBoundWallet] = useState<string | null>(
    boundWalletFromStore,
  );

  const ready = meshaleachVerified || phase3Complete;
  const plOk = currentPl >= 50;

  const handleActivate = async () => {
    const wallet = await bindWallet();
    if (wallet) setBoundWallet(wallet);
  };

  return (
    <div className="space-y-6" data-ocid="onboarding.live-activation">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <LayerHeader
          layer={0}
          title="Live Activation Gate"
          description="Bind a cryptographic wallet to your cognitive profile before Cardia capital."
        />
        <Button variant="outline" className="font-mono text-xs h-9" asChild>
          <Link to="/onboarding/archon-gate">← Archon Gate</Link>
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[50vh] bg-black text-emerald-400 font-mono p-8 border border-emerald-950/50 rounded-lg">
        <h2 className="text-2xl mb-4 tracking-widest">LIVE ACTIVATION GATE</h2>

        {!ready && (
          <p className="text-sm text-amber-500/90 mb-6 text-center max-w-md">
            Complete Phase 3 Archon Interrogation (Meshaleach) before wallet
            bind.
          </p>
        )}

        {!boundWallet ? (
          <>
            <p className="text-sm text-gray-500 mb-2 text-center">
              Archon Gate {ready ? "passed" : "pending"}. Local PL:{" "}
              <span className="text-emerald-300">{currentPl}</span>
              {plOk ? " (≥ 50)" : " — need ≥ 50"}.
            </p>
            <p className="text-sm text-gray-500 mb-8 text-center max-w-lg">
              To deploy live capital, bind your wallet to your cognitive
              profile. Signature is EIP-191; server verifies PL and recovers
              address before Kafka.
            </p>
            <button
              type="button"
              onClick={handleActivate}
              disabled={isBinding || !ready || !plOk}
              className="px-8 py-3 bg-emerald-600 text-white rounded hover:bg-emerald-500 transition disabled:opacity-50 font-mono text-xs tracking-wider"
            >
              {isBinding
                ? "AWAITING SIGNATURE…"
                : "BIND WALLET & ACTIVATE CAPITAL"}
            </button>
            {error && (
              <p className="mt-4 text-red-500 text-sm text-center max-w-md">
                {error}
              </p>
            )}
            {!plOk && ready && (
              <p className="mt-4 text-xs text-gray-600">
                Promote PL via the Kafka bridge (or complete all three phases
                with local ledger) so server score ≥ 50.
              </p>
            )}
          </>
        ) : (
          <div className="text-center border border-emerald-900 p-8 bg-emerald-950/20 max-w-lg">
            <p className="text-xl text-emerald-500 mb-2">WALLET BOUND</p>
            <p className="text-sm text-gray-400 mb-4 break-all">{boundWallet}</p>
            <Badge
              variant="outline"
              className="font-mono text-[10px] border-emerald-700 text-emerald-300 mb-4"
            >
              principalId = wallet · TIER_1_MESHALEACH
            </Badge>
            <p className="text-xs text-emerald-300 animate-pulse">
              CARDIA ORGAN NOTIFIED. $15,000 MANDATE ELIGIBLE.
            </p>
            <p className="text-[10px] text-gray-600 mt-4">
              taskId: wallet-bind-tier1-activation · funding engine is next
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveActivationGatePage() {
  return (
    <Layout>
      <LiveActivationGate />
    </Layout>
  );
}
