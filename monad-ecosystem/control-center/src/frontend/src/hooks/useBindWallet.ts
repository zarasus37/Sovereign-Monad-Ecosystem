/**
 * Wallet binding — EIP-191 personal_sign → POST /api/v1/gate-acl/bind-wallet
 */

import { useCallback, useState } from "react";
import { useShaliahOnboarding } from "@/hooks/useShaliahOnboarding";

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    };
  }
}

const BIND_PREFIX = "Sovereign Monad Ecosystem Bind";

export function buildBindMessage(opts: {
  localPrincipalId: string;
  walletAddress: string;
  pl: number;
  timestamp: number;
}): string {
  return [
    BIND_PREFIX,
    `Local ID: ${opts.localPrincipalId}`,
    `Wallet: ${opts.walletAddress}`,
    `PL: ${opts.pl}`,
    `Timestamp: ${opts.timestamp}`,
  ].join("\n");
}

function bridgeBaseUrl(): string {
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string> }).env
      : undefined;
  return (
    env?.VITE_GATE_ACL_URL?.replace(/\/$/, "") ||
    env?.VITE_API_BASE?.replace(/\/$/, "") ||
    ""
  );
}

export function useBindWallet() {
  const [isBinding, setIsBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localPrincipalId = useShaliahOnboarding((s) => s.principalId);
  const currentPl = useShaliahOnboarding((s) => s.plSnapshot?.score ?? 0);
  const setBoundWallet = useShaliahOnboarding((s) => s.setBoundWallet);

  const bindWallet = useCallback(async (): Promise<string | null> => {
    if (!window.ethereum) {
      setError("No wallet provider found (install MetaMask or compatible).");
      return null;
    }
    setIsBinding(true);
    setError(null);

    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("No account returned");

      const timestamp = Date.now();
      const message = buildBindMessage({
        localPrincipalId,
        walletAddress,
        pl: currentPl,
        timestamp,
      });

      const signature = (await window.ethereum.request({
        method: "personal_sign",
        params: [message, walletAddress],
      })) as string;

      const url = `${bridgeBaseUrl()}/api/v1/gate-acl/bind-wallet`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localPrincipalId,
          walletAddress,
          signature,
          message,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(
          (err as { message?: string; error?: string }).message ||
            (err as { error?: string }).error ||
            "Backend verification failed",
        );
      }

      const data = (await response.json()) as {
        walletAddress: string;
        status: string;
      };
      setBoundWallet(data.walletAddress);
      console.log(`[Wallet Bind] ${data.status} → ${data.walletAddress}`);
      return data.walletAddress;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Binding failed";
      setError(msg);
      return null;
    } finally {
      setIsBinding(false);
    }
  }, [localPrincipalId, currentPl, setBoundWallet]);

  return { bindWallet, isBinding, error, localPrincipalId, currentPl };
}
