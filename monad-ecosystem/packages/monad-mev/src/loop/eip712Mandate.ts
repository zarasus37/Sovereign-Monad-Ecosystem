/**
 * Shared EIP-712 domain + types for CapitalMandate (Vector 5.3).
 */

import {
  SOVEREIGN_MANDATE_DOMAIN_NAME,
  SOVEREIGN_MANDATE_DOMAIN_VERSION,
} from '@sovereign/types';

export function mandateDomain(chainId?: number): {
  name: string;
  version: string;
  chainId: number;
} {
  return {
    name: SOVEREIGN_MANDATE_DOMAIN_NAME,
    version: SOVEREIGN_MANDATE_DOMAIN_VERSION,
    chainId:
      chainId ??
      Number(process.env.MONAD_CHAIN_ID || process.env.CHAIN_ID || 101010),
  };
}

export const MANDATE_TYPES = {
  CapitalMandate: [
    { name: 'mandateId', type: 'string' },
    { name: 'principalWallet', type: 'address' },
    { name: 'engineOperator', type: 'address' },
    { name: 'amountAllocated', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
  ],
} as const;

/** Struct fields signed / verified (no signature field). */
export type MandateTypedValue = {
  mandateId: string;
  principalWallet: string;
  engineOperator: string;
  amountAllocated: bigint;
  expiration: bigint;
};

export function toMandateTypedValue(fields: {
  mandateId: string;
  principalWallet: string;
  engineOperator: string;
  amountAllocated: number;
  expiration: number;
}): MandateTypedValue {
  return {
    mandateId: fields.mandateId,
    principalWallet: fields.principalWallet,
    engineOperator: fields.engineOperator,
    amountAllocated: BigInt(Math.floor(fields.amountAllocated)),
    expiration: BigInt(Math.floor(fields.expiration)),
  };
}
