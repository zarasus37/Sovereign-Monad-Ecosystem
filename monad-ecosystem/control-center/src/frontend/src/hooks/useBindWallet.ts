/**
 * Wallet binding — EIP-191 personal_sign → POST /api/v1/gate-acl/bind-wallet
 */

import { useCallback, useState } from "react";
import { useShaliahOnboarding } from "@/hooks/useShaliahOnboarding";

type EthereumProvider = {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  request: (args: {
    method: string;
    params?: unknown[];
  }) => Promise<unknown>;
  providers?: EthereumProvider[];
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
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

/** Prefer MetaMask when several wallets inject into window.ethereum. */
function resolveEthereum(): EthereumProvider | null {
  const eth = window.ethereum;
  if (!eth) return null;
  const list = eth.providers?.length ? eth.providers : [eth];
  const metaMask = list.find((p) => p.isMetaMask && !p.isCoinbaseWallet);
  return metaMask || list[0] || eth;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () =>
        reject(
          new Error(
            `${label} timed out after ${Math.round(ms / 1000)}s. ` +
              "Open the MetaMask extension (fox icon), unlock it, and check for a pending Connect/Sign request. " +
              "If nothing is pending, refresh the page and try again.",
          ),
        ),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

export function useBindWallet() {
  const [isBinding, setIsBinding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const localPrincipalId = useShaliahOnboarding((s) => s.principalId);
  const currentPl = useShaliahOnboarding((s) => s.plSnapshot?.score ?? 0);
  const setBoundWallet = useShaliahOnboarding((s) => s.setBoundWallet);

  const bindWallet = useCallback(async (): Promise<string | null> => {
    const provider = resolveEthereum();
    if (!provider) {
      setError(
        "No wallet found. Install MetaMask (Chrome/Edge/Firefox extension), unlock it, then refresh this page.",
      );
      setStatusHint(null);
      return null;
    }

    setIsBinding(true);
    setError(null);
    setStatusHint(
      "Check MetaMask (fox icon in the toolbar). Unlock if needed, then Approve Connect.",
    );

    try {
      // Some builds need a nudge so the extension UI surfaces.
      try {
        await provider.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      } catch {
        /* fall through to eth_requestAccounts — not all providers support this */
      }

      setStatusHint("Waiting for MetaMask: Connect account…");
      const accounts = (await withTimeout(
        provider.request({ method: "eth_requestAccounts" }),
        90_000,
        "Connect account",
      )) as string[];
      const walletAddress = accounts[0];
      if (!walletAddress) throw new Error("No account returned from wallet");

      const timestamp = Date.now();
      const message = buildBindMessage({
        localPrincipalId,
        walletAddress,
        pl: currentPl,
        timestamp,
      });

      setStatusHint(
        "Waiting for MetaMask: Sign the bind message (this is free — not a transaction).",
      );
      // MetaMask expects address checksum-normalized or lowercased; lower is safest.
      const signature = (await withTimeout(
        provider.request({
          method: "personal_sign",
          params: [message, walletAddress.toLowerCase()],
        }),
        90_000,
        "Sign message",
      )) as string;

      setStatusHint("Verifying signature with sovereign-host…");
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
      setStatusHint(null);
      console.log(`[Wallet Bind] ${data.status} → ${data.walletAddress}`);
      return data.walletAddress;
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Binding failed";
      // MetaMask user rejection codes
      const msg =
        /user rejected|denied|4001/i.test(raw)
          ? "You rejected the request in MetaMask. Click BIND again and Approve/Sign."
          : raw;
      setError(msg);
      setStatusHint(null);
      return null;
    } finally {
      setIsBinding(false);
    }
  }, [localPrincipalId, currentPl, setBoundWallet]);

  return {
    bindWallet,
    isBinding,
    error,
    statusHint,
    localPrincipalId,
    currentPl,
  };
}
