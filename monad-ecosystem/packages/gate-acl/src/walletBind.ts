/**
 * Wallet binding — EIP-191 verify + PL threshold + Kafka payload construction.
 * Pure crypto/ledger logic; emission in walletBindService.ts.
 */

import { createHash, randomUUID } from 'node:crypto';
import { verifyMessage } from 'ethers';
import { CONSTRAINT_ENVELOPE_VERSION } from './plBridge.js';
import type { PLLedger } from './plLedger.js';
import type { PLDomain } from './types.js';

export const WALLET_BIND_TASK_ID = 'wallet-bind-tier1-activation' as const;
export const TIER_1_PL_MINIMUM = 50;
export const WALLET_BIND_MESSAGE_PREFIX = 'Sovereign Monad Ecosystem Bind';

export interface WalletBindRequest {
  localPrincipalId: string;
  walletAddress: string;
  signature: string;
  message: string;
}

export interface WalletBindKafkaPayload {
  eventId: string;
  principalId: string;
  walletAddress: string;
  localPrincipalId: string;
  totalPl: number;
  tier: 'TIER_1_MESHALEACH';
  taskId: typeof WALLET_BIND_TASK_ID;
  pointsAwarded: 0;
  verifiedBy: 'comprehension-gate';
  constraintEnvelopeVersion: string;
  auditTrace: string[];
  timestamp: string;
  status: 'WALLET_BOUND_TIER1';
}

export type WalletBindVerifyFail = {
  ok: false;
  error:
    | 'MISSING_PARAMETERS'
    | 'INVALID_SIGNATURE'
    | 'SIGNATURE_MISMATCH'
    | 'INSUFFICIENT_PL'
    | 'MESSAGE_MALFORMED'
    | 'REPLAY_WINDOW';
  message: string;
};

export type WalletBindVerifyOk = {
  ok: true;
  recoveredAddress: string;
  totalPl: number;
  domain: PLDomain;
};

const REPLAY_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Parse bind message fields (human-readable multi-line EIP-191 payload).
 */
export function parseBindMessage(message: string): {
  localPrincipalId?: string;
  wallet?: string;
  pl?: number;
  timestamp?: number;
} {
  const out: {
    localPrincipalId?: string;
    wallet?: string;
    pl?: number;
    timestamp?: number;
  } = {};
  if (!message.startsWith(WALLET_BIND_MESSAGE_PREFIX)) return out;
  for (const line of message.split('\n')) {
    if (line.startsWith('Local ID:')) out.localPrincipalId = line.slice('Local ID:'.length).trim();
    if (line.startsWith('Wallet:')) out.wallet = line.slice('Wallet:'.length).trim();
    if (line.startsWith('PL:')) out.pl = Number(line.slice('PL:'.length).trim());
    if (line.startsWith('Timestamp:')) out.timestamp = Number(line.slice('Timestamp:'.length).trim());
  }
  return out;
}

export function buildBindMessage(opts: {
  localPrincipalId: string;
  walletAddress: string;
  pl: number;
  timestamp: number;
}): string {
  return [
    WALLET_BIND_MESSAGE_PREFIX,
    `Local ID: ${opts.localPrincipalId}`,
    `Wallet: ${opts.walletAddress}`,
    `PL: ${opts.pl}`,
    `Timestamp: ${opts.timestamp}`,
  ].join('\n');
}

/**
 * Cryptographic + ledger verification for wallet bind.
 * PL is read from server ledger for localPrincipalId — never trusted from client alone.
 */
export function verifyWalletBind(
  req: WalletBindRequest,
  ledger: PLLedger,
  opts?: { domain?: PLDomain; minPl?: number; now?: number },
): WalletBindVerifyOk | WalletBindVerifyFail {
  const {
    localPrincipalId,
    walletAddress,
    signature,
    message,
  } = req;

  if (!localPrincipalId?.trim() || !walletAddress?.trim() || !signature?.trim() || !message?.trim()) {
    return {
      ok: false,
      error: 'MISSING_PARAMETERS',
      message: 'localPrincipalId, walletAddress, signature, message required',
    };
  }

  const parsed = parseBindMessage(message);
  if (
    !parsed.localPrincipalId ||
    !parsed.wallet ||
    parsed.timestamp === undefined ||
    Number.isNaN(parsed.timestamp)
  ) {
    return {
      ok: false,
      error: 'MESSAGE_MALFORMED',
      message: 'bind message missing Local ID / Wallet / Timestamp fields',
    };
  }

  if (parsed.localPrincipalId !== localPrincipalId) {
    return {
      ok: false,
      error: 'MESSAGE_MALFORMED',
      message: 'message Local ID does not match localPrincipalId',
    };
  }

  if (parsed.wallet.toLowerCase() !== walletAddress.toLowerCase()) {
    return {
      ok: false,
      error: 'MESSAGE_MALFORMED',
      message: 'message Wallet does not match walletAddress',
    };
  }

  const now = opts?.now ?? Date.now();
  if (Math.abs(now - parsed.timestamp) > REPLAY_MAX_AGE_MS) {
    return {
      ok: false,
      error: 'REPLAY_WINDOW',
      message: 'bind message timestamp outside 15m window',
    };
  }

  let recoveredAddress: string;
  try {
    recoveredAddress = verifyMessage(message, signature);
  } catch {
    return {
      ok: false,
      error: 'INVALID_SIGNATURE',
      message: 'ethers.verifyMessage failed',
    };
  }

  if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
    return {
      ok: false,
      error: 'SIGNATURE_MISMATCH',
      message: 'recovered address does not match claimed walletAddress',
    };
  }

  const domain = (opts?.domain ?? 'agent_ops') as PLDomain;
  const minPl = opts?.minPl ?? TIER_1_PL_MINIMUM;
  const plState = ledger.compute(localPrincipalId, domain, now);
  if (plState.score < minPl) {
    return {
      ok: false,
      error: 'INSUFFICIENT_PL',
      message: `Principal Level ${minPl} required for wallet binding (server score=${plState.score})`,
    };
  }

  return {
    ok: true,
    recoveredAddress,
    totalPl: plState.score,
    domain,
  };
}

export function buildWalletBindEvent(
  req: WalletBindRequest,
  verified: WalletBindVerifyOk,
  now = Date.now(),
): WalletBindKafkaPayload {
  const wallet = req.walletAddress;
  const h = createHash('sha1')
    .update(`wallet-bind:${req.localPrincipalId}:${wallet}:${now}`)
    .digest('hex');
  const eventId = `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;

  return {
    eventId,
    principalId: wallet, // canonical shift: wallet is now principal
    walletAddress: wallet,
    localPrincipalId: req.localPrincipalId,
    totalPl: verified.totalPl,
    tier: 'TIER_1_MESHALEACH',
    taskId: WALLET_BIND_TASK_ID,
    pointsAwarded: 0,
    verifiedBy: 'comprehension-gate',
    constraintEnvelopeVersion: CONSTRAINT_ENVELOPE_VERSION,
    auditTrace: [
      `gate-acl:verify-signature:${verified.recoveredAddress}`,
      `local-ledger:fetch-pl:${req.localPrincipalId}:score=${verified.totalPl}`,
      `canonical-principal:${wallet}`,
      `kafka:emit:sovereign.pl.ledger.events`,
    ],
    timestamp: new Date(now).toISOString(),
    status: 'WALLET_BOUND_TIER1',
  };
}

/** In-memory map localPrincipal → wallet (server process). */
export class PrincipalWalletRegistry {
  private readonly map = new Map<string, string>();

  bind(localPrincipalId: string, walletAddress: string): void {
    this.map.set(localPrincipalId, walletAddress.toLowerCase());
    this.map.set(walletAddress.toLowerCase(), localPrincipalId);
  }

  walletFor(localPrincipalId: string): string | undefined {
    return this.map.get(localPrincipalId);
  }

  localFor(walletAddress: string): string | undefined {
    return this.map.get(walletAddress.toLowerCase());
  }
}

export function randomBindId(): string {
  return randomUUID();
}
