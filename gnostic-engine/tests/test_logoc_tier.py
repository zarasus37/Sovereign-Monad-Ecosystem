"""Tests for the manifold-derived LOGOC tier producer (Layer 7.4).

Pins the COHERENT/EMERGENT/DIVERGENT density thresholds, the Lane B weight
mapping, and the non-degenerate spread across the canonical 66-class manifold.
The tier radius (1.0) is deliberately broader than the classifier's tight
MAX_DISTANCE (0.5) — see the canonical numerics rationale.
"""
from __future__ import annotations

import pytest

from gnostic_engine.classification import get_manifold
from gnostic_engine.generated.numerics import (
    COHERENT_DENSITY_THRESHOLD,
    EMERGENT_DENSITY_THRESHOLD,
    COHERENT_LANE_B_WEIGHT,
    EMERGENT_LANE_B_WEIGHT,
    DIVERGENT_LANE_B_WEIGHT,
    TIER_NEIGHBOR_RADIUS,
)
from gnostic_engine.logoc_tier import neighbor_density, produce_logoc_tier

MANIFOLD = get_manifold()

# Example class ids per tier, observed on the canonical 66-class manifold at
# TIER_NEIGHBOR_RADIUS (1.0). Pinned so a regression in the distance metric or
# radius is caught; the density-invariant assertions below guard the contract.
_COHERENT_IDS = [1, 8]
_EMERGENT_IDS = [3, 4]
_DIVERGENT_IDS = [0, 2]


# ── Thresholds + radius from canonical numerics ─────────────────────────────

def test_canonical_thresholds_loaded():
    assert COHERENT_DENSITY_THRESHOLD == pytest.approx(0.20)
    assert EMERGENT_DENSITY_THRESHOLD == pytest.approx(0.08)
    assert TIER_NEIGHBOR_RADIUS == pytest.approx(1.0)


def test_lane_b_weights_loaded():
    assert COHERENT_LANE_B_WEIGHT == pytest.approx(1.0)
    assert EMERGENT_LANE_B_WEIGHT == pytest.approx(0.7)
    assert DIVERGENT_LANE_B_WEIGHT == pytest.approx(0.4)


# ── Tier mapping ─────────────────────────────────────────────────────────────

def test_coherent_examples():
    for cid in _COHERENT_IDS:
        tier, weight = produce_logoc_tier(cid)
        assert tier == "COHERENT"
        assert weight == pytest.approx(COHERENT_LANE_B_WEIGHT)
        assert neighbor_density(cid) >= COHERENT_DENSITY_THRESHOLD


def test_emergent_examples():
    for cid in _EMERGENT_IDS:
        tier, weight = produce_logoc_tier(cid)
        assert tier == "EMERGENT"
        assert weight == pytest.approx(EMERGENT_LANE_B_WEIGHT)
        d = neighbor_density(cid)
        assert EMERGENT_DENSITY_THRESHOLD <= d < COHERENT_DENSITY_THRESHOLD


def test_divergent_examples():
    for cid in _DIVERGENT_IDS:
        tier, weight = produce_logoc_tier(cid)
        assert tier == "DIVERGENT"
        assert weight == pytest.approx(DIVERGENT_LANE_B_WEIGHT)
        assert neighbor_density(cid) < EMERGENT_DENSITY_THRESHOLD


def test_tier_spread_is_non_degenerate():
    """All three tiers must be populated — guards against a degenerate
    all-one-tier calibration (the r=0.5 failure mode)."""
    from collections import Counter

    counts = Counter(produce_logoc_tier(c.id)[0] for c in MANIFOLD.all_classes())
    assert counts["COHERENT"] > 0
    assert counts["EMERGENT"] > 0
    assert counts["DIVERGENT"] > 0
    # Sanity band on the observed canonical spread (6 / 19 / 41).
    assert counts["COHERENT"] > counts["EMERGENT"] > counts["DIVERGENT"]


def test_density_in_unit_interval():
    for c in MANIFOLD.all_classes():
        d = neighbor_density(c.id)
        assert 0.0 <= d <= 1.0


# ── Error handling ───────────────────────────────────────────────────────────

def test_unknown_class_raises_keyerror():
    """The producer is not a predicate — it raises; the orchestrator wraps it."""
    with pytest.raises(KeyError):
        produce_logoc_tier(999_999)