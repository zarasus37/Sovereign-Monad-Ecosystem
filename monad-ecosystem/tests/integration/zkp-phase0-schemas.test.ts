/**
 * ZKP Phase 0 — Meshaleach PoC, consent grant, memory epoch commit.
 * Pure TS guards + shared/schemas JSON Schema (ajv) positive/negative cases.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  isMeshaleachPoC,
  meshaleachPoCError,
  isConsentGrant,
  consentGrantError,
  isConsentGrantActive,
  isMemoryEpochCommit,
  memoryEpochCommitError,
  FG_DOMAIN_TAGS,
  type MeshaleachPoC,
  type ConsentGrant,
  type MemoryEpochCommit,
} from '@sovereign/types';

const root = resolve(process.cwd());
const fixtures = resolve(root, 'shared/fixtures/zkp');
const schemas = resolve(root, 'shared/schemas');

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validatePoC = ajv.compile(loadJson(resolve(schemas, 'meshaleach-poc.json')) as object);
const validateConsent = ajv.compile(loadJson(resolve(schemas, 'consent-grant.json')) as object);
const validateEpoch = ajv.compile(
  loadJson(resolve(schemas, 'memory-epoch-commit.json')) as object,
);

describe('ZKP Phase 0 — Meshaleach PoC', () => {
  const valid = loadJson(resolve(fixtures, 'meshaleach-poc.valid.json'));

  it('fixture passes pure TS guard', () => {
    expect(meshaleachPoCError(valid)).toBeNull();
    expect(isMeshaleachPoC(valid)).toBe(true);
  });

  it('fixture passes JSON Schema', () => {
    const ok = validatePoC(valid);
    if (!ok) console.error(validatePoC.errors);
    expect(ok).toBe(true);
  });

  it('rejects missing principal', () => {
    const bad = { ...(valid as object), principal_commitment: undefined };
    delete (bad as { principal_commitment?: string }).principal_commitment;
    expect(isMeshaleachPoC(bad)).toBe(false);
    expect(validatePoC(bad)).toBe(false);
  });

  it('rejects bad gate', () => {
    const bad = { ...(valid as MeshaleachPoC), gate: 'fg9' as 'fg1' };
    expect(isMeshaleachPoC(bad)).toBe(false);
  });

  it('FG_DOMAIN_TAGS covers fg1–fg3', () => {
    expect(FG_DOMAIN_TAGS.fg1).toBe('fg1.literacy');
    expect(FG_DOMAIN_TAGS.fg2).toBe('fg2.stewardship');
    expect(FG_DOMAIN_TAGS.fg3).toBe('fg3.rate_sovereignty');
  });
});

describe('ZKP Phase 0 — ConsentGrant', () => {
  const valid = loadJson(resolve(fixtures, 'consent-grant.valid.json'));

  it('fixture passes pure TS guard + schema', () => {
    expect(consentGrantError(valid)).toBeNull();
    expect(isConsentGrant(valid)).toBe(true);
    expect(validateConsent(valid)).toBe(true);
  });

  it('isConsentGrantActive for active unexpired', () => {
    expect(isConsentGrantActive(valid as ConsentGrant, '2026-08-05T00:00:00.000Z')).toBe(
      true,
    );
  });

  it('isConsentGrantActive false when revoked', () => {
    const g: ConsentGrant = {
      ...(valid as ConsentGrant),
      status: 'revoked',
      revoked_at: '2026-08-04T21:00:00.000Z',
    };
    expect(isConsentGrantActive(g)).toBe(false);
  });

  it('rejects invalid layer', () => {
    const bad = { ...(valid as object), layer: 'VI' };
    expect(isConsentGrant(bad)).toBe(false);
    expect(validateConsent(bad)).toBe(false);
  });
});

describe('ZKP Phase 0 — MemoryEpochCommit', () => {
  const valid = loadJson(resolve(fixtures, 'memory-epoch-commit.valid.json'));

  it('fixture passes pure TS guard + schema', () => {
    expect(memoryEpochCommitError(valid)).toBeNull();
    expect(isMemoryEpochCommit(valid)).toBe(true);
    expect(validateEpoch(valid)).toBe(true);
  });

  it('rejects empty consent_layers', () => {
    const bad = { ...(valid as MemoryEpochCommit), consent_layers: [] };
    expect(isMemoryEpochCommit(bad)).toBe(false);
    expect(validateEpoch(bad)).toBe(false);
  });

  it('chain: second epoch may reference prev_commit', () => {
    const e2: MemoryEpochCommit = {
      ...(valid as MemoryEpochCommit),
      epoch_id: 'epoch-0002',
      prev_commit: (valid as MemoryEpochCommit).commit,
      commit: '0xepoch2',
    };
    expect(isMemoryEpochCommit(e2)).toBe(true);
    expect(validateEpoch(e2)).toBe(true);
  });
});
