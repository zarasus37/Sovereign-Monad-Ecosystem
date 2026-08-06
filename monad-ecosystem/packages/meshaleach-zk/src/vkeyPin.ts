/**
 * Verification-key pin — detects demo vs production ceremony artifacts.
 * Production mint with withSnark should refuse un-pinned or demo keys when
 * MESHALEACH_REQUIRE_PROD_VKEY=1 (or NODE_ENV=production + require flag).
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { artifactPaths } from './paths.js';

export type CeremonyMode = 'demo' | 'production' | 'unknown';

export interface CeremonyMeta {
  readonly mode: CeremonyMode;
  readonly vkeySha256?: string;
  readonly phase1?: string;
  readonly phase2Contributors?: readonly string[];
  readonly beacon?: string | null;
  readonly zkeyVerify?: string;
  readonly note?: string;
}

export interface CircuitMetaFile {
  readonly name?: string;
  readonly system?: string;
  readonly curve?: string;
  readonly public?: readonly string[];
  readonly builtAt?: string;
  readonly note?: string;
  readonly ceremony?: CeremonyMeta;
  readonly vkeySha256?: string;
}

/** Known demo pin for the current committed demo ceremony vkey. */
export const DEMO_VKEY_SHA256 =
  '7b962dfe98e71e8651acf0bf533f6bd0198977dbad851563f90bfec21d5eed19';

export function sha256HexOfFile(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function sha256HexOfString(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

export function readCircuitMeta(): CircuitMetaFile | null {
  const { meta } = artifactPaths();
  if (!existsSync(meta)) return null;
  try {
    return JSON.parse(readFileSync(meta, 'utf8')) as CircuitMetaFile;
  } catch {
    return null;
  }
}

/** SHA-256 of on-disk verification_key.json (empty string if missing). */
export function currentVkeySha256(): string {
  const { vkey } = artifactPaths();
  if (!existsSync(vkey)) return '';
  return sha256HexOfFile(vkey);
}

/**
 * Expected pin from circuit_meta (ceremony.vkeySha256 or top-level vkeySha256).
 * Falls back to DEMO_VKEY_SHA256 when meta marks demo and pin omitted.
 */
export function expectedVkeyPin(meta?: CircuitMetaFile | null): string | null {
  const m = meta ?? readCircuitMeta();
  if (!m) return DEMO_VKEY_SHA256;
  const pin = m.ceremony?.vkeySha256 ?? m.vkeySha256;
  if (pin) return pin.toLowerCase();
  const mode = resolveCeremonyMode(m);
  if (mode === 'demo') return DEMO_VKEY_SHA256;
  return null;
}

export function resolveCeremonyMode(meta?: CircuitMetaFile | null): CeremonyMode {
  const m = meta ?? readCircuitMeta();
  if (m?.ceremony?.mode) return m.ceremony.mode;
  if (m?.note && /demo/i.test(m.note)) return 'demo';
  if (m?.note && /production/i.test(m.note)) return 'production';
  return 'unknown';
}

export interface VkeyPinStatus {
  readonly ready: boolean;
  readonly mode: CeremonyMode;
  readonly currentSha256: string;
  readonly expectedSha256: string | null;
  readonly pinMatch: boolean;
  readonly isDemo: boolean;
  readonly isProduction: boolean;
}

export function getVkeyPinStatus(): VkeyPinStatus {
  const meta = readCircuitMeta();
  const mode = resolveCeremonyMode(meta);
  const currentSha256 = currentVkeySha256();
  const expectedSha256 = expectedVkeyPin(meta);
  const pinMatch =
    Boolean(currentSha256) &&
    Boolean(expectedSha256) &&
    currentSha256 === expectedSha256;
  return {
    ready: Boolean(currentSha256),
    mode,
    currentSha256,
    expectedSha256,
    pinMatch,
    isDemo: mode === 'demo' || currentSha256 === DEMO_VKEY_SHA256,
    isProduction: mode === 'production' && pinMatch,
  };
}

/**
 * Assert on-disk vkey matches the pin recorded in circuit_meta.
 * @throws on mismatch or missing artifacts
 */
export function assertVkeyPinMatches(): VkeyPinStatus {
  const status = getVkeyPinStatus();
  if (!status.ready) {
    throw new Error(
      'verification_key.json missing — run build:circuit or production ceremony',
    );
  }
  if (!status.expectedSha256) {
    throw new Error(
      'No vkey pin in circuit_meta.json — run scripts/pin-vkey.mjs after ceremony',
    );
  }
  if (!status.pinMatch) {
    throw new Error(
      `vkey pin mismatch: disk=${status.currentSha256.slice(0, 12)}… ` +
        `expected=${status.expectedSha256.slice(0, 12)}… (mode=${status.mode})`,
    );
  }
  return status;
}

/**
 * When MESHALEACH_REQUIRE_PROD_VKEY=1 (or true), refuse demo / non-production keys.
 * Safe default: off in dev so demo Groth16 still proves/verifies in CI.
 */
export function assertProductionVkeyIfRequired(): VkeyPinStatus {
  const status = assertVkeyPinMatches();
  const requireProd =
    process.env.MESHALEACH_REQUIRE_PROD_VKEY === '1' ||
    process.env.MESHALEACH_REQUIRE_PROD_VKEY === 'true';
  if (requireProd && !status.isProduction) {
    throw new Error(
      `Production SNARK required (MESHALEACH_REQUIRE_PROD_VKEY) but ceremony mode=${status.mode}. ` +
        'Complete multi-party ptau (PRODUCTION_PTAU.md) and pin a production vkey.',
    );
  }
  return status;
}
