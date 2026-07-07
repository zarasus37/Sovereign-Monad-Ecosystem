"""Python ``score_sign`` mirror (Layer 7.3) — parity port of the canonical
TS scorer in ``monad-ecosystem/packages/ttcl/src/runtime/constitution.ts``.

Five weighted criteria, all weights from the canonical numerics
(``shared/schemas/ttcl-numerics.json`` flattened into
``gnostic_engine.generated.numerics``):

    C1 Tripartite        (0.30) — triadic ancestry: fraction of
                                   {Theology, Technology, Cosmology} present.
    C2 Logic Compression (0.25) — HYBRID=1.0, single mode=0.5, PURE=0.0.
    C3 Source Aligned    (0.25) — trace.source present AND peirce validates
                                   against the LOGOC manifold (1/0.5/0).
    C4 Epistemic Humility(0.10) — FORMAL_THOUGHT=1.0, EXPERIENCE=0.5, INSTINCT=0.0.
    C5 No RLHF Signal     (0.10) — caller-set ``no_rlhf`` flag (default True).

``total = Σ(weight × score)``; ``pass = total >= PASS_THRESHOLD`` (0.72).

The scorer is a **predicate, not a gate** — it never throws. An unknown
``sign_class_id`` is reported via C3 (drops to 0.5 if source present) rather
than raised, exactly so it can be called defensively upstream of the
``boundary_adjacent`` branching gate. This must stay true: score first
(predicate), branch on the verdict, never let the scorer throw.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from ..generated.numerics import (
    C1_TRIPARTITE_WEIGHT,
    C2_LOGIC_COMPRESSION_WEIGHT,
    C3_SOURCE_ALIGNED_WEIGHT,
    C4_EPISTEMIC_HUMILITY_WEIGHT,
    C5_NO_RLHF_SIGNAL_WEIGHT,
    PASS_THRESHOLD,
)
from ..classification import get_manifold
from .types import Domain, EventTrace, Modality, PeirceSignature, PragmatismBand, Sign

ALL_DOMAINS: List[Domain] = ["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"]

BAND_SCORE: Dict[PragmatismBand, float] = {
    "FORMAL_THOUGHT": 1.0,
    "EXPERIENCE": 0.5,
    "INSTINCT": 0.0,
}


def _round4(n: float) -> float:
    """Match TS ``Math.round(n * 10000) / 10000`` for nonnegative totals
    (round half up, not banker's rounding)."""
    return math.floor(n * 10000 + 0.5) / 10000


@dataclass(frozen=True)
class ConstitutionCriterion:
    weight: float
    score: float
    contribution: float
    held: bool
    reasoning: str


@dataclass(frozen=True)
class ConstitutionResult:
    total: float
    pass_: bool  # `pass` is a Python keyword; mirror field renamed.
    threshold: float
    criteria: Dict[str, ConstitutionCriterion]
    reasoning: List[str]


def _criterion(
    weight: float,
    score: float,
    held: bool,
    reasoning: str,
) -> ConstitutionCriterion:
    return ConstitutionCriterion(
        weight=weight,
        score=score,
        contribution=weight * score,
        held=held,
        reasoning=reasoning,
    )


def _score_tripartite(sign: Sign) -> ConstitutionCriterion:
    # TS `sign.domains ?? [sign.domain]` — nullish coalescing: an explicit []
    # stays [] (C1=0), only None falls back to [domain].
    present = [sign.domain] if sign.domains is None else list(sign.domains)
    unique = set(present)
    count = sum(1 for d in ALL_DOMAINS if d in unique)
    score = count / len(ALL_DOMAINS)
    names = ", ".join(sorted(unique)) if unique else "none"
    return _criterion(
        C1_TRIPARTITE_WEIGHT,
        score,
        held=count == len(ALL_DOMAINS),
        reasoning=f"Tripartite: {count}/{len(ALL_DOMAINS)} domains present ({names}).",
    )


def _score_logic_compression(sign: Sign) -> ConstitutionCriterion:
    if sign.modality == "HYBRID":
        score, label = 1.0, "HYBRID (compose output — maximal logic compression)"
    elif sign.modality in ("ICON", "INDEX", "SYMBOL"):
        score, label = 0.5, f"{sign.modality} (single mode — partial compression)"
    else:  # PURE
        score, label = 0.0, "PURE ⊥ (no compression — lattice abort)"
    return _criterion(
        C2_LOGIC_COMPRESSION_WEIGHT,
        score,
        held=score == 1.0,
        reasoning=f"Logic compression: {label}.",
    )


def _score_source_aligned(sign: Sign) -> ConstitutionCriterion:
    has_source = bool(sign.trace and sign.trace.source)
    manifold_valid = False
    try:
        get_manifold().get(sign.peirce.sign_class_id)
        manifold_valid = True
    except KeyError:
        manifold_valid = False
    both = int(has_source) + int(manifold_valid)
    score = 1.0 if both == 2 else (0.5 if both == 1 else 0.0)
    parts = [
        "trace.source present" if has_source else "trace.source absent",
        "peirce valid on manifold" if manifold_valid else "peirce NOT valid on manifold",
    ]
    return _criterion(
        C3_SOURCE_ALIGNED_WEIGHT,
        score,
        held=score == 1.0,
        reasoning=f"Source aligned: {'; '.join(parts)} → {score}.",
    )


def _score_epistemic_humility(sign: Sign) -> ConstitutionCriterion:
    band = sign.peirce.pragmatism_band
    score = BAND_SCORE.get(band, 0.0)
    return _criterion(
        C4_EPISTEMIC_HUMILITY_WEIGHT,
        score,
        held=score == 1.0,
        reasoning=f"Epistemic humility: pragmatism_band={band} → {score}.",
    )


def _score_no_rlhf(sign: Sign) -> ConstitutionCriterion:
    flag = True if sign.no_rlhf is None else sign.no_rlhf
    score = 1.0 if flag else 0.0
    return _criterion(
        C5_NO_RLHF_SIGNAL_WEIGHT,
        score,
        held=flag,
        reasoning=f"No RLHF signal: no_rlhf={flag} → {score}.",
    )


def score_sign(sign: Sign) -> ConstitutionResult:
    """The single Python constitution scoring path — parity port of TS ``scoreSign``.

    Pure: no side effects, no throws. An unknown ``sign_class_id`` is reported
    via C3 (predicate), not raised.
    """
    criteria = {
        "tripartite": _score_tripartite(sign),
        "logicCompression": _score_logic_compression(sign),
        "sourceAligned": _score_source_aligned(sign),
        "epistemicHumility": _score_epistemic_humility(sign),
        "noRlhfSignal": _score_no_rlhf(sign),
    }
    total = _round4(sum(c.contribution for c in criteria.values()))
    passed = total >= PASS_THRESHOLD
    reasoning = [c.reasoning for c in criteria.values()]
    reasoning.append(
        f"Total {total} {'>=' if passed else '<'} threshold {PASS_THRESHOLD} → "
        f"{'PASS' if passed else 'FAIL'}."
    )
    return ConstitutionResult(
        total=total,
        pass_=passed,
        threshold=PASS_THRESHOLD,
        criteria=criteria,
        reasoning=reasoning,
    )