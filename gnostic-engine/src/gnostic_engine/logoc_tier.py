"""Manifold-derived LOGOC tier producer (Layer 7.4).

Produces a TTCL tier (COHERENT / EMERGENT / DIVERGENT) from the neighbor
density around the classified ``sign_class_id`` on the Peirce manifold, then
maps it to a Lane B intensity weight. This replaces the prior passthrough
``logoc_tier`` annotation with a produced value the Stokes-Mueller Truth
lane actually weights itself by.

Density = ``len(manifold.neighbors(class_id, MAX_DISTANCE)) / 65`` (65 = the
66-class manifold minus self). Thresholds + Lane B weights come from the
canonical numerics ``ttcl_logoc_tier`` section (generated/numerics.py):
    COHERENT  ≥ 0.20 → lane_b_weight 1.00 (full Truth intensity)
    EMERGENT  ≥ 0.08 → lane_b_weight 0.70 (attenuated)
    DIVERGENT  else  → lane_b_weight 0.40 (hard attenuation)
"""
from __future__ import annotations

from typing import Literal, Tuple

from .classification import get_manifold
from .generated.numerics import (
    COHERENT_DENSITY_THRESHOLD,
    EMERGENT_DENSITY_THRESHOLD,
    COHERENT_LANE_B_WEIGHT,
    EMERGENT_LANE_B_WEIGHT,
    DIVERGENT_LANE_B_WEIGHT,
    TIER_NEIGHBOR_RADIUS,
)

LogocTier = Literal["COHERENT", "EMERGENT", "DIVERGENT"]

# The manifold has 66 classes; a class's neighbor set excludes itself, so the
# density denominator is 65 (max possible neighbors at any radius).
_MANIFOLD_SIZE_MINUS_SELF = 65


def produce_logoc_tier(class_id: int) -> Tuple[LogocTier, float]:
    """Return ``(tier_label, lane_b_weight)`` for the given sign class.

    Raises ``KeyError`` on an unknown ``class_id`` — this is a producer, not a
    predicate; the orchestrator that calls it wraps the whole enrichment in a
    try/except so an unclassifiable packet degrades gracefully rather than
    failing the typed pipeline.
    """
    manifold = get_manifold()
    # Validate the class id (raises KeyError if unknown — caller's try/except).
    manifold.get(class_id)
    # Tier density uses its own radius (TIER_NEIGHBOR_RADIUS = 1.0), broader
    # than the classifier's tight MAX_DISTANCE (0.5) — see the canonical
    # numerics rationale for the calibration.
    neighbors = manifold.neighbors(class_id, TIER_NEIGHBOR_RADIUS)
    density = len(neighbors) / _MANIFOLD_SIZE_MINUS_SELF

    if density >= COHERENT_DENSITY_THRESHOLD:
        return "COHERENT", COHERENT_LANE_B_WEIGHT
    if density >= EMERGENT_DENSITY_THRESHOLD:
        return "EMERGENT", EMERGENT_LANE_B_WEIGHT
    return "DIVERGENT", DIVERGENT_LANE_B_WEIGHT


def neighbor_density(class_id: int) -> float:
    """Expose the raw density for observability / tests (not on the hot path)."""
    manifold = get_manifold()
    manifold.get(class_id)
    return len(manifold.neighbors(class_id, TIER_NEIGHBOR_RADIUS)) / _MANIFOLD_SIZE_MINUS_SELF