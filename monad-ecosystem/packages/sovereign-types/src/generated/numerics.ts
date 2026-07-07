/**
 * @generated DO NOT EDIT — generated from shared/schemas/ttcl-numerics.json
 * @source shared/schemas/ttcl-numerics.json
 * by monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs.
 *
 * Canonical TTCL numerics for the TypeScript runtime (@sovereign/types) (Layer 3 — codegen).
 *
 * This file is generated wholesale from the JSON source of truth on every
 * gen-sign-types.mjs run. Drift (a hand-edit, or the JSON changing without a
 * re-run) is caught by `scripts/check-sign-types-drift.mjs`, which regenerates
 * this file into memory and diffs it against the committed copy.
 *
 * Edit shared/schemas/ttcl-numerics.json, then re-run:
 *   node monad-ecosystem/packages/ttcl/scripts/gen-sign-types.mjs
 * (numerics: no runtime hint — pure const, imported at module load.)
 */
// ── Types ────────────────────────────────────────────────────────────────────

/** Which runtime(s) own a constant. Matches the JSON `owner_runtime` array. */
export type OwnerRuntime = 'python' | 'ts';

/** One canonical numeric entry — matches the JSON leaf shape. */
export interface NumericEntry {
  readonly value: number;
  readonly unit: string;
  readonly sourceDoc: string;
  readonly rationale: string;
  readonly ownerRuntime: readonly OwnerRuntime[];
}

/** A named group of related constants — matches the JSON `sections[*]`. */
export interface NumericSection {
  readonly description: string;
  readonly constants: Readonly<Record<string, NumericEntry>>;
}

/** The full canonical numerics document — matches the JSON parity subset. */
export interface TTCLNumerics {
  readonly version: string;
  readonly sections: Readonly<Record<string, NumericSection>>;
}

// ── The single literal mirror ────────────────────────────────────────────────

export const TTCL_NUMERICS: TTCLNumerics = {
  version: "1.1.0",
  sections: {
    "gnostic_engine": {
      description: "Volumetric 4D Gnostic Engine (Python). Focal-lock threshold, Lane B blend, Lane C magnitude kill-switch, expanding-spin gate, blink budget, and TVL normalization ceiling.",
      constants: {
        "focal_lock_threshold": {
          value: 0.85,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:64",
          rationale: "Structural read at or above this locks focus (FOCAL_LOCK); below it blinks toward quarantine. The 0.85 FOCAL_LOCK threshold is the engine's primary integrity gate.",
          ownerRuntime: ["python"],
        },
        "boundary_threshold": {
          value: 0.65,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/api/routes.py:210-215",
          rationale: "Lane boundary: structural read >= 0.85 → LANE_A, >= 0.65 → LANE_B, else LANE_C. Adjacent-convergent zone begins here; below it the Dove Tier 1 monitor fires.",
          ownerRuntime: ["python"],
        },
        "lane_b_blend_raw_weight": {
          value: 0.5,
          unit: "weight",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:165",
          rationale: "Lane B intensity blends the raw truth score with the Bedrock V-mask density 50/50. Both weights must sum to 1.0.",
          ownerRuntime: ["python"],
        },
        "lane_b_blend_vmask_weight": {
          value: 0.5,
          unit: "weight",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:165",
          rationale: "Bedrock V-mask density weight in the Lane B blend. Paired with lane_b_blend_raw_weight (0.5 + 0.5 = 1.0).",
          ownerRuntime: ["python"],
        },
        "lane_c_kill_rhcp_spin": {
          value: 0.75,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:130",
          rationale: "Lane C magnitude kill-switch: RHCP spin above this with contagion active (W_CONG isolated=False) trips the kill-switch → MAGNITUDE_REJECT.",
          ownerRuntime: ["python"],
        },
        "lane_c_kill_host_ratio": {
          value: 0.25,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:134",
          rationale: "Lane C kill-switch: host coverage above this fraction trips the kill-switch (blast radius too wide on infrastructure).",
          ownerRuntime: ["python"],
        },
        "lane_c_kill_user_ratio": {
          value: 0.5,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:138",
          rationale: "Lane C kill-switch: user-base coverage above this fraction trips the kill-switch (blast radius too wide on users).",
          ownerRuntime: ["python"],
        },
        "spin_expanding_gate": {
          value: 0.5,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:229",
          rationale: "On a successful FOCAL_LOCK, spin (Lane C width) above this marks momentum EXPANDING; at or below it STABLE.",
          ownerRuntime: ["python"],
        },
        "max_blinks": {
          value: 3,
          unit: "count",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:64",
          rationale: "Consecutive blinks allowed before an agent is escalated from BLINK to QUARANTINE (cooldown exhausted).",
          ownerRuntime: ["python"],
        },
        "max_tvl_reference": {
          value: 500000000,
          unit: "usd",
          sourceDoc: "gnostic-engine/api/gnostic_bridge.py:37",
          rationale: "$500M TVL normalization ceiling used by the HEPAR bridge to log-normalize TVL into Lane A intensity.",
          ownerRuntime: ["python"],
        },
      },
    },
    "logoc_manifold": {
      description: "Peirce 66-class manifold geometry (shared by the TS runtime — @sovereign/types since the manifold relocation — and the Python reference mirror in @sovereign/logoc). Composite distance metric weights and the neighbor radius.",
      constants: {
        "weight_ring": {
          value: 0.4,
          unit: "weight",
          sourceDoc: "monad-ecosystem/packages/sovereign-types/src/peirce/manifold.ts:26",
          rationale: "Weight on the ring-radius delta in the composite sign-class distance metric. The three manifold weights sum to 1.0 (0.4 + 0.3 + 0.3).",
          ownerRuntime: ["ts", "python"],
        },
        "weight_angle": {
          value: 0.3,
          unit: "weight",
          sourceDoc: "monad-ecosystem/packages/sovereign-types/src/peirce/manifold.ts:27",
          rationale: "Weight on the angular-arc delta (shorter arc / 180°) in the composite distance metric.",
          ownerRuntime: ["ts", "python"],
        },
        "weight_hamming": {
          value: 0.3,
          unit: "weight",
          sourceDoc: "monad-ecosystem/packages/sovereign-types/src/peirce/manifold.ts:28",
          rationale: "Weight on the path Hamming distance in the composite distance metric.",
          ownerRuntime: ["ts", "python"],
        },
        "max_distance": {
          value: 0.5,
          unit: "ratio",
          sourceDoc: "monad-ecosystem/packages/sovereign-types/src/peirce/manifold.ts:108",
          rationale: "Default neighbor radius: sign classes within this composite distance of a given class are considered neighbors.",
          ownerRuntime: ["ts", "python"],
        },
      },
    },
    "ttcl_constitution": {
      description: "TTCL constitution scorer (Layer 6) — the single scoring path. Five weighted criteria; total >= threshold passes. Canonical TS scorer in @sovereign/ttcl; Python mirror in gnostic_engine.constitution (Layer 7), parity-tested.",
      constants: {
        "c1_tripartite_weight": {
          value: 0.3,
          unit: "weight",
          sourceDoc: "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          rationale: "Weight for the tripartite criterion: does the sign's compose ancestry include all three domains (Theology/Technology/Cosmology)? The heaviest weight — triadic completeness is the core axiom.",
          ownerRuntime: ["ts", "python"],
        },
        "c2_logic_compression_weight": {
          value: 0.25,
          unit: "weight",
          sourceDoc: "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          rationale: "Weight for the logic-compression criterion: does the sign sit at HYBRID modality (compose output) vs a single mode? HYBRID=1.0, single-mode=0.5, PURE=0.0.",
          ownerRuntime: ["ts", "python"],
        },
        "c3_source_aligned_weight": {
          value: 0.25,
          unit: "weight",
          sourceDoc: "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          rationale: "Weight for the source-aligned criterion: trace.source present AND peirce validates against the LOGOC manifold.",
          ownerRuntime: ["ts", "python"],
        },
        "c4_epistemic_humility_weight": {
          value: 0.1,
          unit: "weight",
          sourceDoc: "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          rationale: "Weight for the epistemic-humility criterion: non-instinctual pragmatism band (FORMAL_THOUGHT=1.0, EXPERIENCE=0.5, INSTINCT=0.0).",
          ownerRuntime: ["ts", "python"],
        },
        "c5_no_rlhf_signal_weight": {
          value: 0.1,
          unit: "weight",
          sourceDoc: "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          rationale: "Weight for the no-RLHF-signal criterion: caller-set flag (default true) that no reinforcement-learning-from-human-feedback signal is present.",
          ownerRuntime: ["ts", "python"],
        },
        "pass_threshold": {
          value: 0.72,
          unit: "ratio",
          sourceDoc: "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:44",
          rationale: "Constitution pass threshold: weighted total at or above this passes. NOTE: docs/LOGOC_ASSESSMENT_HANDOFF.md:118 references a conflicting '25/25/25/15/10' weighting; the spec code (canonical) uses 30/25/25/10/10 at 0.72.",
          ownerRuntime: ["ts", "python"],
        },
      },
    },
    "ttcl_logoc_tier": {
      description: "Layer 7 — manifold-derived LOGOC tier. Produced by neighbors() density around the classified sign_class_id (COHERENT/EMERGENT/DIVERGENT), then mapped to a Lane B intensity weight so the Stokes-Mueller Truth lane weights itself by the TTCL tier instead of treating it as a passthrough annotation. The tier density uses its own radius (tier_neighbor_radius), broader than the LOGOC classifier's tight local MAX_DISTANCE (0.5) — embeddedness is measured over a wider neighborhood than local sign adjacency.",
      constants: {
        "tier_neighbor_radius": {
          value: 1,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/logoc_tier.py",
          rationale: "Composite-distance radius used to count neighbors for tier density. Deliberately broader than the logoc_manifold.max_distance (0.5, the classifier's tight local radius): at 0.5 every class is an island (≤3 neighbors), so the 0.20/0.08 density thresholds are unreachable and the tier is degenerate. At 1.0 the neighbor-count spread (3..23 → density 0.046..0.354) lands the thresholds cleanly: ~6 DIVERGENT / ~19 EMERGENT / ~41 COHERENT across the 66 classes. Calibration verified on the canonical manifold.",
          ownerRuntime: ["python", "ts"],
        },
        "coherent_density_threshold": {
          value: 0.2,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/logoc_tier.py",
          rationale: "Neighbor density (neighbors / 65) at or above this marks the class COHERENT — tightly embedded on the manifold, well-anchored, full Lane B weight. Density is measured via manifold.neighbors(class_id, tier_neighbor_radius).",
          ownerRuntime: ["python", "ts"],
        },
        "emergent_density_threshold": {
          value: 0.08,
          unit: "ratio",
          sourceDoc: "gnostic-engine/src/gnostic_engine/logoc_tier.py",
          rationale: "Neighbor density at or above this (but below coherent) marks the class EMERGENT — partially anchored, attenuated Lane B weight. Below this the class is DIVERGENT.",
          ownerRuntime: ["python", "ts"],
        },
        "coherent_lane_b_weight": {
          value: 1,
          unit: "weight",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py",
          rationale: "Lane B intensity multiplier for a COHERENT classification. 1.0 preserves the full 0.5*raw + 0.5*vmask blend — a well-anchored sign may pin a high truth score.",
          ownerRuntime: ["python"],
        },
        "emergent_lane_b_weight": {
          value: 0.7,
          unit: "weight",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py",
          rationale: "Lane B intensity multiplier for an EMERGENT classification. Attenuates Truth intensity — a partially-anchored sign should not lock focus as strongly.",
          ownerRuntime: ["python"],
        },
        "divergent_lane_b_weight": {
          value: 0.4,
          unit: "weight",
          sourceDoc: "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py",
          rationale: "Lane B intensity multiplier for a DIVERGENT classification. Hard attenuation — an isolated/island classification should not drive a high truth score even if raw inputs look strong.",
          ownerRuntime: ["python"],
        },
      },
    },
    "ttcl_pps": {
      description: "Primary Parameter Schema sync bands — the per-emission runtime position on the manifold ring. static / heap / volatile.",
      constants: {
        "static_band": {
          value: 1,
          unit: "ratio",
          sourceDoc: "docs/LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md:94",
          rationale: "Static PPS band: fully synchronized, structural-read stable. The tightest sync point.",
          ownerRuntime: ["ts"],
        },
        "heap_band": {
          value: 0.65,
          unit: "ratio",
          sourceDoc: "docs/LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md:94",
          rationale: "Heap PPS band: adjacent-convergent zone. Matches the Gnostic Engine boundary_threshold (0.65).",
          ownerRuntime: ["ts"],
        },
        "volatile_band": {
          value: 0.3,
          unit: "ratio",
          sourceDoc: "docs/LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md:94",
          rationale: "Volatile PPS band: pattern-following / quarantine zone. The loosest sync point before structural rejection.",
          ownerRuntime: ["ts"],
        },
      },
    },
    "gnosis_plurality": {
      description: "gnosis-core plurality Dove emitter — Axiom 9 personality-diversity guardrails.",
      constants: {
        "plurality_threshold": {
          value: 0.6,
          unit: "ratio",
          sourceDoc: "monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts:53",
          rationale: "Diversity index at or above this marks a population plural (isPlural). Also the scheduler default threshold.",
          ownerRuntime: ["ts"],
        },
        "min_representation_guardrail": {
          value: 0.1,
          unit: "ratio",
          sourceDoc: "monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts:129",
          rationale: "minRepresentationRatio below this trips the monoculture guardrail (rarest archetype >10× less common than the most common).",
          ownerRuntime: ["ts"],
        },
        "dominant_majority_guardrail": {
          value: 0.6,
          unit: "ratio",
          sourceDoc: "monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts:116",
          rationale: "A single archetype exceeding this fraction of the population trips the monoculture guardrail.",
          ownerRuntime: ["ts"],
        },
        "healthy_min_representation": {
          value: 0.2,
          unit: "ratio",
          sourceDoc: "monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts:152",
          rationale: "minRepresentationRatio at or above this (with isPlural) for two consecutive snapshots emits the healthy-diversity Tier 1 signal.",
          ownerRuntime: ["ts"],
        },
      },
    },
  },
};

// ── Flat named exports (derived from the single literal above) ─────────────
// Consumers import these. They are read-only references into TTCL_NUMERICS;
// the drift guard guarantees the literal above matches the JSON, so these
// transitively match the JSON too.

// gnostic_engine
export const FOCAL_LOCK_THRESHOLD =
  TTCL_NUMERICS.sections.gnostic_engine.constants.focal_lock_threshold.value;
export const BOUNDARY_THRESHOLD =
  TTCL_NUMERICS.sections.gnostic_engine.constants.boundary_threshold.value;
export const LANE_B_BLEND_RAW_WEIGHT =
  TTCL_NUMERICS.sections.gnostic_engine.constants.lane_b_blend_raw_weight.value;
export const LANE_B_BLEND_VMASK_WEIGHT =
  TTCL_NUMERICS.sections.gnostic_engine.constants.lane_b_blend_vmask_weight.value;
export const LANE_C_KILL_RHCP_SPIN =
  TTCL_NUMERICS.sections.gnostic_engine.constants.lane_c_kill_rhcp_spin.value;
export const LANE_C_KILL_HOST_RATIO =
  TTCL_NUMERICS.sections.gnostic_engine.constants.lane_c_kill_host_ratio.value;
export const LANE_C_KILL_USER_RATIO =
  TTCL_NUMERICS.sections.gnostic_engine.constants.lane_c_kill_user_ratio.value;
export const SPIN_EXPANDING_GATE =
  TTCL_NUMERICS.sections.gnostic_engine.constants.spin_expanding_gate.value;
export const MAX_BLINKS =
  TTCL_NUMERICS.sections.gnostic_engine.constants.max_blinks.value;
export const MAX_TVL_REFERENCE =
  TTCL_NUMERICS.sections.gnostic_engine.constants.max_tvl_reference.value;

// logoc_manifold
export const MANIFOLD_WEIGHT_RING =
  TTCL_NUMERICS.sections.logoc_manifold.constants.weight_ring.value;
export const MANIFOLD_WEIGHT_ANGLE =
  TTCL_NUMERICS.sections.logoc_manifold.constants.weight_angle.value;
export const MANIFOLD_WEIGHT_HAMMING =
  TTCL_NUMERICS.sections.logoc_manifold.constants.weight_hamming.value;
export const MANIFOLD_MAX_DISTANCE =
  TTCL_NUMERICS.sections.logoc_manifold.constants.max_distance.value;

// ttcl_constitution
export const CONSTITUTION_C1_TRIPARTITE_WEIGHT =
  TTCL_NUMERICS.sections.ttcl_constitution.constants.c1_tripartite_weight.value;
export const CONSTITUTION_C2_LOGIC_COMPRESSION_WEIGHT =
  TTCL_NUMERICS.sections.ttcl_constitution.constants.c2_logic_compression_weight.value;
export const CONSTITUTION_C3_SOURCE_ALIGNED_WEIGHT =
  TTCL_NUMERICS.sections.ttcl_constitution.constants.c3_source_aligned_weight.value;
export const CONSTITUTION_C4_EPISTEMIC_HUMILITY_WEIGHT =
  TTCL_NUMERICS.sections.ttcl_constitution.constants.c4_epistemic_humility_weight.value;
export const CONSTITUTION_C5_NO_RLHF_SIGNAL_WEIGHT =
  TTCL_NUMERICS.sections.ttcl_constitution.constants.c5_no_rlhf_signal_weight.value;
export const CONSTITUTION_PASS_THRESHOLD =
  TTCL_NUMERICS.sections.ttcl_constitution.constants.pass_threshold.value;

// ttcl_logoc_tier
export const LOGOC_TIER_NEIGHBOR_RADIUS =
  TTCL_NUMERICS.sections.ttcl_logoc_tier.constants.tier_neighbor_radius.value;
export const LOGOC_TIER_COHERENT_DENSITY_THRESHOLD =
  TTCL_NUMERICS.sections.ttcl_logoc_tier.constants.coherent_density_threshold.value;
export const LOGOC_TIER_EMERGENT_DENSITY_THRESHOLD =
  TTCL_NUMERICS.sections.ttcl_logoc_tier.constants.emergent_density_threshold.value;
export const LOGOC_TIER_COHERENT_LANE_B_WEIGHT =
  TTCL_NUMERICS.sections.ttcl_logoc_tier.constants.coherent_lane_b_weight.value;
export const LOGOC_TIER_EMERGENT_LANE_B_WEIGHT =
  TTCL_NUMERICS.sections.ttcl_logoc_tier.constants.emergent_lane_b_weight.value;
export const LOGOC_TIER_DIVERGENT_LANE_B_WEIGHT =
  TTCL_NUMERICS.sections.ttcl_logoc_tier.constants.divergent_lane_b_weight.value;

// ttcl_pps
export const PPS_STATIC_BAND =
  TTCL_NUMERICS.sections.ttcl_pps.constants.static_band.value;
export const PPS_HEAP_BAND =
  TTCL_NUMERICS.sections.ttcl_pps.constants.heap_band.value;
export const PPS_VOLATILE_BAND =
  TTCL_NUMERICS.sections.ttcl_pps.constants.volatile_band.value;

// gnosis_plurality
export const PLURALITY_THRESHOLD =
  TTCL_NUMERICS.sections.gnosis_plurality.constants.plurality_threshold.value;
export const MIN_REPRESENTATION_GUARDRAIL =
  TTCL_NUMERICS.sections.gnosis_plurality.constants.min_representation_guardrail.value;
export const DOMINANT_MAJORITY_GUARDRAIL =
  TTCL_NUMERICS.sections.gnosis_plurality.constants.dominant_majority_guardrail.value;
export const HEALTHY_MIN_REPRESENTATION =
  TTCL_NUMERICS.sections.gnosis_plurality.constants.healthy_min_representation.value;
