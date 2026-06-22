"""
Tests for flag_extractor_v3 — domain-aware semiotic flag disambiguation.
Runs without pytest dependency using plain assertions.

P4 Narrative Purpose Detection:
- Distinguishes constitutive (event IS the subject) from illustrative
  (event is an example of a general principle) narratives.
- Eliminates false positives from narrative context.

Example:
  "The Battle of Austerlitz" (constitutive) → Class 2 (Sinsign-Index-Dicent)
  "Austerlitz 1805 demonstrates the principle..." (illustrative) → Class 5 (Legisign-Index-Dicent)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.flag_extractor_v3 import (
    clean_and_extract_flags,
    diagnose_flags,
    is_class2_candidate,
    analyze_class2_ambiguity,
)


# ---------------------------------------------------------------------------
# P4 — Narrative Purpose Detection Tests
# ---------------------------------------------------------------------------

def test_p4_austerlitz_constitutive_class2():
    """Austerlitz as a specific historical event → Class 2 (Sinsign-Index-Dicent)."""
    narrative = (
        "Napoleon's strategy at the Battle of Austerlitz in 1805 was decisive "
        "because the French army outmaneuvered the Austro-Russian forces, leading "
        "to a crushing victory that ended the Third Coalition."
    )
    flags = clean_and_extract_flags(narrative)
    diag = diagnose_flags(narrative)
    assert diag["narrative_purpose"] == "constitutive"
    assert diag["predicted_class"] == 2
    assert flags["single_occurrence"] is True
    assert flags["causality"] is True
    assert flags["fact"] is True
    assert flags["rule_based"] is False
    assert flags["convention"] is False
    assert flags["reason"] is False


def test_p4_austerlitz_illustrative_class5():
    """Austerlitz as an example of a general principle → Class 5 (Legisign-Index-Dicent)."""
    narrative = (
        "Austerlitz 1805 demonstrates the principle of concentration of force: "
        "the successful deployment of superior combat power at the decisive point "
        "consistently produces victory across all theaters of war."
    )
    flags = clean_and_extract_flags(narrative)
    diag = diagnose_flags(narrative)
    assert diag["narrative_purpose"] == "illustrative"
    assert diag["predicted_class"] == 5
    assert flags["rule_based"] is True
    assert flags["causality"] is True
    assert flags["fact"] is True
    assert flags["single_occurrence"] is False


def test_p4_waterloo_illustrative_class5():
    """Waterloo as an example of a general principle → Class 5."""
    narrative = (
        "Waterloo 1815 illustrates the general principle that overextension of "
        "supply lines inevitably leads to strategic defeat, a rule confirmed by "
        "countless campaigns throughout military history."
    )
    flags = clean_and_extract_flags(narrative)
    diag = diagnose_flags(narrative)
    assert diag["narrative_purpose"] == "illustrative"
    assert diag["predicted_class"] == 5
    assert flags["rule_based"] is True
    assert flags["single_occurrence"] is False


def test_p4_waterloo_constitutive_class2():
    """Waterloo as a specific event → Class 2."""
    narrative = (
        "At Waterloo in 1815, Wellington held his ground because the Prussian "
        "army arrived at the critical moment and tipped the balance, producing a "
        "decisive victory for the Allied coalition."
    )
    flags = clean_and_extract_flags(narrative)
    diag = diagnose_flags(narrative)
    assert diag["narrative_purpose"] == "constitutive"
    assert diag["predicted_class"] == 2
    assert flags["single_occurrence"] is True
    assert flags["causality"] is True
    assert flags["fact"] is True


def test_p4_general_principle_class5():
    """General principle without any historical event → Class 5 (Legisign-Index-Dicent)."""
    narrative = (
        "The principle of concentration of force states that for all military "
        "engagements, success requires the assembly of superior combat power at "
        "the decisive point. This rule applies universally across all theaters of war."
    )
    flags = clean_and_extract_flags(narrative)
    diag = diagnose_flags(narrative)
    assert diag["narrative_purpose"] == "general"
    assert diag["predicted_class"] == 5
    assert flags["rule_based"] is True
    assert flags["single_occurrence"] is False


def test_p4_illustrative_with_meta_discourse():
    """Illustrative framing with meta-discourse markers → Class 5."""
    narrative = (
        "From a strategic perspective, the Battle of Austerlitz 1805 proves the "
        "universal rule that interior lines of operation enable the commander to "
        "defeat a numerically superior force by concentrating against isolated fractions "
        "of the enemy army in succession."
    )
    diag = diagnose_flags(narrative)
    assert diag["narrative_purpose"] == "illustrative"
    assert diag["predicted_class"] == 5


def test_p4_experiment_constitutive_class2():
    """Specific experiment as constitutive event → Class 2."""
    narrative = (
        "In the 1887 Michelson-Morley experiment, the interferometer was rotated "
        "to detect the aether wind, but no fringe shift was observed because the "
        "speed of light is invariant in all inertial frames."
    )
    flags = clean_and_extract_flags(narrative)
    diag = diagnose_flags(narrative)
    assert diag["narrative_purpose"] == "constitutive"
    assert diag["predicted_class"] == 2
    assert flags["single_occurrence"] is True
    assert flags["causality"] is True
    assert flags["fact"] is True


# ---------------------------------------------------------------------------
# V3 Legacy Tests (preserved)
# ---------------------------------------------------------------------------

def test_specific_historical_event_class2():
    """A specific historical event should be Sinsign-Index-Dicent (Class 2)."""
    narrative = (
        "Napoleon's strategy at the Battle of Austerlitz in 1805 was decisive "
        "because the French army outmaneuvered the Austro-Russian forces."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["single_occurrence"] is True
    assert flags["causality"] is True
    assert flags["fact"] is True
    assert flags["rule_based"] is False
    assert flags["convention"] is False
    assert flags["reason"] is False


def test_general_principle_class5():
    """A general principle should be Legisign-Index-Dicent (Class 5)."""
    narrative = (
        "The principle of concentration of force states that for all military engagements, "
        "success requires the assembly of superior combat power."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["rule_based"] is True
    assert flags["causality"] is True
    assert flags["fact"] is True
    assert flags["single_occurrence"] is False


def test_gnosis_recognition_class2():
    """A gnosis recognition moment should be Sinsign-Index-Dicent (Class 2)."""
    narrative = (
        "In that moment of recognition, I saw the structure of the system because "
        "the pattern suddenly revealed itself. This single flash of insight occurred "
        "during the meditation session."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["single_occurrence"] is True
    assert flags["causality"] is True
    assert flags["fact"] is True
    assert flags["rule_based"] is False
    assert flags["reason"] is False


def test_math_theorem_class8():
    """A mathematical theorem should be Legisign-Index-Argument (Class 8)."""
    narrative = (
        "The theorem states that if a set is closed and bounded, then it is compact. "
        "This follows because every open cover has a finite subcover, and therefore "
        "by logical necessity the property holds for all such sets."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["rule_based"] is True
    assert flags["reason"] is True
    assert flags["causality"] is True  # Default fallback for object relation
    assert flags["single_occurrence"] is False


def test_class2_candidate_detection():
    """is_class2_candidate should identify exact Class 2 profiles."""
    assert is_class2_candidate({
        "single_occurrence": True, "causality": True, "fact": True,
    }) is True
    assert is_class2_candidate({
        "single_occurrence": True, "causality": True, "fact": True,
        "rule_based": True,  # Dirty flag
    }) is True
    assert is_class2_candidate({
        "single_occurrence": True, "causality": True, "possibility": True,
    }) is False  # Missing fact


def test_ambiguity_analysis():
    """analyze_class2_ambiguity should diagnose conflicting flags."""
    result = analyze_class2_ambiguity({
        "single_occurrence": True, "causality": True, "fact": True,
        "rule_based": True, "reason": True,
    })
    assert result["is_candidate"] is True
    assert result["conflict_count"] == 2
    assert any(c["flag"] == "rule_based" for c in result["conflicts"])
    assert any(c["flag"] == "reason" for c in result["conflicts"])


def test_because_disambiguation_causal():
    """'because' in historical narrative should be causal, not inferential."""
    narrative = (
        "The Battle of Waterloo in 1815 was lost because the Prussian army arrived "
        "at the critical moment and tipped the balance."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["causality"] is True
    assert flags["reason"] is False


def test_because_disambiguation_inferential():
    """'because' in mathematical proof should be inferential, not causal."""
    narrative = (
        "The proof concludes because the base case holds and the inductive step "
        "is valid, therefore the theorem is true for all natural numbers."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["reason"] is True
    assert flags["causality"] is True  # Default fallback for object relation


def test_law_descriptive_not_legislative():
    """'law of gravity' in a historical observation should not trigger rule_based."""
    narrative = (
        "The law of gravity was demonstrated when the apple fell in 1666 at "
        "Woolsthorpe Manor, because Newton observed the specific causal chain "
        "in that single moment."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["single_occurrence"] is True
    assert flags["rule_based"] is False


def test_structure_descriptive_not_legislative():
    """'structure' in a gnosis recognition should not trigger rule_based."""
    narrative = (
        "I saw the structure of the system because the pattern suddenly revealed "
        "itself in that single flash of insight."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["single_occurrence"] is True
    assert flags["rule_based"] is False


def test_temporal_anchor_enforces_sinsign():
    """Dates and named events should strongly favor Sinsign."""
    narrative = (
        "In the 1887 Michelson-Morley experiment, the interferometer was rotated "
        "to detect the aether wind, but no fringe shift was observed."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["single_occurrence"] is True


def test_universal_quantifier_enforces_legisign():
    """'for all', 'always', 'necessarily' should strongly favor Legisign."""
    narrative = (
        "For all sets, if closed and bounded, then compact. This necessarily holds "
        "in all metric spaces."
    )
    flags = clean_and_extract_flags(narrative)
    assert flags["rule_based"] is True
    assert flags["single_occurrence"] is False


# ---------------------------------------------------------------------------
# Diagnostic API tests
# ---------------------------------------------------------------------------

def test_diagnose_flags_returns_purpose():
    """diagnose_flags should include narrative purpose and scores."""
    diag = diagnose_flags(
        "Austerlitz 1805 demonstrates the principle of concentration of force."
    )
    assert "narrative_purpose" in diag
    assert "purpose_detail" in diag
    assert "mode_scores" in diag
    assert "primary_mode" in diag
    assert "predicted_class" in diag


def test_diagnose_flags_class2_analysis():
    """diagnose_flags should include class2 ambiguity analysis."""
    diag = diagnose_flags(
        "In that moment of recognition, I saw the structure of the system because "
        "the pattern suddenly revealed itself."
    )
    assert "class2_analysis" in diag
    assert diag["class2_analysis"]["is_candidate"] is True


def run_all_tests():
    """Run all test functions and report results."""
    tests = [
        # P4 narrative purpose tests
        test_p4_austerlitz_constitutive_class2,
        test_p4_austerlitz_illustrative_class5,
        test_p4_waterloo_illustrative_class5,
        test_p4_waterloo_constitutive_class2,
        test_p4_general_principle_class5,
        test_p4_illustrative_with_meta_discourse,
        test_p4_experiment_constitutive_class2,
        # V3 legacy tests
        test_specific_historical_event_class2,
        test_general_principle_class5,
        test_gnosis_recognition_class2,
        test_math_theorem_class8,
        test_class2_candidate_detection,
        test_ambiguity_analysis,
        test_because_disambiguation_causal,
        test_because_disambiguation_inferential,
        test_law_descriptive_not_legislative,
        test_structure_descriptive_not_legislative,
        test_temporal_anchor_enforces_sinsign,
        test_universal_quantifier_enforces_legisign,
        # Diagnostic API tests
        test_diagnose_flags_returns_purpose,
        test_diagnose_flags_class2_analysis,
    ]

    passed = 0
    failed = 0
    print("=" * 70)
    print("FLAG EXTRACTOR V3 — P4 NARRATIVE PURPOSE DETECTION TEST SUITE")
    print("=" * 70)
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
    print("=" * 70)
    return failed == 0


if __name__ == "__main__":
    import sys
    sys.exit(0 if run_all_tests() else 1)
