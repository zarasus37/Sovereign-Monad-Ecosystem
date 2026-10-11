/**
 * Capital Mandate signer — Shaliah grants bounded agency to MEV engine (Vector 5.3).
 */

import type { CapitalMandate } from '@sovereign/types';
import { loopUsdToBaseUnits, LOOP_STABLE_DECIMALS } from '@sovereign/types';
import { mandateDomain, MANDATE_TYPES, toMandateTypedValue } from './eip712Mandate.js';

export type MandateSignerWallet = {
  address: string;
  signTypedData: (
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>,
  ) => Promise<string>;
};

export type SignCapitalMandateOpts = {
  engineOperator: string;
  /** USD notional allocated (converted to base units). */
  amountAllocatedUsd: number;
  /** Agency lifetime in seconds (default 24h). */
  ttlSeconds?: number;
  mandateId?: string;
  chainId?: number;
  /** Override clock (tests). */
  nowSec?: number;
  decimals?: number;
};

/**
 * Sign an EIP-712 CapitalMandate with the Shaliah principal wallet.
 */
export async function signCapitalMandate(
  signer: MandateSignerWallet,
  opts: SignCapitalMandateOpts,
): Promise<CapitalMandate> {
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const ttl = opts.ttlSeconds ?? 60 * 60 * 24;
  const decimals = opts.decimals ?? LOOP_STABLE_DECIMALS;
  const amountAllocated = loopUsdToBaseUnits(opts.amountAllocatedUsd, decimals);
  const chainId = opts.chainId;
  const domain = mandateDomain(chainId);

  const fields = {
    mandateId: opts.mandateId ?? `mandate-${now}`,
    principalWallet: signer.address,
    engineOperator: opts.engineOperator,
    amountAllocated,
    expiration: now + ttl,
  };

  const typed = toMandateTypedValue(fields);
  const signature = await signer.signTypedData(
    domain,
    MANDATE_TYPES as unknown as Record<
      string,
      Array<{ name: string; type: string }>
    >,
    typed as unknown as Record<string, unknown>,
  );

  return {
    ...fields,
    signature,
    chainId: domain.chainId,
  };
}

/**
 * Convenience: build ethers Wallet from private key and sign.
 */
export async function signCapitalMandateWithPrivateKey(
  privateKey: string,
  opts: SignCapitalMandateOpts,
): Promise<CapitalMandate> {
  const { ethers } = await import('ethers');
  const wallet = new ethers.Wallet(privateKey);
  return signCapitalMandate(wallet, opts);
}
