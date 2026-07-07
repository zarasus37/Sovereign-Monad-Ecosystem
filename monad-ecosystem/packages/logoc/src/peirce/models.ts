/**
 * LOGOC classifier-domain types.
 *
 * The semiotic primitives (`PragmatismBand` / `CoarseMode` / `PeirceSignature`)
 * were relocated to @sovereign/types — they are the shared substrate both TTCL
 * and LOGOC derive from, so they live in the contracts package now. What remains
 * here is LOGOC-classifier-domain: the semiotic flags the classifier reads and
 * the `LogocEvent` envelope it produces. `LogocEvent.peirce` references the
 * relocated `PeirceSignature` via a type-only import (no runtime edge added —
 * logoc already depended on @sovereign/types for the numerics).
 */
import type { PeirceSignature } from "@sovereign/types";

export interface SemioticFlags {
  single_occurrence?: boolean;
  rule_based?: boolean;
  similarity?: boolean;
  causality?: boolean;
  convention?: boolean;
  possibility?: boolean;
  fact?: boolean;
  reason?: boolean;
}

export interface LogocEvent {
  schema_version: string; // Should be "LOGOC-Event-v5.2"
  event_id: string;
  timestamp: string;
  narrative?: string;
  semiotic_flags?: SemioticFlags;
  peirce?: PeirceSignature;
  peirce_migration_pending?: boolean;
  peirce_migration_source?: string;
}