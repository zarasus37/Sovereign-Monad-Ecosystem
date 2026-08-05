/**
 * Memory epoch commit — Phase 0 privacy vessel commitment.
 * Proves chain integrity without revealing epoch contents.
 * ZKP/SD later proves about commits (consent/envelope) without opening blobs.
 */

import type { DualPopulation } from './meshaleach-poc.js';
import type { ConsentDataLayer } from './consent-grant.js';

export interface MemoryEpochCommit {
  readonly schema_version: 'memory-epoch.v1';
  /** Commitment preferred for outward proofs (not clear principal_id). */
  readonly principal_commitment: string;
  readonly epoch_id: string;
  /** Previous epoch commit; null for genesis. */
  readonly prev_commit?: string | null;
  /** Hash/commitment of encrypted epoch payload + metadata. */
  readonly commit: string;
  readonly consent_layers: readonly ConsentDataLayer[];
  readonly purpose_tags: readonly string[];
  readonly created_at: string;
  readonly store_ops?: number;
  readonly recall_ops?: number;
  readonly signature: string;
  readonly population: DualPopulation;
}

export const MEMORY_EPOCH_SCHEMA_VERSION = 'memory-epoch.v1' as const;
