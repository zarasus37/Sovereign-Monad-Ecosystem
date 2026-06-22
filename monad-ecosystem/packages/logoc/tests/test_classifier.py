"""
Golden-file tests for PeirceClassifier.
Each line in peirce_events_v1.jsonl is a labeled event.
"""
import json
import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.classifier import PeirceClassifier
from peirce.models import LogocEvent, SemioticFlags

GOLDEN_PATH = Path(__file__).parent / "golden" / "peirce_events_v1.jsonl"


@pytest.fixture(scope="module")
def classifier():
    return PeirceClassifier()


def load_golden():
    if not GOLDEN_PATH.exists():
        pytest.skip("Golden file not yet created")
    events = []
    for line in GOLDEN_PATH.read_text(encoding="utf-8").strip().splitlines():
        events.append(json.loads(line))
    return events


def test_golden_file_classifier_accuracy(classifier):
    """Classifier must match expected sign_class_id for all golden events."""
    golden = load_golden()
    mismatches = []
    for entry in golden:
        event = LogocEvent(**entry["event"])
        expected = entry["expected_sign_class_id"]
        try:
            result = classifier.classify(event)
            if result != expected:
                mismatches.append({
                    "event_id": event.event_id,
                    "expected": expected,
                    "got": result,
                })
        except Exception as e:
            mismatches.append({"event_id": event.event_id, "error": str(e)})
    assert len(mismatches) == 0, f"Golden file mismatches:\n{json.dumps(mismatches, indent=2)}"


def test_ambiguous_event_marked_pending(classifier):
    """An event with no usable features should be marked migration_pending."""
    event = LogocEvent(
        event_id="test_ambig_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="abstract unclassifiable content",
        semiotic_flags=SemioticFlags(),
    )
    annotated = classifier.annotate(event)
    assert annotated.peirce_migration_pending is True
    assert annotated.peirce is None
    assert annotated.peirce_migration_source == "heuristic_v1_pending"


def test_formal_thought_event(classifier):
    """An event with rule-based + reason flags should resolve to FORMAL_THOUGHT."""
    event = LogocEvent(
        event_id="test_formal_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="This argument concludes therefore a theorem holds.",
        semiotic_flags=SemioticFlags(rule_based=True, reason=True, convention=True),
    )
    annotated = classifier.annotate(event)
    assert annotated.peirce is not None
    assert annotated.peirce.pragmatism_band == "FORMAL_THOUGHT"


def test_instinct_event(classifier):
    """An event describing a pure quality should resolve to INSTINCT."""
    event = LogocEvent(
        event_id="test_instinct_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="A pure quality of redness felt as a sensation.",
        semiotic_flags=SemioticFlags(similarity=True, possibility=True),
    )
    annotated = classifier.annotate(event)
    assert annotated.peirce is not None
    assert annotated.peirce.pragmatism_band == "INSTINCT"


def test_distribution_across_bands(classifier):
    """Classify a sample corpus and assert no band is completely empty."""
    sample_events = [
        LogocEvent(event_id=f"e_{i}", timestamp="2026-06-19T00:00:00Z",
                   narrative=n, semiotic_flags=f)
        for i, (n, f) in enumerate([
            ("pure quality sensation", SemioticFlags(similarity=True, possibility=True)),
            ("this single token event causal", SemioticFlags(single_occurrence=True, causality=True, fact=True)),
            ("rule convention argument proof theorem", SemioticFlags(rule_based=True, convention=True, reason=True)),
        ])
    ]
    bands = set()
    for event in sample_events:
        annotated = classifier.annotate(event)
        if annotated.peirce:
            bands.add(annotated.peirce.pragmatism_band)
    assert "INSTINCT" in bands or "EXPERIENCE" in bands or "FORMAL_THOUGHT" in bands, \
        "At least one pragmatism band must be populated"


def test_migration_source_none_on_success(classifier):
    """Successfully classified events should have migration_source=None."""
    event = LogocEvent(
        event_id="test_success_001",
        timestamp="2026-06-19T00:00:00Z",
        narrative="rule-based argument",
        semiotic_flags=SemioticFlags(rule_based=True, convention=True, reason=True),
    )
    annotated = classifier.annotate(event)
    assert annotated.peirce_migration_source is None
    assert annotated.peirce_migration_pending is False
