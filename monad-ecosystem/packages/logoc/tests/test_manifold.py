"""
Tests for PeirceManifold integrity.
All 66 sign classes must be present, uniquely keyed, have weights summing to 1.0,
and have matching pragmatism bands.
"""
import pytest
from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.manifold import PeirceManifold, PeirceSignClass

# Canonical 66-class table relocated to shared/peirce-spec/ (repo-root shared/).
# parents[4]: tests → logoc → packages → monad-ecosystem → repo root.
SPEC_PATH = Path(__file__).resolve().parents[4] / "shared" / "peirce-spec" / "peirce_sign_classes.json"


@pytest.fixture(scope="module")
def manifold():
    return PeirceManifold(SPEC_PATH)


def test_all_66_classes_present(manifold: PeirceManifold):
    """All IDs from 0 to 65 must exist."""
    all_classes = manifold.all_classes()
    ids = {c.id for c in all_classes}
    assert len(ids) == 66, f"Expected 66 unique IDs, got {len(ids)}"
    assert ids == set(range(66)), f"Missing IDs: {set(range(66)) - ids}"


def test_no_duplicate_labels(manifold: PeirceManifold):
    """Labels are unique."""
    labels = [c.label for c in manifold.all_classes()]
    assert len(labels) == len(set(labels)), "Duplicate labels found"


def test_weight_invariant(manifold: PeirceManifold):
    """firstness + secondness + thirdness must sum to 1.0 (within epsilon)."""
    for c in manifold.all_classes():
        total = c.firstness_weight + c.secondness_weight + c.thirdness_weight
        assert abs(total - 1.0) < 1e-4, (
            f"Class {c.id} ({c.label}) weights sum to {total:.6f}, expected 1.0"
        )


def test_path_resolves_back_to_id(manifold: PeirceManifold):
    """Every class should resolve from its own path."""
    for c in manifold.all_classes():
        resolved = manifold.lookup_by_path(c.path)
        assert resolved.id == c.id, (
            f"Path {c.path} resolved to {resolved.id}, expected {c.id}"
        )


def test_pragmatism_band_distribution(manifold: PeirceManifold):
    """No band should be completely absent."""
    for band in ["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"]:
        members = manifold.in_band(band)
        assert len(members) > 0, f"Band '{band}' has no members"


def test_distance_metric_is_symmetric(manifold: PeirceManifold):
    """Distance must be symmetric."""
    classes = manifold.all_classes()
    for a, b in [(classes[0], classes[42]), (classes[1], classes[8])]:
        assert abs(manifold.distance(a.id, b.id) - manifold.distance(b.id, a.id)) < 1e-9


def test_distance_self_is_zero(manifold: PeirceManifold):
    """Distance from a class to itself must be zero."""
    for c in manifold.all_classes():
        assert manifold.distance(c.id, c.id) == 0.0


def test_known_canonical_class_42(manifold: PeirceManifold):
    """Class 42 must be Legisign-Symbol-Argument in FORMAL_THOUGHT."""
    c = manifold.get(42)
    assert c.path == ["Legisign", "Symbol", "Argument"]
    assert c.pragmatism_band == "FORMAL_THOUGHT"
    assert c.thirdness_weight >= 0.4
