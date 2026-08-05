/**
 * Meshaleach PoC mint — EIP-191 personal_sign over canonical payload hash.
 * Wired from FG gate pass (Shaliah-outward Phase 0/1).
 *
 * Message format mirrors wallet-bind style (human-readable multi-line).
 */

import { createHash } from 'node:crypto';
import { verifyMessage, type Signer } from 'ethers';
import type {
  FgGate,
  MeshaleachPoC,
  PoCMerkleDisclosure,
  PoCProof,
} from '@sovereign/types';
import {
  FG_DOMAIN_TAGS,
  MESHALEACH_POC_ISSUER_DEFAULT,
  MESHALEACH_POC_SCHEMA_VERSION,
  commitDomainTags,
  getMerkleProof,
  hashLeaf,
  isMeshaleachPoC,
  verifyMerkleProof,
} from '@sovereign/types';
import type { GateBatteryResult } from './gates.js';

export const MESHALEACH_POC_MESSAGE_PREFIX = 'Sovereign Monad Meshaleach PoC';

/** Payload fields covered by the signature (everything except signature). */
export type MeshaleachPoCUnsigned = Omit<MeshaleachPoC, 'signature'>;

export function canonicalPoCPayload(unsigned: MeshaleachPoCUnsigned): string {
  // Stable key order for hashing
  return JSON.stringify(unsigned, Object.keys(unsigned).sort());
}

export function hashPoCPayload(unsigned: MeshaleachPoCUnsigned): string {
  return createHash('sha256').update(canonicalPoCPayload(unsigned)).digest('hex');
}

export function buildPoCSignMessage(unsigned: MeshaleachPoCUnsigned): string {
  const payloadHash = hashPoCPayload(unsigned);
  return [
    MESHALEACH_POC_MESSAGE_PREFIX,
    `Gate: ${unsigned.gate}`,
    `Domain: ${unsigned.domain_tag}`,
    `Principal: ${unsigned.principal_commitment ?? unsigned.principal_id ?? ''}`,
    `Issued: ${unsigned.issued_at}`,
    `Payload: ${payloadHash}`,
  ].join('\n');
}

export function principalCommitmentFromId(principalId: string): string {
  return `0x${createHash('sha256').update(`principal:${principalId}`).digest('hex')}`;
}

export function integrityHashFromGate(
  principalId: string,
  result: GateBatteryResult,
): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        principalId,
        gate: result.gate,
        domainTag: result.domainTag,
        integritySignature: result.integritySignature,
        items: result.items.map((i) => ({ id: i.itemId, p: i.passed, s: i.score })),
      }),
    )
    .digest('hex');
}

export interface BuildUnsignedPoCOpts {
  readonly principalId: string;
  readonly gateResult: GateBatteryResult;
  /** Use wallet address as principal_id cleartext when binding; else commitment only. */
  readonly walletAddress?: string;
  readonly issuedAt?: string;
  readonly issuer?: string;
  readonly allDomainTags?: readonly string[];
  /** Attach Phase 1 merkle path for this gate's domain tag among allDomainTags. */
  readonly withMerkleDisclosure?: boolean;
  readonly population?: 'shaliah' | 'autonomous';
}

/**
 * Build unsigned PoC from a **passed** FG gate result.
 * Throws if gate did not pass.
 */
export function buildUnsignedMeshaleachPoC(opts: BuildUnsignedPoCOpts): MeshaleachPoCUnsigned {
  const { gateResult } = opts;
  if (!gateResult.passed) {
    throw new Error('Cannot mint MeshaleachPoC for failed gate');
  }
  const gate = gateResult.gate as FgGate;
  const domain_tag = gateResult.domainTag || FG_DOMAIN_TAGS[gate];
  const issued_at = opts.issuedAt ?? new Date().toISOString();
  const principal_commitment = principalCommitmentFromId(opts.principalId);
  const lesson_ids = gateResult.items.map((i) => `${gate}-${i.itemId}`);

  let proof: PoCProof = { system: 'none', bytes: null, public_inputs: [] };

  if (opts.withMerkleDisclosure) {
    const tags = opts.allDomainTags?.length
      ? [...new Set([...opts.allDomainTags, domain_tag])]
      : [domain_tag];
    const { tree, records } = commitDomainTags(tags);
    const leafIndex = tags.indexOf(domain_tag);
    const merkleProof = getMerkleProof(tree, leafIndex, {
      kind: 'domain_tag',
      tag: domain_tag,
    });
    const merkle: PoCMerkleDisclosure = {
      root: merkleProof.root,
      leaf: merkleProof.leaf,
      leafIndex: merkleProof.leafIndex,
      path: merkleProof.path,
      revealed: merkleProof.revealed,
    };
    // sanity: leaf matches domain tag record
    if (hashLeaf(records[leafIndex]!) !== merkle.leaf) {
      throw new Error('merkle leaf mismatch');
    }
    proof = {
      system: 'merkle-sd',
      bytes: null,
      public_inputs: [merkle.root],
      merkle,
    };
  }

  const unsigned: MeshaleachPoCUnsigned = {
    schema_version: MESHALEACH_POC_SCHEMA_VERSION,
    principal_id: opts.walletAddress ?? opts.principalId,
    principal_commitment,
    gate,
    domain_tag,
    lesson_ids,
    integrity: {
      hash: integrityHashFromGate(opts.principalId, gateResult),
      components: {
        N_i: gateResult.items.every((i) => i.passed) ? 1 : 0.5,
        C_i: 1,
        P_i: gateResult.items.filter((i) => i.passed).length / Math.max(1, gateResult.items.length),
      },
    },
    issued_at,
    issuer: opts.issuer ?? MESHALEACH_POC_ISSUER_DEFAULT,
    public_claims: {
      gate_passed: true,
      human_bound: (opts.population ?? 'shaliah') === 'shaliah',
    },
    proof,
    population: opts.population ?? 'shaliah',
  };
  return unsigned;
}

export interface MintPoCResult {
  readonly poc: MeshaleachPoC;
  readonly message: string;
  readonly signerAddress: string;
}

/**
 * Sign unsigned PoC with EIP-191 personal_sign (ethers Signer / Wallet).
 */
export async function mintMeshaleachPoC(
  unsigned: MeshaleachPoCUnsigned,
  signer: Signer,
): Promise<MintPoCResult> {
  const message = buildPoCSignMessage(unsigned);
  const signature = await signer.signMessage(message);
  const signerAddress = await signer.getAddress();
  const poc: MeshaleachPoC = { ...unsigned, signature };
  if (!isMeshaleachPoC(poc)) {
    throw new Error('minted PoC failed structural validation');
  }
  return { poc, message, signerAddress };
}

export type VerifyPoCResult =
  | { ok: true; recoveredAddress: string }
  | { ok: false; error: string };

/**
 * Verify EIP-191 signature recovers expected wallet (if provided) and merkle path if present.
 */
export function verifyMeshaleachPoC(
  poc: MeshaleachPoC,
  opts?: { expectedAddress?: string; expectedMerkleRoot?: string },
): VerifyPoCResult {
  if (!isMeshaleachPoC(poc)) {
    return { ok: false, error: 'STRUCTURAL_INVALID' };
  }
  const { signature, ...rest } = poc;
  const unsigned = rest as MeshaleachPoCUnsigned;
  const message = buildPoCSignMessage(unsigned);
  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    return { ok: false, error: 'INVALID_SIGNATURE' };
  }
  if (opts?.expectedAddress && recovered.toLowerCase() !== opts.expectedAddress.toLowerCase()) {
    return { ok: false, error: 'SIGNATURE_MISMATCH' };
  }
  if (poc.proof.system === 'merkle-sd' && poc.proof.merkle) {
    const m = poc.proof.merkle;
    const okPath = verifyMerkleProof(
      {
        root: m.root,
        leaf: m.leaf,
        leafIndex: m.leafIndex,
        path: m.path,
        revealed: m.revealed,
      },
      opts?.expectedMerkleRoot ?? m.root,
    );
    if (!okPath) return { ok: false, error: 'MERKLE_INVALID' };
    if (m.revealed?.tag && m.revealed.tag !== poc.domain_tag) {
      return { ok: false, error: 'MERKLE_TAG_MISMATCH' };
    }
  }
  return { ok: true, recoveredAddress: recovered };
}
