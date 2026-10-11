/**
 * Capital Mandate verifier — MEV engine side (Vector 5.3).
 * Fail-closed on expiry, over-allocation, or invalid EIP-712 signature.
 */

import type { CapitalMandate, MandateVerifyResult } from '@sovereign/types';
import { loopUsdToBaseUnits, LOOP_STABLE_DECIMALS } from '@sovereign/types';
import {
  mandateDomain,
  MANDATE_TYPES,
  toMandateTypedValue,
} from './eip712Mandate.js';

export type VerifyMandateOpts = {
  proposedTradeUsd: number;
  /** Optional: must match mandate.engineOperator. */
  engineOperator?: string;
  nowSec?: number;
  decimals?: number;
  chainId?: number;
};

/**
 * Full verification with reason codes for auditTrace.
 */
export function verifyCapitalMandateDetailed(
  mandate: CapitalMandate,
  opts: VerifyMandateOpts,
): MandateVerifyResult {
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const decimals = opts.decimals ?? LOOP_STABLE_DECIMALS;

  if (!mandate?.signature || !mandate.principalWallet) {
    return { valid: false, reason: 'MANDATE_MALFORMED' };
  }

  if (now > mandate.expiration) {
    console.warn(
      `[Mandate Verifier] Mandate ${mandate.mandateId} EXPIRED at ${mandate.expiration} (now=${now}).`,
    );
    return { valid: false, reason: 'MANDATE_EXPIRED' };
  }

  if (
    opts.engineOperator &&
    mandate.engineOperator.toLowerCase() !== opts.engineOperator.toLowerCase()
  ) {
    return { valid: false, reason: 'ENGINE_OPERATOR_MISMATCH' };
  }

  const proposedBase = loopUsdToBaseUnits(opts.proposedTradeUsd, decimals);
  if (proposedBase > mandate.amountAllocated) {
    console.warn(
      `[Mandate Verifier] Trade size exceeds mandate allocation (${proposedBase} > ${mandate.amountAllocated}).`,
    );
    return { valid: false, reason: 'EXCEEDS_MANDATE_ALLOCATION' };
  }

  // Signature verification is async-friendly via sync ethers API
  return { valid: true, reason: 'OK_PENDING_SIG' };
}

/**
 * Verify EIP-712 signature recovers principalWallet.
 * Uses dynamic ethers import so pure unit tests can inject verifyFn.
 */
export async function verifyCapitalMandateSignature(
  mandate: CapitalMandate,
  opts?: { chainId?: number; verifyTypedData?: typeof import('ethers').verifyTypedData },
): Promise<MandateVerifyResult> {
  try {
    const domain = mandateDomain(opts?.chainId ?? mandate.chainId);
    const value = toMandateTypedValue(mandate);

    let recovered: string;
    if (opts?.verifyTypedData) {
      recovered = opts.verifyTypedData(
        domain,
        MANDATE_TYPES as unknown as Record<
          string,
          Array<{ name: string; type: string }>
        >,
        value as unknown as Record<string, unknown>,
        mandate.signature,
      );
    } else {
      const { ethers } = await import('ethers');
      recovered = ethers.verifyTypedData(
        domain,
        MANDATE_TYPES as unknown as Record<
          string,
          Array<{ name: string; type: string }>
        >,
        value as unknown as Record<string, unknown>,
        mandate.signature,
      );
    }

    if (recovered.toLowerCase() !== mandate.principalWallet.toLowerCase()) {
      console.warn(
        `[Mandate Verifier] Invalid signature. Recovered: ${recovered}`,
      );
      return {
        valid: false,
        reason: 'INVALID_SIGNATURE',
        recoveredSigner: recovered,
      };
    }

    return {
      valid: true,
      reason: 'OK',
      recoveredSigner: recovered,
    };
  } catch (err) {
    console.error(`[Mandate Verifier] Signature verification error:`, err);
    return { valid: false, reason: 'SIGNATURE_VERIFY_ERROR' };
  }
}

/**
 * Boolean gate used by the execution engine.
 */
export async function verifyCapitalMandate(
  mandate: CapitalMandate,
  proposedTradeUsd: number,
  opts?: {
    engineOperator?: string;
    nowSec?: number;
    chainId?: number;
    skipSignature?: boolean;
    verifyTypedData?: typeof import('ethers').verifyTypedData;
  },
): Promise<boolean> {
  const structural = verifyCapitalMandateDetailed(mandate, {
    proposedTradeUsd,
    engineOperator: opts?.engineOperator,
    nowSec: opts?.nowSec,
  });
  if (!structural.valid && structural.reason !== 'OK_PENDING_SIG') {
    return false;
  }

  if (opts?.skipSignature) {
    // Tests only — structural checks already passed
    return structural.reason === 'OK_PENDING_SIG' || structural.valid;
  }

  const sig = await verifyCapitalMandateSignature(mandate, {
    chainId: opts?.chainId ?? mandate.chainId,
    verifyTypedData: opts?.verifyTypedData,
  });
  return sig.valid;
}
