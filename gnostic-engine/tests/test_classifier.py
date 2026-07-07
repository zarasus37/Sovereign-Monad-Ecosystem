"""Tests for the Python heuristic classifier port (Layer 7.2).

Verifies the sys.path manifold seam (66 classes), the verbatim flag-then-
narrative triad decisions, ambiguity handling, and the annotate-swallow
contract that mirrors `logoc/src/peirce/classifier.ts`. These are the
Python-side pins; the cross-runtime parity corpus is asserted in the TS
integration test (`monad-ecosystem/tests/integration/classifier-parity.test.ts`).
"""
from __future__ import annotations

import pytest

from gnostic_engine.classification import (
    AmbiguousClassificationError,
    ClassifierInput,
    HeuristicClassifier,
    SemioticFlags,
    get_manifold,
    infer_coarse_mode,
)


# ── Manifold seam ────────────────────────────────────────────────────────────

def test_manifold_seam_loads_66_classes():
    """The sys.path proxy imports the canonical LOGOC manifold mirror."""
    manifold = get_manifold()
    assert len(manifold.all_classes()) == 66


def test_legisign_symbol_argument_is_class_42():
    """Anchor class id used by the parity corpus (canonical path)."""
    cls = get_manifold().lookup_by_path(["Legisign", "Symbol", "Argument"])
    assert cls.id == 42
    assert cls.pragmatism_band == "FORMAL_THOUGHT"


# ── Triad decisions: flag-driven ─────────────────────────────────────────────

@pytest.fixture
def classifier():
    return HeuristicClassifier()


def test_flag_driven_vehicle(classifier):
    # rule_based takes priority over single_occurrence (checked first in TS).
    ev = ClassifierInput(semiotic_flags=SemioticFlags(rule_based=True, single_occurrence=True))
    assert classifier._decide_vehicle(ev) == "Legisign"
    ev = ClassifierInput(semiotic_flags=SemioticFlags(single_occurrence=True))
    assert classifier._decide_vehicle(ev) == "Sinsign"


def test_flag_driven_object_relation(classifier):
    # convention > causality > similarity order (TS checks convention first).
    ev = ClassifierInput(semiotic_flags=SemioticFlags(convention=True))
    assert classifier._decide_object_relation(ev) == "Symbol"
    ev = ClassifierInput(semiotic_flags=SemioticFlags(causality=True))
    assert classifier._decide_object_relation(ev) == "Index"
    ev = ClassifierInput(semiotic_flags=SemioticFlags(similarity=True))
    assert classifier._decide_object_relation(ev) == "Icon"


def test_flag_driven_interpretant(classifier):
    # reason > fact > possibility order.
    ev = ClassifierInput(semiotic_flags=SemioticFlags(reason=True))
    assert classifier._decide_interpretant(ev) == "Argument"
    ev = ClassifierInput(semiotic_flags=SemioticFlags(fact=True))
    assert classifier._decide_interpretant(ev) == "Dicent"
    ev = ClassifierInput(semiotic_flags=SemioticFlags(possibility=True))
    assert classifier._decide_interpretant(ev) == "Rheme"


def test_full_flag_driven_classification(classifier):
    ev = ClassifierInput(
        semiotic_flags=SemioticFlags(rule_based=True, convention=True, reason=True)
    )
    assert classifier.classify_path(ev) == ["Legisign", "Symbol", "Argument"]
    assert classifier.classify(ev) == 42


# ── Triad decisions: narrative-driven (flags absent) ─────────────────────────

def test_narrative_driven_path(classifier):
    ev = ClassifierInput(
        narrative="this rule and law, a symbol in the language, an argument a proof"
    )
    assert classifier.classify_path(ev) == ["Legisign", "Symbol", "Argument"]


def test_narrative_lowercase_normalized(classifier):
    # TS lowercases the narrative before keyword matching.
    ev = ClassifierInput(narrative="A RULE OF LAW, a SYMBOL, an ARGUMENT")
    assert classifier.classify_path(ev) == ["Legisign", "Symbol", "Argument"]


def test_missing_flags_fall_through_to_narrative(classifier):
    # Flags present but none in this triad → narrative still consulted.
    ev = ClassifierInput(
        narrative="a convention of law, pointer trace, a true fact assertion",
        semiotic_flags=SemioticFlags(),  # no flags set
    )
    path = classifier.classify_path(ev)
    assert path == ["Legisign", "Index", "Dicent"]


# ── Ambiguity ────────────────────────────────────────────────────────────────

def test_blank_event_raises_on_classify_path(classifier):
    ev = ClassifierInput(narrative="totally unrelated blank words")
    with pytest.raises(AmbiguousClassificationError):
        classifier.classify_path(ev)


def test_annotate_swallows_ambiguity_and_marks_pending(classifier):
    ev = ClassifierInput(narrative="totally unrelated blank words")
    out = classifier.annotate(ev)
    assert out is ev  # mutate-and-return, like the TS annotate
    assert out.peirce is None
    assert out.peirce_migration_pending is True
    assert out.peirce_migration_source == "heuristic_v1_pending"


def test_annotate_swallows_invalid_path_lookup(classifier):
    """A path the manifold lacks (e.g. Sinsign/Index/Argument) is swallowed."""
    ev = ClassifierInput(
        narrative="this single token, a pointer trace symptom, an argument a proof"
    )
    # classify_path resolves a triad the manifold does not contain:
    assert classifier.classify_path(ev) == ["Sinsign", "Index", "Argument"]
    assert not get_manifold().has_path(["Sinsign", "Index", "Argument"])
    out = classifier.annotate(ev)
    assert out.peirce is None
    assert out.peirce_migration_pending is True


def test_annotate_populates_peirce_on_success(classifier):
    ev = ClassifierInput(
        narrative="a rule of law, a symbol in language, an argument a proof therefore"
    )
    out = classifier.annotate(ev)
    assert out.peirce is not None
    assert out.peirce.sign_class_id == 42
    assert out.peirce.mode == "SYMBOL"
    assert out.peirce.pragmatism_band == "FORMAL_THOUGHT"
    assert out.peirce_migration_pending is False
    assert out.peirce_migration_source is None


# ── infer_coarse_mode ────────────────────────────────────────────────────────

def test_infer_coarse_mode_symbol_wins_over_index():
    assert infer_coarse_mode(["Legisign", "Symbol", "Argument"]) == "SYMBOL"


def test_infer_coarse_mode_index():
    assert infer_coarse_mode(["Sinsign", "Index", "Dicent"]) == "INDEX"


def test_infer_coarse_mode_icon():
    assert infer_coarse_mode(["Qualisign", "Icon", "Rheme"]) == "ICON"


def test_infer_coarse_mode_default_icon():
    # No Icon/Index/Symbol node → default ICON (matches TS default).
    assert infer_coarse_mode(["Legisign"]) == "ICON"