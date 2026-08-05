/**
 * Memory epoch commit builder + multi-epoch Merkle commitment (Phase 1).
 * Contents stay out of band; only commits enter the chain / tree.
 */

import { createHash, randomUUID } from 'node:crypto';
import type { ConsentDataLayer, MemoryEpochCommit, MerkleProof } from '@sovereign/types';
import {
  MEMORY_EPOCH_SCHEMA_VERSION,
  buildMerkleFromRecords,
  getMerkleProof,
  isMemoryEpochCommit,
  memoryEpochLeafRecord,
  verifyMerkleProof,
} from '@sovereign/types';
import { principalCommitmentFromId } from './meshaleachPoCMint.js';

export function hashEpochBlob(ciphertextOrPlaceholder: string): string {
  return createHash('sha256').update(`epoch-blob:${ciphertextOrPlaceholder}`).digest('hex');
}

export interface BuildMemoryEpochOpts {
  readonly principalId: string;
  readonly principalCommitment?: string;
  readonly epochId?: string;
  readonly prevCommit?: string | null;
  /** Opaque encrypted payload or local placeholder — never logged as soul content. */
  readonly blobCommitmentMaterial: string;
  readonly consentLayers: readonly ConsentDataLayer[];
  readonly purposeTags: readonly string[];
  readonly storeOps?: number;
  readonly recallOps?: number;
  readonly createdAt?: string;
  readonly population?: 'shaliah' | 'autonomous';
  /** Issuer signature placeholder or real EIP-191 hex from outer signer. */
  readonly signature: string;
}

export function buildMemoryEpochCommit(opts: BuildMemoryEpochOpts): MemoryEpochCommit {
  const principal_commitment =
    opts.principalCommitment ?? principalCommitmentFromId(opts.principalId);
  const commit = hashEpochBlob(opts.blobCommitmentMaterial);
  const epoch: MemoryEpochCommit = {
    schema_version: MEMORY_EPOCH_SCHEMA_VERSION,
    principal_commitment,
    epoch_id: opts.epochId ?? randomUUID(),
    prev_commit: opts.prevCommit ?? null,
    commit: `0x${commit}`,
    consent_layers: [...opts.consentLayers],
    purpose_tags: [...opts.purposeTags],
    created_at: opts.createdAt ?? new Date().toISOString(),
    store_ops: opts.storeOps,
    recall_ops: opts.recallOps,
    signature: opts.signature,
    population: opts.population ?? 'shaliah',
  };
  if (!isMemoryEpochCommit(epoch)) {
    throw new Error('memory epoch failed structural validation');
  }
  return epoch;
}

/** Commit a list of epochs into a Merkle root; prove one epoch by index. */
export function commitMemoryEpochs(epochs: readonly MemoryEpochCommit[]): {
  root: string;
  proofs: MerkleProof[];
} {
  const records = epochs.map((e) =>
    memoryEpochLeafRecord({
      epoch_id: e.epoch_id,
      commit: e.commit,
      principal_commitment: e.principal_commitment,
    }),
  );
  const tree = buildMerkleFromRecords(records);
  const proofs = epochs.map((e, i) =>
    getMerkleProof(tree, i, {
      epoch_id: e.epoch_id,
      commit: e.commit,
    }),
  );
  return { root: tree.root, proofs };
}

export function verifyMemoryEpochInTree(
  epoch: MemoryEpochCommit,
  proof: MerkleProof,
  expectedRoot: string,
): boolean {
  if (proof.revealed?.epoch_id && proof.revealed.epoch_id !== epoch.epoch_id) {
    return false;
  }
  if (proof.revealed?.commit && proof.revealed.commit !== epoch.commit) {
    return false;
  }
  return verifyMerkleProof(proof, expectedRoot);
}
