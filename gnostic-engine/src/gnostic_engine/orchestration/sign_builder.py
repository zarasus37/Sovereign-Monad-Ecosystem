"""Sign builder + classification/tier orchestration (Layer 7.6).

Assembles a TTCL ``Sign`` from a classified gnosis packet so the Python
``score_sign`` mirror can produce a constitution verdict at the typed-pipeline
boundary. Also produces the manifold-derived ``logoc_tier`` + Lane B weight
that the engine weights Lane B by (Layer 7.4 + 7.5).

This module is enrichment, not a gate: every public function fails soft
(returns None) on missing narrative/flags, ambiguity, or unknown class.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from ..classification import (
    ClassifierInput,
    HeuristicClassifier,
    PeirceSignatureOutput,
    SemioticFlags,
)
from ..constitution import EventTrace, PeirceSignature, Sign, score_sign
from ..generated.numerics import (
    HEAP_BAND,
    MAX_TVL_REFERENCE,
    STATIC_BAND,
    VOLATILE_BAND,
)
from ..logoc_tier import produce_logoc_tier

# The live gnosis packet is a Technology-domain observation (on-chain / infra
# telemetry). A live packet carries one real classification; fabricating two
# more domains for a triadic compose would be theater. Single-domain by design.
_LIVE_DOMAIN = "TECHNOLOGY"

# Fraction-of-MAX_TVL cut points for the PPS band mapping.
_TVL_STATIC_FRACTION = 0.50
_TVL_VOLATILE_FRACTION = 0.05


@dataclass(frozen=True)
class PacketClassification:
    """Pre-``process_packet`` classification + tier result (enrichment)."""

    peirce: PeirceSignatureOutput
    logoc_tier: str
    logoc_tier_weight: float


def _flags_from_dict(raw: Optional[dict[str, Any]]) -> Optional[SemioticFlags]:
    if raw is None:
        return None
    # Tolerate camelCase or snake_case keys; ignore extras.
    known = {
        "single_occurrence",
        "rule_based",
        "similarity",
        "causality",
        "convention",
        "possibility",
        "fact",
        "reason",
    }
    picked = {k: bool(v) for k, v in raw.items() if k in known}
    if not picked:
        return None
    return SemioticFlags(**picked)


def classify_and_tier(req: Any) -> Optional[PacketClassification]:
    """Classify the packet narrative + flags and produce its manifold tier.

    Returns None when there is nothing to classify (no narrative and no flags),
    when classification is ambiguous, or when the resulting path is not on the
    manifold — the engine packet still processes, just without tier weighting
    or a constitution score.
    """
    flags = _flags_from_dict(getattr(req, "semiotic_flags", None))
    narrative = getattr(req, "narrative", None)
    if not flags and not narrative:
        return None

    event = ClassifierInput(narrative=narrative, semiotic_flags=flags)
    classifier = HeuristicClassifier()
    annotated = classifier.annotate(event)
    if annotated.peirce is None:
        # Ambiguous or invalid path → no classification.
        return None
    peirce = annotated.peirce
    try:
        tier, weight = produce_logoc_tier(peirce.sign_class_id)
    except KeyError:
        return None
    return PacketClassification(peirce=peirce, logoc_tier=tier, logoc_tier_weight=weight)


def tvl_to_pps_band(tvl: Optional[float]) -> float:
    """Map a TVL value to its PPS band value via the canonical numerics.

    ``tvl / MAX_TVL`` ≥ 0.50 → static, ≥ 0.05 → heap, else volatile.
    None / non-positive TVL defaults to the heap band (adjacent-convergent).
    """
    if tvl is None or tvl <= 0:
        return HEAP_BAND
    fraction = float(tvl) / MAX_TVL_REFERENCE
    if fraction >= _TVL_STATIC_FRACTION:
        return STATIC_BAND
    if fraction >= _TVL_VOLATILE_FRACTION:
        return HEAP_BAND
    return VOLATILE_BAND


def _trace_from_req(req: Any) -> Optional[EventTrace]:
    raw = getattr(req, "trace", None)
    if not raw:
        return None
    return EventTrace(
        intention_id=raw.get("intentionId") or raw.get("intention_id") or "",
        source=raw.get("source"),
        parent_event_id=raw.get("parentEventId") or raw.get("parent_event_id"),
        constraint_envelope_id=raw.get("constraintEnvelopeId")
        or raw.get("constraint_envelope_id"),
        narrative_purpose_id=raw.get("narrativePurposeId")
        or raw.get("narrative_purpose_id"),
        created_at=raw.get("createdAt") or raw.get("created_at"),
    )


def _peirce_to_sign(peirce: PeirceSignatureOutput) -> PeirceSignature:
    return PeirceSignature(
        mode=peirce.mode,
        sign_class_id=peirce.sign_class_id,
        sign_class_label=peirce.sign_class_label,
        path=list(peirce.path),
        firstness_weight=peirce.firstness_weight,
        secondness_weight=peirce.secondness_weight,
        thirdness_weight=peirce.thirdness_weight,
        pragmatism_band=peirce.pragmatism_band,
    )


def build_sign_from_packet(
    req: Any,
    raw_engine_result: dict[str, Any],
    peirce: Optional[PeirceSignatureOutput],
) -> Optional[Sign]:
    """Build a single-domain TTCL Sign from a classified gnosis packet.

    Returns None if no classification is available (enrichment, not a gate).
    The Sign is single-domain TECHNOLOGY with modality = the classifier's
    CoarseMode → C1 = 1/3, C2 = 0.5 → the constitution score is < 0.72 by design.
    """
    if peirce is None:
        return None
    return Sign(
        modality=peirce.mode,  # ICON | INDEX | SYMBOL (single-domain, not HYBRID)
        domain=_LIVE_DOMAIN,
        pps=tvl_to_pps_band(getattr(req, "tvl", None)),
        peirce=_peirce_to_sign(peirce),
        trace=_trace_from_req(req),
        domains=None,  # single-domain → C1 = 1/3
        no_rlhf=True,  # the live pipeline carries no RLHF signal
    )


def constitution_for_packet(
    req: Any, raw_engine_result: dict[str, Any], peirce: Optional[PeirceSignatureOutput]
) -> Optional[dict[str, Any]]:
    """Build + score the Sign, returning the constitution verdict fields.

    Returns None when no Sign can be built. Never raises.

    The returned dict carries ``domain_incomplete=True`` because the live
    pipeline Sign is single-domain TECHNOLOGY by design — a raw engine packet
    is constitutionally incomplete until composed upstream in TTCL with all
    three domains, so a sub-threshold score here is the *correct* C1 penalty,
    not a scorer failure. Surfacing this on the wire keeps operators from
    misreading ``constitution_pass=false`` as a fault.
    """
    try:
        sign = build_sign_from_packet(req, raw_engine_result, peirce)
        if sign is None:
            return None
        result = score_sign(sign)
        return {
            "constitution_score": result.total,
            "constitution_pass": result.pass_,
            "domain_incomplete": True,  # single-domain by design (see module docstring)
        }
    except Exception:
        # Enrichment, not a gate — never let scoring failure block the pipeline.
        return None