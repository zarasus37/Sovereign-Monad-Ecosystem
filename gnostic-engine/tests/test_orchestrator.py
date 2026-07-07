"""Tests for the Layer 7.6 typed-pipeline orchestration.

Pins the orchestrator at the boundary of the typed ``/api/v1/gnosis/process``
path and its end-to-end wiring into ``routes.process_packet``:

  (1) ``classify_and_tier`` — a packet carrying a classifiable narrative
      produces a Peirce classification + a manifold-derived tier + weight;
      a packet with neither narrative nor flags degrades to None (the legacy
      unweighted path) and never blocks the pipeline.
  (2) ``tvl_to_pps_band`` — the TVL→PPS band mapping reads the canonical band
      values from the generated numerics.
  (3) ``build_sign_from_packet`` — the live Sign is single-domain TECHNOLOGY
      with modality = the classifier's CoarseMode and no_rlhf=True.
  (4) ``constitution_for_packet`` — a classified live packet scores < 0.72
      by design (single-domain → C1 = 1/3, C2 = 0.5) and surfaces
      ``domain_incomplete=True`` so the wire format carries the design intent.
  (5) E2E via TestClient — POST /api/v1/gnosis/process attaches
      ``constitution_score`` / ``logoc_tier`` / ``domain_incomplete`` to the
      response; ``boundary_adjacent=True`` forces BLINK with SR ≥ threshold
      (proving the forced-divert path overrides a FOCAL_LOCK-grade read), and
      repeats escalate to QUARANTINE.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import pytest
from fastapi.testclient import TestClient

from api.gnostic_api import app

from gnostic_engine.generated.numerics import (
    FOCAL_LOCK_THRESHOLD,
    HEAP_BAND,
    MAX_BLINKS,
    MAX_TVL_REFERENCE,
    STATIC_BAND,
    VOLATILE_BAND,
)
from gnostic_engine.orchestration import (
    PacketClassification,
    build_sign_from_packet,
    classify_and_tier,
    tvl_to_pps_band,
)
from gnostic_engine.orchestration.sign_builder import constitution_for_packet

client = TestClient(app)

# A narrative that classifies to class 1 (Rhematic-Indexical-Sinsign),
# which is a COHERENT tier (weight 1.0) on the canonical manifold — so a
# BASE-lane packet stays FOCAL_LOCK-grade and the boundary forced-divert path
# is genuinely exercised (not masked by a tier-induced SR drop).
_COHERENT_NARRATIVE = "this single token is a causal trace of a possibility"

# BASE lanes that comfortably clear FOCAL_LOCK when Lane B is unattenuated
# (matches tests/test_boundary_blink.py BASE; sr ≈ 0.8631 ≥ 0.85).
_BASE = {
    "lane_a": 0.8,
    "lane_b": 0.8,
    "lane_c": 0.3,
    "v_mask": [True, True, True, True],
}


@dataclass
class _Req:
    """Minimal duck-typed stand-in for GnosticPacketRequest used by the
    orchestrator's getattr-based reads (avoids pydantic round-trips in unit
    tests of the orchestrator itself)."""

    narrative: Optional[str] = None
    semiotic_flags: Optional[dict[str, Any]] = None
    boundary_adjacent: bool = False
    tvl: Optional[float] = None
    trace: Optional[dict[str, Any]] = None


# ── classify_and_tier ──────────────────────────────────────────────────────────


def test_classify_and_tier_classified_packet_produces_tier_and_weight():
    pre = classify_and_tier(_Req(narrative=_COHERENT_NARRATIVE))
    assert pre is not None
    assert isinstance(pre, PacketClassification)
    assert pre.peirce.sign_class_id == 1
    assert pre.logoc_tier == "COHERENT"
    assert pre.logoc_tier_weight == pytest.approx(1.0)


def test_classify_and_tier_no_narrative_no_flags_returns_none():
    # No classification inputs → legacy unweighted path (enrichment, not a gate).
    assert classify_and_tier(_Req()) is None


def test_classify_and_tier_flags_only_classifies():
    # rule_based → Legisign, convention → Symbol, reason → Argument.
    pre = classify_and_tier(
        _Req(semiotic_flags={"rule_based": True, "convention": True, "reason": True})
    )
    assert pre is not None
    assert pre.peirce.path == ["Legisign", "Symbol", "Argument"]


def test_classify_and_tier_unknown_class_returns_none():
    # An ambiguous narrative (no keyword in one of the triads) → annotate
    # swallows → None. The pipeline is not blocked.
    assert classify_and_tier(_Req(narrative="ambiguous uncategorizable text")) is None


# ── tvl_to_pps_band ────────────────────────────────────────────────────────────


def test_tvl_to_pps_band_static_at_half_max():
    assert tvl_to_pps_band(MAX_TVL_REFERENCE * 0.50) == STATIC_BAND


def test_tvl_to_pps_band_heap_in_middle_band():
    assert tvl_to_pps_band(MAX_TVL_REFERENCE * 0.20) == HEAP_BAND


def test_tvl_to_pps_band_volatile_below_floor():
    assert tvl_to_pps_band(MAX_TVL_REFERENCE * 0.01) == VOLATILE_BAND


def test_tvl_to_pps_band_none_or_nonpositive_defaults_heap():
    assert tvl_to_pps_band(None) == HEAP_BAND
    assert tvl_to_pps_band(0) == HEAP_BAND
    assert tvl_to_pps_band(-5.0) == HEAP_BAND


# ── build_sign_from_packet ─────────────────────────────────────────────────────


def test_build_sign_single_domain_technology_with_classifier_modality():
    pre = classify_and_tier(_Req(narrative=_COHERENT_NARRATIVE))
    assert pre is not None
    sign = build_sign_from_packet(_Req(tvl=MAX_TVL_REFERENCE * 0.60), {}, pre.peirce)
    assert sign is not None
    assert sign.domain == "TECHNOLOGY"  # single-domain by design
    assert sign.domains is None  # → C1 = 1/3
    assert sign.modality == pre.peirce.mode  # ICON | INDEX | SYMBOL, not HYBRID
    assert sign.no_rlhf is True
    assert sign.pps == STATIC_BAND  # 0.60 ≥ 0.50 fraction


def test_build_sign_none_without_classification():
    assert build_sign_from_packet(_Req(), {}, None) is None


# ── constitution_for_packet ─────────────────────────────────────────────────────


def test_constitution_for_packet_subthreshold_and_domain_incomplete():
    pre = classify_and_tier(_Req(narrative=_COHERENT_NARRATIVE))
    assert pre is not None
    result = constitution_for_packet(
        _Req(narrative=_COHERENT_NARRATIVE), {}, pre.peirce
    )
    assert result is not None
    # Single-domain TECHNOLOGY → C1 = 1/3, C2 = 0.5 → total < 0.72 by design.
    assert result["constitution_score"] < 0.72
    assert result["constitution_pass"] is False
    # The wire format must carry the design intent, not just the fail.
    assert result["domain_incomplete"] is True


def test_constitution_for_packet_none_without_classification():
    assert constitution_for_packet(_Req(), {}, None) is None


# ── E2E via TestClient (POST /api/v1/gnosis/process) ─────────────────────────────


def _post(agent_id: str, **extra) -> dict[str, Any]:
    payload = {"agent_id": agent_id, **_BASE, **extra}
    r = client.post("/api/v1/gnosis/process", json=payload)
    assert r.status_code == 200, r.text
    return r.json()


def test_e2e_classified_packet_carries_constitution_and_tier():
    data = _post("orch-classified-1", narrative=_COHERENT_NARRATIVE)
    assert data["verdict"] == "FOCAL_LOCK"
    assert data["logoc_tier"] == "COHERENT"
    assert data["constitution_score"] is not None
    assert data["constitution_score"] < 0.72  # domain-incomplete by design
    assert data["constitution_pass"] is False
    assert data["domain_incomplete"] is True
    assert data["momentum"] in ("EXPANDING", "STABLE")


def test_e2e_unclassified_packet_omits_enrichment():
    data = _post("orch-bare-1")  # no narrative / flags
    assert data["logoc_tier"] is None
    assert data["constitution_score"] is None
    assert data["domain_incomplete"] is None


def test_e2e_boundary_adjacent_forces_blink_over_focal_lock():
    # BASE lanes FOCAL_LOCK without the flag; boundary_adjacent must OVERRIDE
    # the passing SR and force BLINK — this is the forced-divert path the
    # co-architect flagged: prove SR ≥ threshold yet verdict == BLINK.
    data = _post("orch-boundary-1", narrative=_COHERENT_NARRATIVE, boundary_adjacent=True)
    assert data["verdict"] == "BLINK"
    assert data["overall_score"] >= FOCAL_LOCK_THRESHOLD  # would have locked focus
    # Enrichment still attaches (the scorer ran upstream and never throws).
    assert data["logoc_tier"] == "COHERENT"
    assert data["constitution_score"] is not None


def test_e2e_boundary_incursions_escalate_to_quarantine():
    # MAX_BLINKS boundary blinks on a fresh agent → the next is QUARANTINE.
    aid = "orch-quarantine-1"
    for _ in range(MAX_BLINKS):
        r = _post(aid, narrative=_COHERENT_NARRATIVE, boundary_adjacent=True)
        assert r["verdict"] == "BLINK"
    r = _post(aid, narrative=_COHERENT_NARRATIVE, boundary_adjacent=True)
    assert r["verdict"] == "QUARANTINE"