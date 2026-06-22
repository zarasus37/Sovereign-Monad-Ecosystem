export type PragmatismBand = "INSTINCT" | "EXPERIENCE" | "FORMAL_THOUGHT";
export type CoarseMode = "ICON" | "INDEX" | "SYMBOL";

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

export interface PeirceSignature {
  mode: CoarseMode;
  sign_class_id: number;
  sign_class_label: string;
  path: string[];
  firstness_weight: number;
  secondness_weight: number;
  thirdness_weight: number;
  pragmatism_band: PragmatismBand;
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
