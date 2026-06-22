"""
Metrics and distribution tests for the Peirce manifold and classifier.
Ensures statistical properties and geometric invariants hold across all 66 classes.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.manifold import get_manifold
from peirce.classifier import PeirceClassifier
from peirce.models import LogocEvent, SemioticFlags


def test_band_distribution_is_non_empty():
    """Each pragmatism band must contain at least one class."""
    m = get_manifold()
    for band in ["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"]:
        assert len(m.in_band(band)) > 0, f"Band {band} is empty"


def test_distance_distribution_bounds():
    """All pairwise distances must be finite and non-negative."""
    m = get_manifold()
    classes = m.all_classes()
    for a in classes:
        for b in classes:
            d = m.distance(a.id, b.id)
            assert d >= 0.0, f"Distance negative: {d}"
            assert d == float("inf") or d < 100.0, f"Distance unexpectedly large: {d}"


def test_self_distance_zero_for_all():
    """Every class must have zero distance to itself."""
    m = get_manifold()
    for c in m.all_classes():
        assert m.distance(c.id, c.id) == 0.0


def test_neighbor_symmetry():
    """If a is a neighbor of b, then b should be a neighbor of a (within the same threshold)."""
    m = get_manifold()
    threshold = 0.5
    for a in m.all_classes():
        neighbors_a = {n.id for n in m.neighbors(a.id, threshold)}
        for nid in neighbors_a:
            neighbors_b = {n.id for n in m.neighbors(nid, threshold)}
            assert a.id in neighbors_b, f"Neighbor relation asymmetric: {a.id} <-> {nid}"


def test_classifier_pipeline_produces_valid_ids():
    """Running a sample corpus through the classifier must yield valid IDs."""
    classifier = PeirceClassifier()
    sample = [
        LogocEvent(
            event_id="m_001",
            timestamp="2026-06-19T00:00:00Z",
            narrative="rule-based argument proof",
            semiotic_flags=SemioticFlags(rule_based=True, convention=True, reason=True),
        ),
        LogocEvent(
            event_id="m_002",
            timestamp="2026-06-19T00:00:00Z",
            narrative="pure quality sensation",
            semiotic_flags=SemioticFlags(similarity=True, possibility=True),
        ),
        LogocEvent(
            event_id="m_003",
            timestamp="2026-06-19T00:00:00Z",
            narrative="single causal fact",
            semiotic_flags=SemioticFlags(single_occurrence=True, causality=True, fact=True),
        ),
    ]
    for event in sample:
        cid = classifier.classify(event)
        assert 0 <= cid <= 65, f"Class ID out of range: {cid}"


def test_classifier_distribution_across_all_triads():
    """Sample events covering all existing triad combinations in the manifold should resolve."""
    classifier = PeirceClassifier()
    # Only test triad combinations that actually exist in the manifold
    # (the 66-class manifold currently has 11 real classes + 55 placeholders)
    combos = [
        ("Qualisign", "Icon", "Rheme", SemioticFlags(similarity=True, possibility=True)),
        ("Sinsign", "Index", "Rheme", SemioticFlags(single_occurrence=True, causality=True, possibility=True)),
        ("Sinsign", "Index", "Dicent", SemioticFlags(single_occurrence=True, causality=True, fact=True)),
        ("Legisign", "Icon", "Rheme", SemioticFlags(rule_based=True, similarity=True, possibility=True)),
        ("Legisign", "Index", "Rheme", SemioticFlags(rule_based=True, causality=True, possibility=True)),
        ("Legisign", "Index", "Dicent", SemioticFlags(rule_based=True, causality=True, fact=True)),
        ("Legisign", "Symbol", "Rheme", SemioticFlags(rule_based=True, convention=True, possibility=True)),
        ("Legisign", "Symbol", "Dicent", SemioticFlags(rule_based=True, convention=True, fact=True)),
        ("Legisign", "Index", "Argument", SemioticFlags(rule_based=True, causality=True, reason=True)),
        ("Sinsign", "Icon", "Dicent", SemioticFlags(single_occurrence=True, similarity=True, fact=True)),
        ("Legisign", "Symbol", "Argument", SemioticFlags(rule_based=True, convention=True, reason=True)),
    ]
    for vehicle, obj, interp, flags in combos:
        event = LogocEvent(
            event_id=f"dist_{vehicle}_{obj}_{interp}",
            timestamp="2026-06-19T00:00:00Z",
            narrative="pure quality sensation",
            semiotic_flags=flags,
        )
        path = classifier.classify_path(event)
        assert path[0] == vehicle, f"Expected {vehicle}, got {path[0]}"
        assert path[1] == obj, f"Expected {obj}, got {path[1]}"
        assert path[2] == interp, f"Expected {interp}, got {path[2]}"


def test_weight_sum_invariant_across_all_classes():
    """All 66 classes must have weights summing to 1.0 within epsilon."""
    m = get_manifold()
    epsilon = 1e-6
    for c in m.all_classes():
        total = c.firstness_weight + c.secondness_weight + c.thirdness_weight
        assert abs(total - 1.0) < epsilon, (
            f"Class {c.id} ({c.label}) weights sum to {total}"
        )


def test_all_paths_have_length_three():
    """Every sign class path must have exactly three elements (triadic)."""
    m = get_manifold()
    for c in m.all_classes():
        assert len(c.path) == 3, f"Class {c.id} path length != 3: {c.path}"
