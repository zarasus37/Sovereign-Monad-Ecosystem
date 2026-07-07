"""Gnostic Engine typed-pipeline orchestration (Layer 7.6).

Sits at the boundary of the typed `/api/v1/gnosis/process` path and assembles
a TTCL ``Sign`` from a classified gnosis packet, then scores it. The scorer is
a predicate (never throws); this whole module is **enrichment, not a gate** —
any failure (no narrative/flags, ambiguous classification, unknown class)
degrades gracefully to a None enrichment and the engine packet still processes.

Flow (driven by ``routes.process_packet``):

    pre = classify_and_tier(req)          # before process_packet — produces the
                                         # logoc_tier_weight threaded into Lane B
    raw = engine.process_packet(..., {logoc_tier_weight, boundary_adjacent, ...})
    sign = build_sign_from_packet(req, raw, pre.peirce if pre else None)
    result = score_sign(sign)             # constitution verdict (transparency metric)

See the Layer 7 plan's key design decision: the live-pipeline Sign is
single-domain (TECHNOLOGY) with modality = the classifier's CoarseMode, so
C1 = 1/3 and C2 = 0.5 and the constitution score is < 0.72 **by design** — a
raw engine packet is constitutionally incomplete until composed upstream in
TTCL with three real domains. The score is a transparency metric, NOT a gate.
"""
from .sign_builder import (
    PacketClassification,
    build_sign_from_packet,
    classify_and_tier,
    constitution_for_packet,
    tvl_to_pps_band,
)

__all__ = [
    "PacketClassification",
    "build_sign_from_packet",
    "classify_and_tier",
    "constitution_for_packet",
    "tvl_to_pps_band",
]