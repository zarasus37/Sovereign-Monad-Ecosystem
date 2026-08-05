/**
 * Phase 1 — deterministic Merkle commitment + reveal (SHA-256 binary tree).
 * Used for domain-tag sets and memory-epoch leaves without full SD-JWT stack.
 * proof.system = "merkle-sd" when attaching a path to MeshaleachPoC.
 */

import { createHash } from 'node:crypto';

export type HexHash = string;

export interface MerkleProof {
  readonly root: HexHash;
  readonly leaf: HexHash;
  readonly leafIndex: number;
  readonly path: readonly HexHash[];
  /** Optionally revealed attribute keys at this leaf (cleartext). */
  readonly revealed?: Readonly<Record<string, string>>;
}

export interface MerkleTree {
  readonly leaves: readonly HexHash[];
  readonly layers: readonly (readonly HexHash[])[];
  readonly root: HexHash;
}

function sha256Hex(data: string | Buffer): HexHash {
  return createHash('sha256').update(data).digest('hex');
}

/** Leaf hash: sha256("leaf:" + stable JSON or raw string). */
export function hashLeaf(payload: string | Record<string, unknown>): HexHash {
  const s =
    typeof payload === 'string'
      ? payload
      : JSON.stringify(payload, Object.keys(payload).sort());
  return sha256Hex(`leaf:${s}`);
}

function parentHash(left: HexHash, right: HexHash): HexHash {
  // Order-independent pairing for odd-leaf duplicate
  return sha256Hex(`node:${left}${right}`);
}

/** Build a Merkle tree from pre-hashed leaves (hex). Empty → zero root. */
export function buildMerkleTree(leaves: readonly HexHash[]): MerkleTree {
  if (leaves.length === 0) {
    const z = sha256Hex('empty');
    return { leaves: [], layers: [[z]], root: z };
  }
  let layer: string[] = [...leaves];
  const layers: string[][] = [layer];
  while (layer.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = layer[i + 1] ?? left;
      next.push(parentHash(left, right));
    }
    layer = next;
    layers.push(layer);
  }
  return { leaves, layers, root: layer[0]! };
}

/** Build tree from attribute records (each record → one leaf). */
export function buildMerkleFromRecords(
  records: readonly Record<string, unknown>[],
): MerkleTree {
  const leaves = records.map((r) => hashLeaf(r));
  return buildMerkleTree(leaves);
}

export function getMerkleProof(
  tree: MerkleTree,
  leafIndex: number,
  revealed?: Readonly<Record<string, string>>,
): MerkleProof {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error(`leafIndex ${leafIndex} out of range`);
  }
  const path: string[] = [];
  let idx = leafIndex;
  for (let d = 0; d < tree.layers.length - 1; d++) {
    const layer = tree.layers[d]!;
    const sibling = idx % 2 === 0 ? layer[idx + 1] ?? layer[idx]! : layer[idx - 1]!;
    path.push(sibling);
    idx = Math.floor(idx / 2);
  }
  return {
    root: tree.root,
    leaf: tree.leaves[leafIndex]!,
    leafIndex,
    path,
    revealed,
  };
}

/** Verify proof against expected root. */
export function verifyMerkleProof(proof: MerkleProof, expectedRoot?: HexHash): boolean {
  let hash = proof.leaf;
  let idx = proof.leafIndex;
  for (const sibling of proof.path) {
    if (idx % 2 === 0) {
      hash = parentHash(hash, sibling);
    } else {
      hash = parentHash(sibling, hash);
    }
    idx = Math.floor(idx / 2);
  }
  const root = expectedRoot ?? proof.root;
  return hash === root && hash === proof.root;
}

/** Domain-tag commitment set (for Meshaleach multi-gate seals). */
export function commitDomainTags(tags: readonly string[]): {
  tree: MerkleTree;
  records: Record<string, string>[];
} {
  const records = tags.map((tag) => ({ kind: 'domain_tag', tag }));
  return { tree: buildMerkleFromRecords(records), records };
}

/** Memory epoch leaf record (no blob content). */
export function memoryEpochLeafRecord(epoch: {
  epoch_id: string;
  commit: string;
  principal_commitment: string;
}): Record<string, string> {
  return {
    kind: 'memory_epoch',
    epoch_id: epoch.epoch_id,
    commit: epoch.commit,
    principal_commitment: epoch.principal_commitment,
  };
}
