"""Heuristic Peirce classifier — verbatim Python port of the TS runtime
``logoc/src/peirce/classifier.ts`` (Layer 7).

This is the **parity target** for the cross-runtime classifier parity test.
It is deliberately NOT the richer YAML-rubric classifier in
``logoc/peirce/classifier.py``. The two diverge on ambiguous / multi-flag
events (the rubric applies disambiguation weights, strong indicators, and
permutation fallbacks; this heuristic does not). Parity is against the TS
heuristic only — the rubric is documentation-grade until a future layer
promotes both runtimes to YAML-driven parity. See the Layer 7 plan, risk (4).

Faithfulness contract: every keyword list and every flag-then-narrative
decision order below mirrors ``classifier.ts`` line for line. If you change
the TS classifier, change this file in the same edit and run the parity test.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal, Optional

from ._manifold_proxy import PeirceManifold, get_manifold

PragmatismBand = Literal["INSTINCT", "EXPERIENCE", "FORMAL_THOUGHT"]
CoarseMode = Literal["ICON", "INDEX", "SYMBOL"]


class AmbiguousClassificationError(Exception):
    """Raised when no single triad branch resolves from the event."""


@dataclass
class SemioticFlags:
    """Mirrors ``logoc/src/peirce/models.ts`` SemioticFlags (plain, not pydantic)."""

    single_occurrence: bool = False
    rule_based: bool = False
    similarity: bool = False
    causality: bool = False
    convention: bool = False
    possibility: bool = False
    fact: bool = False
    reason: bool = False


@dataclass
class PeirceSignatureOutput:
    """Mirrors ``logoc/src/peirce/models.ts`` PeirceSignature."""

    mode: CoarseMode
    sign_class_id: int
    sign_class_label: str
    path: List[str]
    firstness_weight: float
    secondness_weight: float
    thirdness_weight: float
    pragmatism_band: PragmatismBand


@dataclass
class ClassifierInput:
    """Minimal event surface the classifier consults — narrative + flags.

    Mirrors the subset of ``LogocEvent`` that ``classifier.ts`` reads. Kept
    plain (not pydantic) so the classifier + parity tests have no heavy deps.
    The orchestrator (Layer 7) adapts a gnosis packet to this shape.
    """

    narrative: Optional[str] = None
    semiotic_flags: Optional[SemioticFlags] = None
    # Annotated output (mirrors LogocEvent.peirce / migration fields):
    peirce: Optional[PeirceSignatureOutput] = None
    peirce_migration_pending: bool = False
    peirce_migration_source: Optional[str] = None


def infer_coarse_mode(path: List[str]) -> CoarseMode:
    """Verbatim port of ``inferCoarseMode`` — first of Symbol/Index/Icon wins."""
    for node in path:
        if node == "Symbol":
            return "SYMBOL"
        if node == "Index":
            return "INDEX"
        if node == "Icon":
            return "ICON"
    return "ICON"


class HeuristicClassifier:
    """Verbatim port of the TS ``PeirceClassifier`` heuristic.

    Three independent triad decisions (vehicle, object relation, interpretant)
    each resolved flag-first, then by narrative keyword, else ambiguity. The
    resulting path is resolved to a class id via the shared manifold.
    """

    def __init__(self, manifold: Optional[PeirceManifold] = None):
        self.manifold = manifold or get_manifold()

    def classify(self, event: ClassifierInput) -> int:
        path = self.classify_path(event)
        cls = self.manifold.lookup_by_path(path)
        return cls.id

    def classify_path(self, event: ClassifierInput) -> List[str]:
        vehicle = self._decide_vehicle(event)
        object_rel = self._decide_object_relation(event)
        interpretant = self._decide_interpretant(event)
        return [vehicle, object_rel, interpretant]

    def annotate(self, event: ClassifierInput) -> ClassifierInput:
        try:
            path = self.classify_path(event)
            cls = self.manifold.lookup_by_path(path)
            event.peirce = PeirceSignatureOutput(
                mode=infer_coarse_mode(path),
                sign_class_id=cls.id,
                sign_class_label=cls.label,
                path=cls.path,
                firstness_weight=cls.firstness_weight,
                secondness_weight=cls.secondness_weight,
                thirdness_weight=cls.thirdness_weight,
                pragmatism_band=cls.pragmatism_band,
            )
            event.peirce_migration_pending = False
            event.peirce_migration_source = None
        except (AmbiguousClassificationError, ValueError, KeyError):
            # Mirrors TS: catch (AmbiguousClassificationError || Error) — swallow
            # both ambiguity and manifold lookup failure, mark pending.
            event.peirce = None
            event.peirce_migration_pending = True
            event.peirce_migration_source = "heuristic_v1_pending"
        return event

    # ------------------------------------------------------------------
    # Triad decisions — verbatim keyword lists + order from classifier.ts
    # ------------------------------------------------------------------

    def _decide_vehicle(self, event: ClassifierInput) -> str:
        flags = event.semiotic_flags or SemioticFlags()
        if flags.rule_based:
            return "Legisign"
        if flags.single_occurrence:
            return "Sinsign"

        nar = (event.narrative or "").lower()
        if any(kw in nar for kw in ("rule", "law", "convention", "type")):
            return "Legisign"
        if any(kw in nar for kw in ("single", "token", "this", "event")):
            return "Sinsign"
        if any(kw in nar for kw in ("quality", "pure", "feel", "sensation", "description")):
            return "Qualisign"

        raise AmbiguousClassificationError(
            "Cannot determine sign vehicle from event."
        )

    def _decide_object_relation(self, event: ClassifierInput) -> str:
        flags = event.semiotic_flags or SemioticFlags()
        if flags.convention:
            return "Symbol"
        if flags.causality:
            return "Index"
        if flags.similarity:
            return "Icon"

        nar = (event.narrative or "").lower()
        if any(kw in nar for kw in ("symbol", "word", "language", "arbitrary")):
            return "Symbol"
        if any(kw in nar for kw in ("index", "causal", "pointer", "symptom", "trace")):
            return "Index"
        if any(kw in nar for kw in ("icon", "image", "resemble", "diagram", "likeness")):
            return "Icon"

        raise AmbiguousClassificationError(
            "Cannot determine object relation from event."
        )

    def _decide_interpretant(self, event: ClassifierInput) -> str:
        flags = event.semiotic_flags or SemioticFlags()
        if flags.reason:
            return "Argument"
        if flags.fact:
            return "Dicent"
        if flags.possibility:
            return "Rheme"

        nar = (event.narrative or "").lower()
        if any(kw in nar for kw in ("argument", "proof", "conclude", "therefore", "theorem")):
            return "Argument"
        if any(kw in nar for kw in ("fact", "assertion", "true", "false", "state")):
            return "Dicent"
        if any(kw in nar for kw in ("possibility", "may", "might", "could", "potential")):
            return "Rheme"

        raise AmbiguousClassificationError(
            "Cannot determine interpretant from event."
        )