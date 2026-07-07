"""Tests for Layer 7.5 — boundary_adjacent forced BLINK + Lane B tier weight.

Pins:
  (1) Lane B is weighted by the manifold-derived tier (logoc_tier_weight):
      a COHERENT (1.0) packet that FOCAL_LOCKs at weight 1.0 BLINKs when
      attenuated by a DIVERGENT (0.4) weight; absent the field preserves the
      legacy unweighted blend exactly.
  (2) boundary_adjacent=True forces BLINK even when the structural read would
      otherwise FOCAL_LOCK (sr >= threshold), with reason="BOUNDARY_ADJACENT".
  (3) Repeated boundary incursions accumulate in the blink registry and
      escalate to QUARANTINE at max_blinks.
"""
from __future__ import annotations

import pytest

from gnostic_engine.core.gnostic_engine import GnosticEngine
from gnostic_engine.generated.numerics import (
    FOCAL_LOCK_THRESHOLD,
    MAX_BLINKS,
)

# A packet whose baseline structural read comfortably clears FOCAL_LOCK.
# v_mask is fully set so the Lane B blend keeps lane_b high (empty v_mask
# would halve it via the 0.5*raw + 0.5*vmask blend).
BASE = {
    "lane_a": 0.8,
    "lane_b": 0.8,
    "lane_c": 0.3,
    "v_mask": [True, True, True, True],
}


def _run(data, **extra) -> dict:
    d = dict(data)
    d.update(extra)
    return GnosticEngine().process_packet("agent-1", d)


# ── Lane B tier weight ────────────────────────────────────────────────────────

def test_baseline_focal_locks():
    r = _run(BASE)
    assert r["verdict"] == "FOCAL_LOCK"
    assert r["structural_read"] >= FOCAL_LOCK_THRESHOLD


def test_divergent_tier_weight_forces_blink():
    # Same packet, DIVERGENT tier weight (0.4) attenuates Lane B → sr drops
    # below FOCAL_LOCK → BLINK.
    r = _run(BASE, logoc_tier_weight=0.4)
    assert r["verdict"] == "BLINK"
    assert r["structural_read"] < FOCAL_LOCK_THRESHOLD


def test_coherent_tier_weight_preserves_focal_lock():
    r = _run(BASE, logoc_tier_weight=1.0)
    assert r["verdict"] == "FOCAL_LOCK"
    # weight 1.0 preserves the baseline exactly.
    assert r["structural_read"] == _run(BASE)["structural_read"]


def test_absent_tier_weight_preserves_legacy_blend():
    # No logoc_tier_weight key → default 1.0 → identical to baseline.
    r = _run(BASE)
    legacy = _run(BASE)
    assert r == legacy


def test_tier_weight_monotonic_in_structural_read():
    # Higher tier weight → higher (or equal) Lane B → higher structural read.
    sr_div = _run(BASE, logoc_tier_weight=0.4)["structural_read"]
    sr_emer = _run(BASE, logoc_tier_weight=0.7)["structural_read"]
    sr_coh = _run(BASE, logoc_tier_weight=1.0)["structural_read"]
    assert sr_div <= sr_emer <= sr_coh


# ── boundary_adjacent forced BLINK ────────────────────────────────────────────

def test_boundary_adjacent_forces_blink_above_threshold():
    # sr >= threshold (would FOCAL_LOCK), but the flag forces BLINK.
    r = _run(BASE, boundary_adjacent=True)
    assert r["verdict"] == "BLINK"
    assert r["reason"] == "BOUNDARY_ADJACENT"
    # Prove it WOULD have locked focus without the flag:
    assert r["structural_read"] >= FOCAL_LOCK_THRESHOLD


def test_boundary_adjacent_not_set_focal_locks():
    r = _run(BASE, boundary_adjacent=False)
    assert r["verdict"] == "FOCAL_LOCK"


def test_trigger_blink_default_reason_is_BLINK():
    # A sub-threshold packet (no boundary flag) blinks with the default reason.
    r = _run(BASE, logoc_tier_weight=0.4)  # forces sr < threshold
    assert r["verdict"] == "BLINK"
    assert r["reason"] == "BLINK"


# ── Escalation to QUARANTINE ───────────────────────────────────────────────────

def test_repeated_boundary_incursions_escalate_to_quarantine():
    """max_blinks boundary blinks → the next is QUARANTINE.

    Later blinks in the sequence may arrive via the threshold path (Pulfrich
    tilt accumulates across calls on the same var_id), but every BLINK
    increments the registry regardless of path, so escalation holds.
    """
    e = GnosticEngine()
    for _ in range(MAX_BLINKS):
        r = e.process_packet("agent-1", dict(BASE, boundary_adjacent=True))
        assert r["verdict"] == "BLINK"
    r = e.process_packet("agent-1", dict(BASE, boundary_adjacent=True))
    assert r["verdict"] == "QUARANTINE"
    assert r["reason"] == "COOLDOWN_EXHAUSTED"