# @generated DO NOT EDIT — generated from shared/schemas/ttcl-numerics.json
# by monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs.
# Edit the JSON, then re-run: node monad-ecosystem/packages/ttcl/scripts/gen-numerics.mjs
"""
Canonical TTCL numerics for the Python LOGOC manifold mirror (Layer 4a).

Generated from shared/schemas/ttcl-numerics.json — the single source of truth.
Drift is caught by scripts/check-numeric-drift.mjs (regenerates + diffs).
"""
from __future__ import annotations

# ── logoc_manifold ──────────────────────────────────────────────────────────────────
WEIGHT_RING: float = 0.4
WEIGHT_ANGLE: float = 0.3
WEIGHT_HAMMING: float = 0.3
MAX_DISTANCE: float = 0.5


# ── Structured mirror (drift-check anchor; full canonical set) ───────────────
TTCL_NUMERICS = {
  "version": "1.1.0",
  "sections": {
    "gnostic_engine": {
      "description": "Volumetric 4D Gnostic Engine (Python). Focal-lock threshold, Lane B blend, Lane C magnitude kill-switch, expanding-spin gate, blink budget, and TVL normalization ceiling.",
      "constants": {
        "focal_lock_threshold": {
          "value": 0.85,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:64",
          "rationale": "Structural read at or above this locks focus (FOCAL_LOCK); below it blinks toward quarantine. The 0.85 FOCAL_LOCK threshold is the engine's primary integrity gate.",
          "owner_runtime": ["python"],
        },
        "boundary_threshold": {
          "value": 0.65,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/api/routes.py:210-215",
          "rationale": "Lane boundary: structural read >= 0.85 → LANE_A, >= 0.65 → LANE_B, else LANE_C. Adjacent-convergent zone begins here; below it the Dove Tier 1 monitor fires.",
          "owner_runtime": ["python"],
        },
        "lane_b_blend_raw_weight": {
          "value": 0.5,
          "unit": "weight",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:165",
          "rationale": "Lane B intensity blends the raw truth score with the Bedrock V-mask density 50/50. Both weights must sum to 1.0.",
          "owner_runtime": ["python"],
        },
        "lane_b_blend_vmask_weight": {
          "value": 0.5,
          "unit": "weight",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:165",
          "rationale": "Bedrock V-mask density weight in the Lane B blend. Paired with lane_b_blend_raw_weight (0.5 + 0.5 = 1.0).",
          "owner_runtime": ["python"],
        },
        "lane_c_kill_rhcp_spin": {
          "value": 0.75,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:130",
          "rationale": "Lane C magnitude kill-switch: RHCP spin above this with contagion active (W_CONG isolated=False) trips the kill-switch → MAGNITUDE_REJECT.",
          "owner_runtime": ["python"],
        },
        "lane_c_kill_host_ratio": {
          "value": 0.25,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:134",
          "rationale": "Lane C kill-switch: host coverage above this fraction trips the kill-switch (blast radius too wide on infrastructure).",
          "owner_runtime": ["python"],
        },
        "lane_c_kill_user_ratio": {
          "value": 0.5,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:138",
          "rationale": "Lane C kill-switch: user-base coverage above this fraction trips the kill-switch (blast radius too wide on users).",
          "owner_runtime": ["python"],
        },
        "spin_expanding_gate": {
          "value": 0.5,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:229",
          "rationale": "On a successful FOCAL_LOCK, spin (Lane C width) above this marks momentum EXPANDING; at or below it STABLE.",
          "owner_runtime": ["python"],
        },
        "max_blinks": {
          "value": 3,
          "unit": "count",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py:64",
          "rationale": "Consecutive blinks allowed before an agent is escalated from BLINK to QUARANTINE (cooldown exhausted).",
          "owner_runtime": ["python"],
        },
        "max_tvl_reference": {
          "value": 500000000,
          "unit": "usd",
          "source_doc": "gnostic-engine/api/gnostic_bridge.py:37",
          "rationale": "$500M TVL normalization ceiling used by the HEPAR bridge to log-normalize TVL into Lane A intensity.",
          "owner_runtime": ["python"],
        },
      },
    },
    "logoc_manifold": {
      "description": "Peirce 66-class manifold geometry (shared by the TS runtime — @sovereign/types since the manifold relocation — and the Python reference mirror in @sovereign/logoc). Composite distance metric weights and the neighbor radius.",
      "constants": {
        "weight_ring": {
          "value": 0.4,
          "unit": "weight",
          "source_doc": "monad-ecosystem/packages/sovereign-types/src/peirce/manifold.ts:26",
          "rationale": "Weight on the ring-radius delta in the composite sign-class distance metric. The three manifold weights sum to 1.0 (0.4 + 0.3 + 0.3).",
          "owner_runtime": ["ts","python"],
        },
        "weight_angle": {
          "value": 0.3,
          "unit": "weight",
          "source_doc": "monad-ecosystem/packages/sovereign-types/src/peirce/manifold.ts:27",
          "rationale": "Weight on the angular-arc delta (shorter arc / 180°) in the composite distance metric.",
          "owner_runtime": ["ts","python"],
        },
        "weight_hamming": {
          "value": 0.3,
          "unit": "weight",
          "source_doc": "monad-ecosystem/packages/sovereign-types/src/peirce/manifold.ts:28",
          "rationale": "Weight on the path Hamming distance in the composite distance metric.",
          "owner_runtime": ["ts","python"],
        },
        "max_distance": {
          "value": 0.5,
          "unit": "ratio",
          "source_doc": "monad-ecosystem/packages/sovereign-types/src/peirce/manifold.ts:108",
          "rationale": "Default neighbor radius: sign classes within this composite distance of a given class are considered neighbors.",
          "owner_runtime": ["ts","python"],
        },
      },
    },
    "ttcl_constitution": {
      "description": "TTCL constitution scorer (Layer 6) — the single scoring path. Five weighted criteria; total >= threshold passes. Canonical TS scorer in @sovereign/ttcl; Python mirror in gnostic_engine.constitution (Layer 7), parity-tested.",
      "constants": {
        "c1_tripartite_weight": {
          "value": 0.3,
          "unit": "weight",
          "source_doc": "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          "rationale": "Weight for the tripartite criterion: does the sign's compose ancestry include all three domains (Theology/Technology/Cosmology)? The heaviest weight — triadic completeness is the core axiom.",
          "owner_runtime": ["ts","python"],
        },
        "c2_logic_compression_weight": {
          "value": 0.25,
          "unit": "weight",
          "source_doc": "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          "rationale": "Weight for the logic-compression criterion: does the sign sit at HYBRID modality (compose output) vs a single mode? HYBRID=1.0, single-mode=0.5, PURE=0.0.",
          "owner_runtime": ["ts","python"],
        },
        "c3_source_aligned_weight": {
          "value": 0.25,
          "unit": "weight",
          "source_doc": "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          "rationale": "Weight for the source-aligned criterion: trace.source present AND peirce validates against the LOGOC manifold.",
          "owner_runtime": ["ts","python"],
        },
        "c4_epistemic_humility_weight": {
          "value": 0.1,
          "unit": "weight",
          "source_doc": "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          "rationale": "Weight for the epistemic-humility criterion: non-instinctual pragmatism band (FORMAL_THOUGHT=1.0, EXPERIENCE=0.5, INSTINCT=0.0).",
          "owner_runtime": ["ts","python"],
        },
        "c5_no_rlhf_signal_weight": {
          "value": 0.1,
          "unit": "weight",
          "source_doc": "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:13-44",
          "rationale": "Weight for the no-RLHF-signal criterion: caller-set flag (default true) that no reinforcement-learning-from-human-feedback signal is present.",
          "owner_runtime": ["ts","python"],
        },
        "pass_threshold": {
          "value": 0.72,
          "unit": "ratio",
          "source_doc": "theo-techno-cosmo/plex/CODE/preference_pair_generator_reference.py:44",
          "rationale": "Constitution pass threshold: weighted total at or above this passes. NOTE: docs/LOGOC_ASSESSMENT_HANDOFF.md:118 references a conflicting '25/25/25/15/10' weighting; the spec code (canonical) uses 30/25/25/10/10 at 0.72.",
          "owner_runtime": ["ts","python"],
        },
      },
    },
    "ttcl_logoc_tier": {
      "description": "Layer 7 — manifold-derived LOGOC tier. Produced by neighbors() density around the classified sign_class_id (COHERENT/EMERGENT/DIVERGENT), then mapped to a Lane B intensity weight so the Stokes-Mueller Truth lane weights itself by the TTCL tier instead of treating it as a passthrough annotation. The tier density uses its own radius (tier_neighbor_radius), broader than the LOGOC classifier's tight local MAX_DISTANCE (0.5) — embeddedness is measured over a wider neighborhood than local sign adjacency.",
      "constants": {
        "tier_neighbor_radius": {
          "value": 1,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/logoc_tier.py",
          "rationale": "Composite-distance radius used to count neighbors for tier density. Deliberately broader than the logoc_manifold.max_distance (0.5, the classifier's tight local radius): at 0.5 every class is an island (≤3 neighbors), so the 0.20/0.08 density thresholds are unreachable and the tier is degenerate. At 1.0 the neighbor-count spread (3..23 → density 0.046..0.354) lands the thresholds cleanly: ~6 DIVERGENT / ~19 EMERGENT / ~41 COHERENT across the 66 classes. Calibration verified on the canonical manifold.",
          "owner_runtime": ["python","ts"],
        },
        "coherent_density_threshold": {
          "value": 0.2,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/logoc_tier.py",
          "rationale": "Neighbor density (neighbors / 65) at or above this marks the class COHERENT — tightly embedded on the manifold, well-anchored, full Lane B weight. Density is measured via manifold.neighbors(class_id, tier_neighbor_radius).",
          "owner_runtime": ["python","ts"],
        },
        "emergent_density_threshold": {
          "value": 0.08,
          "unit": "ratio",
          "source_doc": "gnostic-engine/src/gnostic_engine/logoc_tier.py",
          "rationale": "Neighbor density at or above this (but below coherent) marks the class EMERGENT — partially anchored, attenuated Lane B weight. Below this the class is DIVERGENT.",
          "owner_runtime": ["python","ts"],
        },
        "coherent_lane_b_weight": {
          "value": 1,
          "unit": "weight",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py",
          "rationale": "Lane B intensity multiplier for a COHERENT classification. 1.0 preserves the full 0.5*raw + 0.5*vmask blend — a well-anchored sign may pin a high truth score.",
          "owner_runtime": ["python"],
        },
        "emergent_lane_b_weight": {
          "value": 0.7,
          "unit": "weight",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py",
          "rationale": "Lane B intensity multiplier for an EMERGENT classification. Attenuates Truth intensity — a partially-anchored sign should not lock focus as strongly.",
          "owner_runtime": ["python"],
        },
        "divergent_lane_b_weight": {
          "value": 0.4,
          "unit": "weight",
          "source_doc": "gnostic-engine/src/gnostic_engine/core/gnostic_engine.py",
          "rationale": "Lane B intensity multiplier for a DIVERGENT classification. Hard attenuation — an isolated/island classification should not drive a high truth score even if raw inputs look strong.",
          "owner_runtime": ["python"],
        },
      },
    },
    "ttcl_pps": {
      "description": "Primary Parameter Schema sync bands — the per-emission runtime position on the manifold ring. static / heap / volatile.",
      "constants": {
        "static_band": {
          "value": 1,
          "unit": "ratio",
          "source_doc": "docs/LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md:94",
          "rationale": "Static PPS band: fully synchronized, structural-read stable. The tightest sync point.",
          "owner_runtime": ["ts"],
        },
        "heap_band": {
          "value": 0.65,
          "unit": "ratio",
          "source_doc": "docs/LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md:94",
          "rationale": "Heap PPS band: adjacent-convergent zone. Matches the Gnostic Engine boundary_threshold (0.65).",
          "owner_runtime": ["ts"],
        },
        "volatile_band": {
          "value": 0.3,
          "unit": "ratio",
          "source_doc": "docs/LOGOC_DUAL_WHEEL_GNOSIS_ENGINE_SPEC_v5_1.md:94",
          "rationale": "Volatile PPS band: pattern-following / quarantine zone. The loosest sync point before structural rejection.",
          "owner_runtime": ["ts"],
        },
      },
    },
    "gnosis_plurality": {
      "description": "gnosis-core plurality Dove emitter — Axiom 9 personality-diversity guardrails.",
      "constants": {
        "plurality_threshold": {
          "value": 0.6,
          "unit": "ratio",
          "source_doc": "monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts:53",
          "rationale": "Diversity index at or above this marks a population plural (isPlural). Also the scheduler default threshold.",
          "owner_runtime": ["ts"],
        },
        "min_representation_guardrail": {
          "value": 0.1,
          "unit": "ratio",
          "source_doc": "monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts:129",
          "rationale": "minRepresentationRatio below this trips the monoculture guardrail (rarest archetype >10× less common than the most common).",
          "owner_runtime": ["ts"],
        },
        "dominant_majority_guardrail": {
          "value": 0.6,
          "unit": "ratio",
          "source_doc": "monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts:116",
          "rationale": "A single archetype exceeding this fraction of the population trips the monoculture guardrail.",
          "owner_runtime": ["ts"],
        },
        "healthy_min_representation": {
          "value": 0.2,
          "unit": "ratio",
          "source_doc": "monad-ecosystem/packages/gnosis-core/src/plurality/emitter.ts:152",
          "rationale": "minRepresentationRatio at or above this (with isPlural) for two consecutive snapshots emits the healthy-diversity Tier 1 signal.",
          "owner_runtime": ["ts"],
        },
      },
    },
  },
}
