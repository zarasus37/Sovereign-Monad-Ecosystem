/**
 * Meshaleach Proof of Cognition (PoC) — Phase 0 envelope.
 * Doctrine: ZKP/README.md · FG_CURRICULUM.md PoC minimum payload.
 * proof.system = "none" until selective disclosure / circuits land.
 */

export type FgGate = 'fg1' | 'fg2' | 'fg3';

/** Canonical domain tags (open string for future domains). */
export type MeshaleachDomainTag =
  | 'fg1.literacy'
  | 'fg2.stewardship'
  | 'fg3.rate_sovereignty'
  | (string & {});

export type DualPopulation = 'shaliah' | 'autonomous';

export type PoCProofSystem = 'none' | 'merkle-sd' | 'groth16' | 'plonk';

/** Integrity components from FG anti-grind (0–1 when present). */
export interface IntegrityComponents {
  /** Navigation authenticity */
  readonly N_i?: number;
  /** Context alignment */
  readonly C_i?: number;
  /** Progressive differentiation */
  readonly P_i?: number;
}

export interface PoCIntegrity {
  readonly components?: IntegrityComponents;
  /** Hash of components when components are not revealed outward */
  readonly hash?: string;
}

export interface PoCPublicClaims {
  readonly gate_passed: boolean;
  readonly human_bound: boolean;
}

export interface PoCProof {
  readonly system: PoCProofSystem;
  readonly bytes?: string | null;
  readonly public_inputs?: readonly unknown[];
}

/**
 * Phase 0 PoC / Meshaleach seal.
 * At least one of principal_id | principal_commitment required.
 */
export interface MeshaleachPoC {
  readonly schema_version: 'poc.v1';
  readonly principal_id?: string;
  readonly principal_commitment?: string;
  readonly gate: FgGate;
  readonly domain_tag: MeshaleachDomainTag;
  readonly lesson_ids: readonly string[];
  readonly integrity: PoCIntegrity;
  readonly issued_at: string;
  readonly issuer: string;
  readonly public_claims: PoCPublicClaims;
  readonly proof: PoCProof;
  readonly signature: string;
  readonly population: DualPopulation;
}

export const MESHALEACH_POC_SCHEMA_VERSION = 'poc.v1' as const;
export const MESHALEACH_POC_ISSUER_DEFAULT = 'meshaleach-v1' as const;

export const FG_DOMAIN_TAGS: Readonly<Record<FgGate, MeshaleachDomainTag>> = {
  fg1: 'fg1.literacy',
  fg2: 'fg2.stewardship',
  fg3: 'fg3.rate_sovereignty',
};
