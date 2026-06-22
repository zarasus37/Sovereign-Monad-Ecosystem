"""
Migration tests: legacy v5.1 events -> v5.2.
Ensures backward compatibility and graceful promotion of legacy shapes.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.classifier import PeirceClassifier
from peirce.models import LogocEvent, SemioticFlags


def test_legacy_v5_1_event_without_semiotic_flags():
    """A v5.1 event lacked explicit semiotic_flags; classifier should use heuristic fallback."""
    classifier = PeirceClassifier()
    legacy = LogocEvent(
        schema_version="LOGOC-Event-v5.1",
        event_id="legacy_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="A single token event with causal trace.",
    )
    annotated = classifier.annotate(legacy)
    # v5.1 events without flags should still classify via narrative heuristics
    assert annotated.peirce is not None or annotated.peirce_migration_pending


def test_legacy_v5_1_event_with_partial_flags():
    """A v5.1 event may have only rule_based and single_occurrence flags."""
    classifier = PeirceClassifier()
    legacy = LogocEvent(
        schema_version="LOGOC-Event-v5.1",
        event_id="legacy_002",
        timestamp="2026-06-19T00:00:00Z",
        narrative="rule-based convention",
        semiotic_flags=SemioticFlags(rule_based=True),
    )
    annotated = classifier.annotate(legacy)
    # rule_based -> Legisign, but missing object-relation and interpretant flags
    # may lead to heuristic fallback or ambiguity
    assert annotated.peirce is not None or annotated.peirce_migration_pending


def test_v5_1_to_v5_2_field_promotion():
    """After classification, a legacy event should carry the full v5.2 peirce block."""
    classifier = PeirceClassifier()
    legacy = LogocEvent(
        schema_version="LOGOC-Event-v5.1",
        event_id="legacy_003",
        timestamp="2026-06-19T00:00:00Z",
        narrative="rule law convention therefore theorem",
        semiotic_flags=SemioticFlags(rule_based=True, convention=True, reason=True),
    )
    annotated = classifier.annotate(legacy)
    assert annotated.peirce is not None
    assert annotated.peirce.sign_class_id == 42  # Legisign-Symbol-Argument
    assert annotated.schema_version == "LOGOC-Event-v5.1"  # schema_version is not mutated by classifier
    assert annotated.peirce_migration_pending is False
    assert annotated.peirce_migration_source is None


def test_v5_1_ambiguous_event_migration_pending():
    """A v5.1 event with no usable features should be marked pending, not crash."""
    classifier = PeirceClassifier()
    legacy = LogocEvent(
        schema_version="LOGOC-Event-v5.1",
        event_id="legacy_004",
        timestamp="2026-06-19T00:00:00Z",
        narrative="completely unclassifiable content xyz123",
        semiotic_flags=SemioticFlags(),
    )
    annotated = classifier.annotate(legacy)
    assert annotated.peirce_migration_pending is True
    assert annotated.peirce is None
    assert annotated.peirce_migration_source == "heuristic_v1_pending"


def test_v5_2_event_preserves_full_schema():
    """A native v5.2 event must retain all fields after annotation."""
    classifier = PeirceClassifier()
    event = LogocEvent(
        schema_version="LOGOC-Event-v5.2",
        event_id="v52_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="this single event is a causal fact",
        semiotic_flags=SemioticFlags(single_occurrence=True, causality=True, fact=True),
    )
    annotated = classifier.annotate(event)
    assert annotated.peirce is not None
    assert annotated.schema_version == "LOGOC-Event-v5.2"
    assert annotated.event_id == "v52_001"
    assert "causal" in annotated.narrative.lower()


def test_migration_preserves_event_id_and_timestamp():
    """Regardless of classification success, event_id and timestamp must be preserved."""
    classifier = PeirceClassifier()
    for narrative in ["valid rule-based argument", "unclassifiable xyz123"]:
        event = LogocEvent(
            event_id="preserve_test",
            timestamp="2026-01-01T12:00:00Z",
            narrative=narrative,
            semiotic_flags=SemioticFlags(rule_based=True, reason=True) if "rule" in narrative else SemioticFlags(),
        )
        annotated = classifier.annotate(event)
        assert annotated.event_id == "preserve_test"
        assert annotated.timestamp == "2026-01-01T12:00:00Z"
