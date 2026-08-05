/**
 * Consent-graded grant — Phase 0.
 * One layer × purpose, revocable. Whitepaper layers I–V.
 */

import type { DualPopulation } from './meshaleach-poc.js';

export type ConsentDataLayer = 'I' | 'II' | 'III' | 'IV' | 'V';

export type ConsentGrantStatus = 'active' | 'expired' | 'revoked';

export interface ConsentGrant {
  readonly schema_version: 'consent.v1';
  readonly grant_id?: string;
  readonly principal_id?: string;
  readonly principal_commitment?: string;
  readonly layer: ConsentDataLayer;
  readonly purpose: string;
  readonly granted_at: string;
  readonly expires_at?: string | null;
  readonly revoked_at?: string | null;
  readonly status: ConsentGrantStatus;
  readonly signature: string;
  readonly population: DualPopulation;
}

export const CONSENT_GRANT_SCHEMA_VERSION = 'consent.v1' as const;

export const CONSENT_DATA_LAYERS: readonly ConsentDataLayer[] = [
  'I',
  'II',
  'III',
  'IV',
  'V',
];
