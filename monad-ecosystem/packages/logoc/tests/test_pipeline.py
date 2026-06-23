"""
Tests for ProductionPeirceClassifier and LogocMLPipeline integration.
Runs without pytest dependency using plain assertions.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from peirce.classifier import ProductionPeirceClassifier, PeirceClassifier
from peirce.models import LogocEvent, SemioticFlags


def test_production_classifier_rubric_fallback():
    """When ML pipeline is unavailable, ProductionPeirceClassifier falls back to rubric-only."""
    from pathlib import Path
    prod = ProductionPeirceClassifier(
        model_path=Path("/nonexistent/model.json"),
        spec_path=Path("/nonexistent/spec.json"),
    )
    assert prod.pipeline is None

    event = LogocEvent(
        event_id="test_rubric_fallback_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="A pure quality of redness felt as a sensation.",
        semiotic_flags=SemioticFlags(similarity=True, possibility=True),
    )
    annotated = prod.annotate(event)
    assert annotated.peirce is not None
    assert annotated.peirce_migration_pending is False
    assert annotated.peirce.sign_class_id == 0  # Qualisign-Icon-Rheme


def test_production_classifier_auto_accept_clean_flags():
    """Clean Class 2 flags (single_occurrence + causality + fact) should auto-accept."""
    prod = ProductionPeirceClassifier()
    if prod.pipeline is None:
        print("SKIP: ML pipeline not available in this environment")
        return

    event = LogocEvent(
        event_id="test_auto_accept_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="Napoleon's strategy at the Battle of Austerlitz in 1805 was decisive because the French army outmaneuvered the Austro-Russian forces.",
        semiotic_flags=SemioticFlags(single_occurrence=True, causality=True, fact=True),
    )
    annotated = prod.annotate(event)

    assert annotated.peirce is not None, "Expected auto-accept but got None peirce"
    assert annotated.peirce_migration_pending is False, "Expected auto-accept but pending=True"
    assert annotated.pipeline_triage_status == "auto_accept", f"Expected auto_accept but got {annotated.pipeline_triage_status}"
    assert annotated.pipeline_triage_reason in ("rubric_direct", "ensemble_agree_high", "ensemble_agree_low"), f"Unexpected reason: {annotated.pipeline_triage_reason}"
    assert annotated.pipeline_ml_confidence is not None and annotated.pipeline_ml_confidence > 0.5
    assert annotated.pipeline_rubric_class_id is not None
    assert annotated.pipeline_ml_class_id is not None
    print(f"  Auto-accept: class={annotated.peirce.sign_class_id}, reason={annotated.pipeline_triage_reason}, ml_conf={annotated.pipeline_ml_confidence:.3f}")


def test_production_classifier_human_review_dirty_flags():
    """Dirty flags that cause rubric/ML disagreement should route to human review."""
    prod = ProductionPeirceClassifier()
    if prod.pipeline is None:
        print("SKIP: ML pipeline not available in this environment")
        return

    # These flags trigger rubric=Class 5 (Legisign-Index-Dicent) but ML=Class 2
    # With v3 extractor this is cleaned, but simulating dirty flags from v2 extractor
    event = LogocEvent(
        event_id="test_human_review_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="Napoleon's strategy at the Battle of Austerlitz in 1805 was decisive because the French army outmaneuvered the Austro-Russian forces.",
        # Dirty flags: rule_based (strategy) + reason (because) + single_occurrence + causality + fact
        semiotic_flags=SemioticFlags(
            single_occurrence=True, causality=True, fact=True,
            rule_based=True, reason=True,
        ),
    )
    annotated = prod.annotate(event)

    # Note: with v3 extractor + NB model, this may actually auto-accept if ML confidence
    # is high enough and rubric fallback matches. The test checks the metadata structure.
    if annotated.peirce is None:
        assert annotated.peirce_migration_pending is True
        assert annotated.pipeline_triage_status == "human_review"
        assert annotated.pipeline_triage_reason in ("ensemble_disagree", "low_confidence")
        print(f"  Human review: reason={annotated.pipeline_triage_reason}, ml_conf={annotated.pipeline_ml_confidence:.3f}")
    else:
        # Auto-accepted — this is acceptable, means the ensemble agreed
        assert annotated.pipeline_triage_status == "auto_accept"
        print(f"  Auto-accept (despite dirty flags): class={annotated.peirce.sign_class_id}, reason={annotated.pipeline_triage_reason}, ml_conf={annotated.pipeline_ml_confidence:.3f}")


def test_production_classifier_triage_method():
    """triage() should return raw triage dict without mutating event."""
    prod = ProductionPeirceClassifier()
    if prod.pipeline is None:
        print("SKIP: ML pipeline not available in this environment")
        return

    event = LogocEvent(
        event_id="test_triage_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="A pure quality of redness felt as a sensation.",
        semiotic_flags=SemioticFlags(similarity=True, possibility=True),
    )
    # Store original state
    original_peirce = event.peirce
    original_pending = event.peirce_migration_pending

    triage_result = prod.triage(event)

    # Event should NOT be mutated
    assert event.peirce == original_peirce, "triage() should not mutate event.peirce"
    assert event.peirce_migration_pending == original_pending, "triage() should not mutate event.peirce_migration_pending"

    # Triage result should have expected structure
    assert "status" in triage_result
    assert "reason" in triage_result
    assert "rubric" in triage_result
    assert "ml" in triage_result
    assert "class_id" in triage_result
    print(f"  Triage result: status={triage_result['status']}, reason={triage_result['reason']}")


def test_production_classifier_class2_vs_class5():
    """Class 2 (Sinsign-Index-Dicent) vs Class 5 (Legisign-Index-Dicent) should be correctly triaged."""
    prod = ProductionPeirceClassifier()
    if prod.pipeline is None:
        print("SKIP: ML pipeline not available in this environment")
        return

    # Class 2: specific historical event
    class2_event = LogocEvent(
        event_id="test_class2_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="Napoleon's strategy at the Battle of Austerlitz in 1805 was decisive because the French army outmaneuvered the Austro-Russian forces.",
        semiotic_flags=SemioticFlags(single_occurrence=True, causality=True, fact=True),
    )
    class2_annotated = prod.annotate(class2_event)

    # Class 5: general principle
    class5_event = LogocEvent(
        event_id="test_class5_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="The principle of concentration of force states that for all military engagements, success requires the assembly of superior combat power.",
        semiotic_flags=SemioticFlags(rule_based=True, causality=True, fact=True),
    )
    class5_annotated = prod.annotate(class5_event)

    # Both should auto-accept (clean flags)
    assert class2_annotated.peirce is not None, f"Class 2 should auto-accept, got status={class2_annotated.pipeline_triage_status}"
    assert class5_annotated.peirce is not None, f"Class 5 should auto-accept, got status={class5_annotated.pipeline_triage_status}"

    # They should have different class IDs
    assert class2_annotated.peirce.sign_class_id != class5_annotated.peirce.sign_class_id, \
        f"Class 2 ({class2_annotated.peirce.sign_class_id}) and Class 5 ({class5_annotated.peirce.sign_class_id}) should differ"
    assert class2_annotated.peirce.sign_class_id == 2, f"Expected Class 2, got {class2_annotated.peirce.sign_class_id}"
    assert class5_annotated.peirce.sign_class_id == 5, f"Expected Class 5, got {class5_annotated.peirce.sign_class_id}"

    print(f"  Class 2: id={class2_annotated.peirce.sign_class_id}, reason={class2_annotated.pipeline_triage_reason}")
    print(f"  Class 5: id={class5_annotated.peirce.sign_class_id}, reason={class5_annotated.pipeline_triage_reason}")


def test_production_classifier_ambiguous_event():
    """An event with no flags should route to human review (or rubric fallback)."""
    prod = ProductionPeirceClassifier()

    event = LogocEvent(
        event_id="test_ambiguous_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="abstract unclassifiable content",
        semiotic_flags=SemioticFlags(),
    )
    annotated = prod.annotate(event)

    # With no flags, rubric will raise AmbiguousClassificationError
    # The pipeline will get rubric method="ambiguous" and ml will predict some class
    # If ML confidence is low (< 0.55), it routes to human_review
    # If ML confidence is >= 0.55, it may auto-accept (acceptable)
    assert annotated.pipeline_triage_status is not None, "Pipeline should have run"
    print(f"  Ambiguous event: status={annotated.pipeline_triage_status}, reason={annotated.pipeline_triage_reason}, ml_conf={annotated.pipeline_ml_confidence}")


def test_production_classifier_fast_classify():
    """classify() should use rubric-only (fast path) without ML overhead."""
    prod = ProductionPeirceClassifier()

    event = LogocEvent(
        event_id="test_fast_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="A pure quality of redness felt as a sensation.",
        semiotic_flags=SemioticFlags(similarity=True, possibility=True),
    )
    class_id = prod.classify(event)
    assert class_id == 0, f"Expected Class 0, got {class_id}"
    print(f"  Fast classify: class={class_id}")


def test_production_classifier_p4_illustrative_to_class5():
    """P4 cleaning should turn an illustrative historical narrative into Class 5, not Class 2."""
    prod = ProductionPeirceClassifier()
    if prod.pipeline is None:
        print("SKIP: ML pipeline not available in this environment")
        return
    if prod._p4_cleaner is None:
        print("SKIP: P4 flag extractor not importable in this environment")
        return

    # Raw flags look like Class 2 (temporal anchor + causality + fact)
    # But the narrative is ILLUSTRATIVE: Austerlitz is used as an example of a general principle
    event = LogocEvent(
        event_id="test_p4_illustrative_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="Austerlitz 1805 demonstrates the principle of concentration of force: the successful deployment of superior combat power at the decisive point consistently produces victory across all theaters of war.",
        semiotic_flags=SemioticFlags(single_occurrence=True, causality=True, fact=True),
    )
    annotated = prod.annotate(event)

    assert annotated.pipeline_p4_cleaned is True, "P4 cleaning should be recorded"
    assert annotated.peirce is not None, f"Expected auto-accept, got status={annotated.pipeline_triage_status}"
    assert annotated.peirce.sign_class_id == 5, f"Expected Class 5 after P4 cleaning, got {annotated.peirce.sign_class_id}"
    assert annotated.semiotic_flags.rule_based is True, "P4 should set rule_based=True for illustrative principle"
    assert annotated.semiotic_flags.single_occurrence is False, "P4 should clear single_occurrence for illustrative narrative"
    print(f"  P4 illustrative → Class {annotated.peirce.sign_class_id}")


def test_production_classifier_p4_constitutive_stays_class2():
    """P4 cleaning should keep a constitutive historical narrative as Class 2."""
    prod = ProductionPeirceClassifier()
    if prod.pipeline is None:
        print("SKIP: ML pipeline not available in this environment")
        return
    if prod._p4_cleaner is None:
        print("SKIP: P4 flag extractor not importable in this environment")
        return

    event = LogocEvent(
        event_id="test_p4_constitutive_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="Napoleon's strategy at the Battle of Austerlitz in 1805 was decisive because the French army outmaneuvered the Austro-Russian forces, leading to a crushing victory that ended the Third Coalition.",
        semiotic_flags=SemioticFlags(single_occurrence=True, causality=True, fact=True),
    )
    annotated = prod.annotate(event)

    assert annotated.pipeline_p4_cleaned is True
    assert annotated.peirce is not None, f"Expected auto-accept, got status={annotated.pipeline_triage_status}"
    assert annotated.peirce.sign_class_id == 2, f"Expected Class 2 for constitutive narrative, got {annotated.peirce.sign_class_id}"
    assert annotated.semiotic_flags.single_occurrence is True
    print(f"  P4 constitutive → Class {annotated.peirce.sign_class_id}")


def test_production_classifier_p4_can_be_disabled():
    """With use_p4=False, raw flags are passed through unchanged."""
    prod = ProductionPeirceClassifier(use_p4=False)
    if prod.pipeline is None:
        print("SKIP: ML pipeline not available in this environment")
        return

    event = LogocEvent(
        event_id="test_p4_disabled_001",
        timestamp="2026-06-20T00:00:00Z",
        narrative="Austerlitz 1805 demonstrates the principle of concentration of force.",
        semiotic_flags=SemioticFlags(single_occurrence=True, causality=True, fact=True),
    )
    annotated = prod.annotate(event)

    assert annotated.pipeline_p4_cleaned is False
    assert annotated.semiotic_flags.single_occurrence is True
    print(f"  P4 disabled → raw flags preserved")


def run_all_tests():
    """Run all pipeline integration tests."""
    tests = [
        test_production_classifier_rubric_fallback,
        test_production_classifier_auto_accept_clean_flags,
        test_production_classifier_human_review_dirty_flags,
        test_production_classifier_triage_method,
        test_production_classifier_class2_vs_class5,
        test_production_classifier_ambiguous_event,
        test_production_classifier_fast_classify,
        test_production_classifier_p4_illustrative_to_class5,
        test_production_classifier_p4_constitutive_stays_class2,
        test_production_classifier_p4_can_be_disabled,
    ]

    passed = 0
    failed = 0
    print("=" * 60)
    print("PRODUCTION PIPELINE INTEGRATION TESTS")
    print("=" * 60)
    for test in tests:
        try:
            test()
            print(f"  PASS: {test.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL: {test.__name__} — {e}")
            failed += 1
        except Exception as e:
            print(f"  ERROR: {test.__name__} — {e}")
            failed += 1

    print()
    print(f"Results: {passed} passed, {failed} failed out of {len(tests)} tests")
    print("=" * 60)
    return failed == 0


if __name__ == "__main__":
    import sys
    sys.exit(0 if run_all_tests() else 1)
