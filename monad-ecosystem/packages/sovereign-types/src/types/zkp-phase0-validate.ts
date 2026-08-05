/**
 * Phase 0 structural validators (pure TS, no ajv runtime dep).
 * JSON Schema sources of truth live in shared/schemas/*.json for docs + tests.
 */

import type { MeshaleachPoC, FgGate, DualPopulation, PoCProofSystem } from './meshaleach-poc.js';
import type { ConsentGrant, ConsentDataLayer, ConsentGrantStatus } from './consent-grant.js';
import type { MemoryEpochCommit } from './memory-epoch.js';

const FG_GATES = new Set<FgGate>(['fg1', 'fg2', 'fg3']);
const POPS = new Set<DualPopulation>(['shaliah', 'autonomous']);
const PROOF_SYSTEMS = new Set<PoCProofSystem>(['none', 'merkle-sd', 'groth16', 'plonk']);
const LAYERS = new Set<ConsentDataLayer>(['I', 'II', 'III', 'IV', 'V']);
const CONSENT_STATUS = new Set<ConsentGrantStatus>(['active', 'expired', 'revoked']);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function hasPrincipal(v: Record<string, unknown>): boolean {
  return isNonEmptyString(v.principal_id) || isNonEmptyString(v.principal_commitment);
}

/** Returns null if valid MeshaleachPoC; else human-readable error. */
export function meshaleachPoCError(data: unknown): string | null {
  if (!isRecord(data)) return 'not an object';
  if (data.schema_version !== 'poc.v1') return 'schema_version must be poc.v1';
  if (!hasPrincipal(data)) return 'principal_id or principal_commitment required';
  if (typeof data.gate !== 'string' || !FG_GATES.has(data.gate as FgGate)) {
    return 'gate must be fg1|fg2|fg3';
  }
  if (!isNonEmptyString(data.domain_tag)) return 'domain_tag required';
  if (!Array.isArray(data.lesson_ids) || !data.lesson_ids.every(isNonEmptyString)) {
    return 'lesson_ids must be string[]';
  }
  if (!isRecord(data.integrity)) return 'integrity required';
  const integ = data.integrity;
  if (integ.components !== undefined) {
    if (!isRecord(integ.components)) return 'integrity.components must be object';
    for (const k of ['N_i', 'C_i', 'P_i'] as const) {
      const n = integ.components[k];
      if (n !== undefined && (typeof n !== 'number' || n < 0 || n > 1)) {
        return `integrity.components.${k} must be number in [0,1]`;
      }
    }
  }
  if (integ.hash !== undefined && !isNonEmptyString(integ.hash)) {
    return 'integrity.hash must be non-empty string when present';
  }
  if (!isNonEmptyString(data.issued_at)) return 'issued_at required';
  if (!isNonEmptyString(data.issuer)) return 'issuer required';
  if (!isRecord(data.public_claims)) return 'public_claims required';
  if (typeof data.public_claims.gate_passed !== 'boolean') {
    return 'public_claims.gate_passed must be boolean';
  }
  if (typeof data.public_claims.human_bound !== 'boolean') {
    return 'public_claims.human_bound must be boolean';
  }
  if (!isRecord(data.proof)) return 'proof required';
  if (typeof data.proof.system !== 'string' || !PROOF_SYSTEMS.has(data.proof.system as PoCProofSystem)) {
    return 'proof.system invalid';
  }
  if (data.proof.merkle !== undefined) {
    if (!isRecord(data.proof.merkle)) return 'proof.merkle must be object';
    const m = data.proof.merkle;
    if (!isNonEmptyString(m.root) || !isNonEmptyString(m.leaf)) {
      return 'proof.merkle.root and leaf required';
    }
    if (typeof m.leafIndex !== 'number' || m.leafIndex < 0) {
      return 'proof.merkle.leafIndex invalid';
    }
    if (!Array.isArray(m.path) || !m.path.every(isNonEmptyString)) {
      return 'proof.merkle.path must be string[]';
    }
  }
  if (!isNonEmptyString(data.signature)) return 'signature required';
  if (typeof data.population !== 'string' || !POPS.has(data.population as DualPopulation)) {
    return 'population must be shaliah|autonomous';
  }
  return null;
}

export function isMeshaleachPoC(data: unknown): data is MeshaleachPoC {
  return meshaleachPoCError(data) === null;
}

export function consentGrantError(data: unknown): string | null {
  if (!isRecord(data)) return 'not an object';
  if (data.schema_version !== 'consent.v1') return 'schema_version must be consent.v1';
  if (!hasPrincipal(data)) return 'principal_id or principal_commitment required';
  if (typeof data.layer !== 'string' || !LAYERS.has(data.layer as ConsentDataLayer)) {
    return 'layer must be I|II|III|IV|V';
  }
  if (!isNonEmptyString(data.purpose)) return 'purpose required';
  if (!isNonEmptyString(data.granted_at)) return 'granted_at required';
  if (
    data.expires_at !== undefined &&
    data.expires_at !== null &&
    !isNonEmptyString(data.expires_at)
  ) {
    return 'expires_at must be string or null';
  }
  if (
    data.revoked_at !== undefined &&
    data.revoked_at !== null &&
    !isNonEmptyString(data.revoked_at)
  ) {
    return 'revoked_at must be string or null';
  }
  if (typeof data.status !== 'string' || !CONSENT_STATUS.has(data.status as ConsentGrantStatus)) {
    return 'status must be active|expired|revoked';
  }
  if (!isNonEmptyString(data.signature)) return 'signature required';
  if (typeof data.population !== 'string' || !POPS.has(data.population as DualPopulation)) {
    return 'population must be shaliah|autonomous';
  }
  return null;
}

export function isConsentGrant(data: unknown): data is ConsentGrant {
  return consentGrantError(data) === null;
}

/** Active grant helper (status + optional expiry clock). */
export function isConsentGrantActive(
  grant: ConsentGrant,
  nowIso: string = new Date().toISOString(),
): boolean {
  if (grant.status !== 'active') return false;
  if (grant.revoked_at) return false;
  if (grant.expires_at && grant.expires_at < nowIso) return false;
  return true;
}

export function memoryEpochCommitError(data: unknown): string | null {
  if (!isRecord(data)) return 'not an object';
  if (data.schema_version !== 'memory-epoch.v1') {
    return 'schema_version must be memory-epoch.v1';
  }
  if (!isNonEmptyString(data.principal_commitment)) {
    return 'principal_commitment required';
  }
  if (!isNonEmptyString(data.epoch_id)) return 'epoch_id required';
  if (
    data.prev_commit !== undefined &&
    data.prev_commit !== null &&
    !isNonEmptyString(data.prev_commit)
  ) {
    return 'prev_commit must be string or null';
  }
  if (!isNonEmptyString(data.commit)) return 'commit required';
  if (
    !Array.isArray(data.consent_layers) ||
    data.consent_layers.length < 1 ||
    !data.consent_layers.every((l) => typeof l === 'string' && LAYERS.has(l as ConsentDataLayer))
  ) {
    return 'consent_layers must be non-empty I–V array';
  }
  if (
    !Array.isArray(data.purpose_tags) ||
    !data.purpose_tags.every((t) => typeof t === 'string')
  ) {
    return 'purpose_tags must be string[]';
  }
  if (!isNonEmptyString(data.created_at)) return 'created_at required';
  if (data.store_ops !== undefined && (typeof data.store_ops !== 'number' || data.store_ops < 0)) {
    return 'store_ops must be >= 0';
  }
  if (data.recall_ops !== undefined && (typeof data.recall_ops !== 'number' || data.recall_ops < 0)) {
    return 'recall_ops must be >= 0';
  }
  if (!isNonEmptyString(data.signature)) return 'signature required';
  if (typeof data.population !== 'string' || !POPS.has(data.population as DualPopulation)) {
    return 'population must be shaliah|autonomous';
  }
  return null;
}

export function isMemoryEpochCommit(data: unknown): data is MemoryEpochCommit {
  return memoryEpochCommitError(data) === null;
}
