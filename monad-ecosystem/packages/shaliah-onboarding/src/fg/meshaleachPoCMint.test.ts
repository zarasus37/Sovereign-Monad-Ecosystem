import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Wallet } from 'ethers';
import {
  commitDomainTags,
  getMerkleProof,
  verifyMerkleProof,
  buildMerkleFromRecords,
  memoryEpochLeafRecord,
} from '@sovereign/types';
import { evaluateFg1Gate } from './gates.js';
import {
  buildUnsignedMeshaleachPoC,
  mintMeshaleachPoC,
  verifyMeshaleachPoC,
} from './meshaleachPoCMint.js';
import {
  buildMemoryEpochCommit,
  commitMemoryEpochs,
  verifyMemoryEpochInTree,
} from './memoryEpochMint.js';

describe('MeshaleachPoC EIP-191 mint', () => {
  it('signs and verifies', async () => {
    const wallet = Wallet.createRandom();
    const gate = evaluateFg1Gate('p1', {
      defiRisk: 'Safer pool with audit; risks include liquidity and smart contract drawdown.',
      timePreference: 'I trade time for compound future growth with patience.',
      realEconomy: 'Storage and time cost of waiting on commodity demand.',
      claimExplain: 'My claim is units; NAV is the collective pool value of funds.',
    });
    assert.equal(gate.passed, true);
    const unsigned = buildUnsignedMeshaleachPoC({
      principalId: 'p1',
      gateResult: gate,
      walletAddress: wallet.address,
      withMerkleDisclosure: true,
      allDomainTags: ['fg1.literacy', 'fg2.stewardship'],
    });
    assert.equal(unsigned.proof.system, 'merkle-sd');
    const { poc } = await mintMeshaleachPoC(unsigned, wallet);
    const v = verifyMeshaleachPoC(poc, { expectedAddress: wallet.address });
    assert.equal(v.ok, true, v.ok ? '' : v.error);
  });

  it('fails verify with wrong wallet expectation', async () => {
    const wallet = Wallet.createRandom();
    const other = Wallet.createRandom();
    const gate = evaluateFg1Gate('p2', {
      defiRisk: 'Safer pool with audit; risks include liquidity and smart contract drawdown.',
      timePreference: 'I trade time for compound future growth with patience.',
      realEconomy: 'Storage and time cost of waiting on commodity demand.',
      claimExplain: 'My claim is units; NAV is the collective pool value of funds.',
    });
    const unsigned = buildUnsignedMeshaleachPoC({
      principalId: 'p2',
      gateResult: gate,
      withMerkleDisclosure: false,
    });
    const { poc } = await mintMeshaleachPoC(unsigned, wallet);
    const v = verifyMeshaleachPoC(poc, { expectedAddress: other.address });
    assert.equal(v.ok, false);
  });
});

describe('Phase 1 Merkle domain tags + memory epochs', () => {
  it('proves domain tag membership', () => {
    const tags = ['fg1.literacy', 'fg2.stewardship', 'fg3.rate_sovereignty'];
    const { tree } = commitDomainTags(tags);
    const proof = getMerkleProof(tree, 1, { tag: 'fg2.stewardship' });
    assert.equal(verifyMerkleProof(proof, tree.root), true);
  });

  it('chains memory epochs and proves one in a tree', () => {
    const e1 = buildMemoryEpochCommit({
      principalId: 'p-mem',
      blobCommitmentMaterial: 'cipher-blob-1',
      consentLayers: ['I', 'II'],
      purposeTags: ['shaliah.coach'],
      signature: '0xsig1',
      prevCommit: null,
    });
    const e2 = buildMemoryEpochCommit({
      principalId: 'p-mem',
      blobCommitmentMaterial: 'cipher-blob-2',
      consentLayers: ['I', 'II', 'III'],
      purposeTags: ['shaliah.coach', 'shaliah.mirror'],
      signature: '0xsig2',
      prevCommit: e1.commit,
    });
    assert.equal(e2.prev_commit, e1.commit);
    const { root, proofs } = commitMemoryEpochs([e1, e2]);
    assert.equal(verifyMemoryEpochInTree(e2, proofs[1]!, root), true);
    // wrong root fails
    assert.equal(verifyMerkleProof(proofs[0]!, '00'.repeat(32)), false);
  });

  it('buildMerkleFromRecords for epoch leaves', () => {
    const rec = memoryEpochLeafRecord({
      epoch_id: 'e',
      commit: '0xc',
      principal_commitment: '0xp',
    });
    const tree = buildMerkleFromRecords([rec]);
    assert.ok(tree.root.length === 64);
  });
});
