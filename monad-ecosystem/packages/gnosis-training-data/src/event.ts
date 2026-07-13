/**
 * GnosisEvent — the data contract for one Layer 7 training sample.
 *
 * Mirrors the spec's event format verbatim
 * (`theo-techno-cosmo/plex/archive/TTCL_v1_0_BREAKDOWN.md:314-359`, Part 2: THE
 * GNOSIS EVENT FORMAT). The JSON Schema that enforces this shape lives at
 * `shared/ttcl-specs/gnosis-event.json` (the contract the spec anticipates but
 * never defined); the field names here match the schema, which matches the spec.
 *
 * Field naming follows the spec's snake_case (event_id, constitution_version,
 * wheel_state, active_slots, provenance_tokens, messages, constitution_score),
 * not the repo's usual camelCase — the JSONL is the artifact the future SFT
 * stage reads, and the spec is its contract.
 */

/** Per-wheel rotation snapshot. */
export interface GnosisWheelState {
  readonly offset: number;
  readonly key_hash: string;
}

/** One facet's active attribute. `label` is null until the Catalan-labels data asset lands. */
export interface GnosisActiveSlot {
  readonly wheel: string;
  readonly slot: string;
  readonly label: string | null;
}

/** A chat message in the training scaffold. */
export interface GnosisMessage {
  readonly role: "system" | "user" | "assistant";
  readonly content: string;
}

/** The 5-criterion constitution verdict (maps from @sovereign/ttcl ConstitutionResult). */
export interface GnosisConstitutionScore {
  readonly tripartite: number;
  readonly logic_compress: number;
  readonly source_aligned: number;
  readonly epistemic: number;
  readonly no_rlhf_signal: number;
  readonly total: number;
  readonly passes: boolean;
}

/** One Gnosis training event. */
export interface GnosisEvent {
  readonly event_id: string;
  readonly constitution_version: string;
  readonly wheel_state: Readonly<Record<string, GnosisWheelState>>;
  readonly active_slots: Readonly<{
    readonly theology: GnosisActiveSlot;
    readonly technology: GnosisActiveSlot;
    readonly cosmology: GnosisActiveSlot;
  }>;
  readonly provenance_tokens: readonly string[];
  readonly messages: readonly GnosisMessage[];
  readonly constitution_score: GnosisConstitutionScore;
}

/** Options for `generateGnosisEvents`. */
export interface GnosisEventConfig {
  /** Constitution version tag. Default `"v1"`. */
  readonly constitutionVersion?: string;
  /** Seed for deterministic derivation. Default `schedule.config.seed`. */
  readonly seed?: number;
  /** Include the initial seed step (move === "initial"). Default `true`. */
  readonly includeInitial?: boolean;
}