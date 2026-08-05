/**
 * Browser bridge: MetaMask / injected wallet → ethers Signer for FgMintOpts.
 * Used after wallet-bind so FG gates can mint EIP-191 MeshaleachPoC with the user key.
 */

import { BrowserProvider, type Signer } from "ethers";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  providers?: EthereumProvider[];
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
};

function resolveEthereum(): EthereumProvider | null {
  const w = window as Window & { ethereum?: EthereumProvider };
  const eth = w.ethereum;
  if (!eth) return null;
  const list = eth.providers?.length ? eth.providers : [eth];
  const metaMask = list.find((p) => p.isMetaMask && !p.isCoinbaseWallet);
  return metaMask || list[0] || eth;
}

export type BrowserFgMintHandle = {
  signer: Signer;
  walletAddress: string;
};

/**
 * Build FgMintOpts-compatible handle from the injected wallet.
 * Caller should have already connected (eth_requestAccounts).
 */
export async function getBrowserFgMintHandle(): Promise<BrowserFgMintHandle | null> {
  const eth = resolveEthereum();
  if (!eth) return null;
  const provider = new BrowserProvider(eth as never);
  const signer = await provider.getSigner();
  const walletAddress = await signer.getAddress();
  return { signer, walletAddress };
}

/** Shape compatible with @sovereign/shaliah-onboarding FgMintOpts (signer + flags). */
export type FgMintOptsBrowser = {
  signer: Signer;
  walletAddress: string;
  withMerkleDisclosure: boolean;
  withSnark: boolean;
  useIssuerCustody: boolean;
};

export async function resolveFgMintOpts(opts?: {
  withMerkleDisclosure?: boolean;
  withSnark?: boolean;
}): Promise<FgMintOptsBrowser | null> {
  const handle = await getBrowserFgMintHandle();
  if (!handle) return null;
  return {
    signer: handle.signer,
    walletAddress: handle.walletAddress,
    withMerkleDisclosure: opts?.withMerkleDisclosure ?? true,
    // Browser SNARK prove is heavy; default off — enable when wasm loaded
    withSnark: opts?.withSnark ?? false,
    useIssuerCustody: false,
  };
}
