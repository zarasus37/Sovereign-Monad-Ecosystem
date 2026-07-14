"""synth_pairs.py — dry-run synthetic preference pairs (CPU-pure, NOT training,
NOT human judgments). These pairs exist only so the reward *trainer executes*
during the dry run; the real reward model trains on human-judged pairs (spec
line 478). Tests pin: every pair is bootstrap=False, non-empty, validates, and
the builder is deterministic.
"""
from __future__ import annotations

import pytest

from gnosis_training.event import GnosisEvent, from_wire
from gnosis_training.preference import (
    PREFERENCE_MIN_SCORE_GAP,
    load_human_pairs,
    validate_pair,
)
from gnosis_training.synth_pairs import (
    build_dry_run_pairs,
    dry_run_pair_to_wire,
    export_dry_run_pairs,
    serialize_dry_run_pairs_jsonl,
)


def _event(prompt: str, idx: int) -> GnosisEvent:
    wire = {
        "event_id": f"a1b2c3d4-1111-5111-8111-{idx:012d}",
        "constitution_version": "v1",
        "wheel_state": {"A": {"offset": 0, "key_hash": "k0"}},
        "active_slots": {
            "theology": {"wheel": "A", "slot": "A", "label": None},
            "technology": {"wheel": "S", "slot": "B", "label": None},
            "cosmology": {"wheel": "X", "slot": "C", "label": None},
        },
        "provenance_tokens": ["reg:A:0"],
        "messages": [
            {"role": "system", "content": "LOGOC system prompt"},
            {"role": "user", "content": prompt},
            {"role": "assistant", "content": ""},
        ],
        "constitution_score": {
            "tripartite": 1.0, "logic_compress": 0.9, "source_aligned": 1.0,
            "epistemic": 0.8, "no_rlhf_signal": 1.0, "total": 0.95, "passes": True,
        },
    }
    return from_wire(wire)


def _events(n: int = 6) -> list[GnosisEvent]:
    return [_event(f"dry-run prompt {i}", 1000 + i) for i in range(n)]


def test_empty_events_returns_empty():
    assert build_dry_run_pairs([]) == []


def test_produces_one_pair_per_event():
    events = _events(6)
    pairs = build_dry_run_pairs(events)
    assert len(pairs) == 6
    # One pair per event (round-robin category across the reference categories).
    cats = [p.category for p in pairs]
    assert len(set(cats)) > 1


def test_every_pair_is_non_bootstrap_and_non_apeiron():
    for p in build_dry_run_pairs(_events(5)):
        assert p.bootstrap is False  # the worksheet (bootstrap=True) is non-trainable
        assert p.apeiron is False     # the apeiron band check (RULE 6) does not apply


def test_every_pair_has_non_empty_responses():
    for p in build_dry_run_pairs(_events(5)):
        assert p.chosen.response.strip() != ""
        assert p.rejected.response.strip() != ""


def test_every_pair_validates_against_quality_control_rules():
    """The whole point: these pairs must pass ``validate_pair`` so the reward
    trainer (``load_human_pairs``) accepts them. A failure here is a
    synth_pairs.py bug (the builder asserts this up front + raises)."""
    for p in build_dry_run_pairs(_events(8)):
        assert validate_pair(p) == []


def test_score_gap_exceeds_minimum_and_chosen_passes_all_criteria():
    for p in build_dry_run_pairs(_events(5)):
        gap = p.chosen.scores.total - p.rejected.scores.total
        assert gap >= PREFERENCE_MIN_SCORE_GAP
        # chosen passes all 5 at the 0.70 threshold (>= 4/5 required).
        passing = sum(
            1 for v in (
                p.chosen.scores.tripartite, p.chosen.scores.logic_compress,
                p.chosen.scores.source_aligned, p.chosen.scores.epistemic,
                p.chosen.scores.no_rlhf_signal,
            ) if v >= 0.70
        )
        assert passing >= 4


def test_pairs_round_trip_through_reference_schema():
    """The dry-run pairs must deserialize via ``preference.pair_from_wire`` so
    ``load_human_pairs`` can read the JSONL the builder serializes."""
    from gnosis_training.preference import pair_from_wire

    for p in build_dry_run_pairs(_events(3)):
        wire = dry_run_pair_to_wire(p)
        restored = pair_from_wire(wire)
        assert restored.chosen.scores.total == p.chosen.scores.total
        assert restored.rejected.scores.total == p.rejected.scores.total
        assert restored.bootstrap is False
        assert validate_pair(restored) == []


def test_pairs_load_via_load_human_pairs(tmp_path):
    """End-to-end: serialize → load via the real reward-training loader. This is
    exactly what the dry-run reward stage does."""
    pairs = build_dry_run_pairs(_events(5))
    out = tmp_path / "dry-run-pairs.jsonl"
    export_dry_run_pairs(pairs, out)
    loaded = load_human_pairs(str(out))
    assert len(loaded) == 5
    for p in loaded:
        assert p.bootstrap is False
        assert validate_pair(p) == []


def test_builder_is_deterministic():
    """Same events + seed → identical pairs (the repo's byte-reproducibility
    discipline; ``deterministic_shuffle`` seeded, no wall-clock / random)."""
    events = _events(7)
    a = build_dry_run_pairs(events, seed=42)
    b = build_dry_run_pairs(events, seed=42)
    assert serialize_dry_run_pairs_jsonl(a) == serialize_dry_run_pairs_jsonl(b)


def test_builder_raises_on_invalid_synth_pair(monkeypatch):
    """Defense-in-depth: if a future edit makes the builder emit an invalid pair,
    it raises a clear error (not a confusing load_human_pairs failure later)."""
    import gnosis_training.synth_pairs as sp
    from gnosis_training.preference import PreferencePair

    def fake_validate(pair: PreferencePair) -> list[str]:
        # Force a failure to confirm the builder raises.
        return ["synthetic test failure"]

    monkeypatch.setattr(sp, "validate_pair", fake_validate)
    with pytest.raises(RuntimeError, match="synth_pairs.py bug"):
        build_dry_run_pairs(_events(2))