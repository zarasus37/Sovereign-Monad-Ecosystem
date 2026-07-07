"""Tests for the Python ``score_sign`` mirror (Layer 7.3).

Mirrors the canonical TS ``constitution.test.ts`` boundary cases so the
cross-runtime parity test has a Python-side anchor. The scorer reads the
C1..C5 weights + threshold from the canonical numerics and validates C3
against the shared LOGOC manifold.
"""
from __future__ import annotations

import pytest

from gnostic_engine.classification import get_manifold
from gnostic_engine.constitution import (
    CoarseMode,
    Domain,
    EventTrace,
    Modality,
    PeirceSignature,
    Sign,
    score_sign,
)

MANIFOLD = get_manifold()
THRESHOLD = 0.72


def _class(band=None, interpretant=None):
    for c in MANIFOLD.all_classes():
        if band and c.pragmatism_band != band:
            continue
        if interpretant and c.path[2] != interpretant:
            continue
        return c
    raise AssertionError(f"no class for band={band} interpretant={interpretant}")


def formal_argument_class_id() -> int:
    return _class(band="FORMAL_THOUGHT", interpretant="Argument").id


def experience_class_id() -> int:
    return _class(band="EXPERIENCE").id


def instinct_class_id() -> int:
    return _class(band="INSTINCT").id


def mode_of(class_id: int) -> CoarseMode:
    cls = MANIFOLD.get(class_id)
    mode = cls.path[1].upper()
    assert mode in ("ICON", "INDEX", "SYMBOL"), f"unexpected path[1]: {cls.path[1]}"
    return mode


def _peirce(class_id: int) -> PeirceSignature:
    cls = MANIFOLD.get(class_id)
    return PeirceSignature(
        mode=mode_of(class_id),
        sign_class_id=cls.id,
        sign_class_label=cls.label,
        path=list(cls.path),
        firstness_weight=cls.firstness_weight,
        secondness_weight=cls.secondness_weight,
        thirdness_weight=cls.thirdness_weight,
        pragmatism_band=cls.pragmatism_band,
    )


def make_sign(
    class_id: int,
    domain: Domain,
    modality: Modality,
    pps: float,
    trace: EventTrace | None = None,
    domains=None,
    no_rlhf: bool | None = None,
) -> Sign:
    return Sign(
        modality=modality,
        domain=domain,
        pps=pps,
        peirce=_peirce(class_id),
        trace=trace,
        domains=domains,
        no_rlhf=no_rlhf,
    )


def formal_sign(domain, modality, pps, source=None) -> Sign:
    id_ = formal_argument_class_id()
    trace = EventTrace(intention_id="i-1", source=source) if source else None
    return make_sign(id_, domain, modality, pps, trace)


# ── Canonical weight loading ──────────────────────────────────────────────────

def test_reads_weights_from_canonical_numerics():
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "HYBRID",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
        domains=["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"],
    )
    r = score_sign(sign)
    assert r.criteria["tripartite"].weight == pytest.approx(0.30)
    assert r.criteria["logicCompression"].weight == pytest.approx(0.25)
    assert r.criteria["sourceAligned"].weight == pytest.approx(0.25)
    assert r.criteria["epistemicHumility"].weight == pytest.approx(0.10)
    assert r.criteria["noRlhfSignal"].weight == pytest.approx(0.10)
    assert r.threshold == pytest.approx(THRESHOLD)


def test_all_five_pass_scores_max():
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "HYBRID",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
        domains=["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"],
    )
    r = score_sign(sign)
    assert all(c.held for c in r.criteria.values())
    assert r.total == pytest.approx(1.0)
    assert r.pass_ is True
    assert len(r.reasoning) >= 6


# ── Per-criterion failures ───────────────────────────────────────────────────

def test_two_domain_fails_c1():
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "SYMBOL",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
        domains=["THEOLOGY", "TECHNOLOGY"],
    )
    r = score_sign(sign)
    assert r.criteria["tripartite"].held is False
    assert r.criteria["tripartite"].score == pytest.approx(2 / 3)


def test_instinct_fails_c4():
    sign = make_sign(
        instinct_class_id(),
        "THEOLOGY",
        "ICON",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
    )
    r = score_sign(sign)
    assert r.criteria["epistemicHumility"].held is False
    assert r.criteria["epistemicHumility"].score == 0


def test_untraced_loses_c3():
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "HYBRID",
        0.9,
        # no trace → source absent, manifold still valid → 0.5
    )
    r = score_sign(sign)
    assert r.criteria["sourceAligned"].held is False
    assert r.criteria["sourceAligned"].score == pytest.approx(0.5)


def test_pure_modality_c2_zero():
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "PURE",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
    )
    r = score_sign(sign)
    assert r.criteria["logicCompression"].held is False
    assert r.criteria["logicCompression"].score == 0


def test_no_rlhf_false_loses_c5():
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "SYMBOL",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
        no_rlhf=False,
    )
    r = score_sign(sign)
    assert r.criteria["noRlhfSignal"].held is False
    assert r.criteria["noRlhfSignal"].score == 0


# ── Pass/fail boundary at 0.72 ───────────────────────────────────────────────

def test_passes_just_above_threshold_0725():
    # C1=1 (0.30) + C2=1 HYBRID (0.25) + C3=0.5 no-trace (0.125)
    # + C4=0.5 EXPERIENCE (0.05) + C5=0 no_rlhf=False (0) = 0.725
    sign = make_sign(
        experience_class_id(),
        "COSMOLOGY",
        "HYBRID",
        0.9,
        domains=["THEOLOGY", "TECHNOLOGY", "COSMOLOGY"],
        no_rlhf=False,
    )
    r = score_sign(sign)
    assert r.total == pytest.approx(0.725)
    assert r.pass_ is True


def test_fails_just_below_threshold_070():
    # C1=0 empty ancestry (0) + C2=1 HYBRID (0.25) + C3=1 source+valid (0.25)
    # + C4=1 FORMAL_THOUGHT (0.10) + C5=1 no_rlhf=True (0.10) = 0.70
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "HYBRID",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
        domains=[],  # explicit empty → C1 = 0 (nullish coalescing keeps [])
        no_rlhf=True,
    )
    r = score_sign(sign)
    assert r.total == pytest.approx(0.70)
    assert r.pass_ is False


# ── Purity ────────────────────────────────────────────────────────────────────

def test_unknown_class_id_does_not_throw():
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "SYMBOL",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
    )
    # Replace the peirce with an unknown class id (frozen → rebuild).
    bad_peirce = PeirceSignature(
        mode=sign.peirce.mode,
        sign_class_id=999_999,
        sign_class_label=sign.peirce.sign_class_label,
        path=sign.peirce.path,
        firstness_weight=sign.peirce.firstness_weight,
        secondness_weight=sign.peirce.secondness_weight,
        thirdness_weight=sign.peirce.thirdness_weight,
        pragmatism_band=sign.peirce.pragmatism_band,
    )
    sign = Sign(
        modality=sign.modality,
        domain=sign.domain,
        pps=sign.pps,
        peirce=bad_peirce,
        trace=sign.trace,
        domains=sign.domains,
        no_rlhf=sign.no_rlhf,
    )
    # Predicate, not gate: unknown class drops C3 to 0.5, no throw.
    r = score_sign(sign)  # must not raise
    assert r.criteria["sourceAligned"].held is False
    assert r.criteria["sourceAligned"].score == pytest.approx(0.5)


def test_domains_none_falls_back_to_single_domain():
    # TS `sign.domains ?? [sign.domain]` — None → [domain] → C1 = 1/3.
    sign = make_sign(
        formal_argument_class_id(),
        "THEOLOGY",
        "SYMBOL",
        0.9,
        trace=EventTrace(intention_id="i-1", source="srcA"),
        # domains=None
    )
    r = score_sign(sign)
    assert r.criteria["tripartite"].score == pytest.approx(1 / 3)