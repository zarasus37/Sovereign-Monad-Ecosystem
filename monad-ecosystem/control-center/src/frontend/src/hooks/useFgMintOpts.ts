/**
 * After wallet-bind, expose FgMintOpts built from the user's MetaMask signer.
 * Pass into shaliah-onboarding attemptFg*Gate(..., mintOpts).
 */

import { useCallback, useState } from "react";
import {
  resolveFgMintOpts,
  type FgMintOptsBrowser,
} from "@/lib/fgMintBridge";
import { useShaliahOnboarding } from "@/hooks/useShaliahOnboarding";

export function useFgMintOpts() {
  const fgMintReady = useShaliahOnboarding((s) => s.fgMintReady);
  const boundWallet = useShaliahOnboarding((s) => s.boundWallet);
  const [error, setError] = useState<string | null>(null);
  const [lastOpts, setLastOpts] = useState<FgMintOptsBrowser | null>(null);

  const getFgMintOpts = useCallback(
    async (flags?: {
      withMerkleDisclosure?: boolean;
      withSnark?: boolean;
    }): Promise<FgMintOptsBrowser | null> => {
      setError(null);
      if (!fgMintReady && !boundWallet) {
        setError("Bind wallet first (Live Activation Gate) before FG mint.");
        return null;
      }
      try {
        const opts = await resolveFgMintOpts(flags);
        if (!opts) {
          setError("No browser wallet / signer available.");
          return null;
        }
        if (
          boundWallet &&
          opts.walletAddress.toLowerCase() !== boundWallet.toLowerCase()
        ) {
          setError(
            `Active wallet ${opts.walletAddress} ≠ bound principal ${boundWallet}`,
          );
          return null;
        }
        setLastOpts(opts);
        return opts;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to resolve FgMintOpts");
        return null;
      }
    },
    [fgMintReady, boundWallet],
  );

  return {
    fgMintReady: fgMintReady || Boolean(boundWallet),
    boundWallet,
    getFgMintOpts,
    lastOpts,
    error,
  };
}
