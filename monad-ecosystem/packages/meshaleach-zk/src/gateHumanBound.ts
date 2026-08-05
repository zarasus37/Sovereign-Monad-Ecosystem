/**
 * Groth16 prove/verify for gate_passed ∧ human_bound.
 * Artifacts from `pnpm run build:circuit` (Circom + snarkjs).
 */

import { readFileSync } from 'node:fs';
import { artifactPaths, artifactsReady } from './paths.js';

export interface GateHumanBoundPrivateInput {
  /** Must be 1 to satisfy circuit */
  readonly gate_passed: 0 | 1;
  /** Must be 1 to satisfy circuit */
  readonly human_bound: 0 | 1;
  /** Private salt (field element as decimal string or number) */
  readonly salt: string | number | bigint;
}

export interface GateHumanBoundPublicSignals {
  readonly out_gate: string;
  readonly out_human: string;
  readonly commit: string;
}

/** snarkjs Groth16 proof JSON shape */
export interface Groth16Proof {
  readonly pi_a: string[];
  readonly pi_b: string[][];
  readonly pi_c: string[];
  readonly protocol: string;
  readonly curve: string;
}

export interface GateHumanBoundProofBundle {
  readonly system: 'groth16';
  readonly proof: Groth16Proof;
  readonly publicSignals: readonly string[];
  readonly public: GateHumanBoundPublicSignals;
}

export function assertArtifactsReady(): void {
  if (!artifactsReady()) {
    throw new Error(
      'Meshaleach ZK artifacts missing. Run: pnpm --filter @sovereign/meshaleach-zk build:circuit',
    );
  }
}

async function snarkjs() {
  return import('snarkjs');
}

export async function proveGateHumanBound(
  input: GateHumanBoundPrivateInput,
): Promise<GateHumanBoundProofBundle> {
  assertArtifactsReady();
  if (input.gate_passed !== 1 || input.human_bound !== 1) {
    throw new Error('Circuit requires gate_passed=1 and human_bound=1');
  }
  const { wasm, zkey } = artifactPaths();
  const sj = await snarkjs();
  const salt =
    typeof input.salt === 'bigint' ? input.salt.toString() : String(input.salt);
  const { proof, publicSignals } = await sj.groth16.fullProve(
    {
      gate_passed: input.gate_passed,
      human_bound: input.human_bound,
      salt,
    },
    wasm,
    zkey,
  );
  // Public signal order matches circuit outputs: out_gate, out_human, commit
  const pub: GateHumanBoundPublicSignals = {
    out_gate: publicSignals[0]!,
    out_human: publicSignals[1]!,
    commit: publicSignals[2]!,
  };
  return {
    system: 'groth16',
    proof: proof as Groth16Proof,
    publicSignals,
    public: pub,
  };
}

export async function verifyGateHumanBound(
  bundle: GateHumanBoundProofBundle,
): Promise<boolean> {
  assertArtifactsReady();
  if (bundle.public.out_gate !== '1' || bundle.public.out_human !== '1') {
    return false;
  }
  const { vkey } = artifactPaths();
  const vkeyJson = JSON.parse(readFileSync(vkey, 'utf8'));
  const sj = await snarkjs();
  return sj.groth16.verify(vkeyJson, bundle.publicSignals as string[], bundle.proof);
}

/** Attach SNARK to Meshaleach PoC proof field shape. */
export function snarkToPoCProofFields(bundle: GateHumanBoundProofBundle): {
  system: 'groth16';
  bytes: string;
  public_inputs: string[];
} {
  return {
    system: 'groth16',
    bytes: JSON.stringify(bundle.proof),
    public_inputs: [...bundle.publicSignals],
  };
}
