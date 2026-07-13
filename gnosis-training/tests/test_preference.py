"""preference.py — the spec's biggest silence, concretized (CPU-pure)."""
from __future__ import annotations

import pytest

from gnosis_training.event import GnosisEvent, from_wire
from gnosis_training.preference import (
    PreferencePair,
    build_bootstrap_worksheet,
    load_human_pairs,
    pair_from_wire,
    pair_to_wire,
    serialize_pairs_jsonl,
    validate_pair,
)


def _sample_event(total: float = 0.95, passes: bool = True) -> GnosisEvent:
    wire = {
        "event_id": "a1b2c3d4-1111-5111-8111-111111111111",
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
            {"role": "user", "content": "What is entropy?"},
            {"role": "assistant", "content": ""},
        ],
        "constitution_score": {
            "tripartite": 1.0, "logic_compress": 0.9, "source_aligned": 1.0,
            "epistemic": 0.8, "no_rlhf_signal": 1.0, "total": total, "passes": passes,
        },
    }
    return from_wire(wire)


def _human_pair_wire(gap: float = 0.30, chosen_total: float = 0.95) -> dict:
    rejected_total = chosen_total - gap
    return {
        "pair_id": "PP-001",
        "category": "CAT1",
        "prompt": "What is entropy?",
        "chosen": {
            "response": "THEOLOGICAL LENS: ... LOGIC COMPRESSION: ...",
            "scores": {"tripartite": 1.0, "logic_compress": 0.9,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": chosen_total},
            "notes": "passes all criteria",
        },
        "rejected": {
            "response": "entropy is disorder",
            "scores": {"tripartite": 0.3, "logic_compress": 0.8,
                       "source_aligned": 1.0, "epistemic": 0.8,
                       "no_rlhf_signal": 1.0, "total": rejected_total},
            "notes": "missing cosmology",
        },
        "failing_criteria": ["C1"],
        "apeiron": False,
        "bootstrap": False,
        "constitution_version": "v2.0",
    }


# ── Bootstrap worksheet (Source 1) ──────────────────────────────────────────

def test_bootstrap_worksheet_emits_empty_responses_marked_bootstrap():
    """Source 1: worksheet pairs have EMPTY responses + bootstrap=True (a human
    fills them in). NOT a trainable pair on its own."""
    events = [_sample_event() for _ in range(3)]
    pairs = build_bootstrap_worksheet(events, seed=42)
    assert len(pairs) == 3
    for p in pairs:
        assert p.bootstrap is True
        assert p.chosen.response == ""
        assert p.rejected.response == ""


def test_bootstrap_worksheet_chosen_scores_match_event_constitution_score():
    """The rubric scores are pre-filled from the event's constitution_score
    (NOT a reward-model label — a worksheet seed)."""
    events = [_sample_event(total=0.95)]
    pairs = build_bootstrap_worksheet(events, seed=42)
    assert pairs[0].chosen.scores.total == pytest.approx(0.95)


def test_bootstrap_worksheet_rejected_is_degraded_below_chosen():
    """The rejected side drops one criterion to 0.30 so the worksheet's gap is
    visible before humans author real responses."""
    pairs = build_bootstrap_worksheet([_sample_event(total=0.95)], seed=42)
    assert pairs[0].rejected.scores.total < pairs[0].chosen.scores.total


def test_bootstrap_worksheet_spreads_categories():
    """Worksheet pairs are round-robin-assigned to the reference's 8 categories."""
    events = [_sample_event() for _ in range(8)]
    pairs = build_bootstrap_worksheet(events, seed=42)
    cats = {p.category for p in pairs}
    assert len(cats) == 8  # all 8 categories touched


def test_bootstrap_worksheet_is_deterministic():
    """Same seed → byte-identical worksheet (repo byte-reproducibility gate)."""
    events = [_sample_event() for _ in range(5)]
    a = serialize_pairs_jsonl(build_bootstrap_worksheet(events, seed=42))
    b = serialize_pairs_jsonl(build_bootstrap_worksheet(events, seed=42))
    assert a == b


def test_bootstrap_pair_is_flagged_untrainable_by_validator():
    """validate_pair rejects bootstrap pairs — they need human authoring."""
    pairs = build_bootstrap_worksheet([_sample_event()], seed=42)
    problems = validate_pair(pairs[0])
    assert any("bootstrap" in p for p in problems)


def test_bootstrap_apeiron_flag_when_event_below_pass():
    """An event below the constitution pass threshold → worksheet pair marked
    apeiron (both sides below pass, reference CAT 8)."""
    pairs = build_bootstrap_worksheet([_sample_event(total=0.60, passes=False)], seed=42)
    assert pairs[0].apeiron is True


# ── Human pairs (Source 3 — the trainable path) ─────────────────────────────

def test_pair_from_to_wire_roundtrip_reference_schema():
    """Round-trip preserves the reference preference-pair JSON schema."""
    wire = _human_pair_wire()
    pair: PreferencePair = pair_from_wire(wire)
    assert pair_to_wire(pair) == wire


def test_validate_pair_accepts_good_human_pair():
    """A human-authored pair with a real gap + chosen passing ≥4 criteria is valid."""
    pair = pair_from_wire(_human_pair_wire(gap=0.30, chosen_total=0.95))
    assert validate_pair(pair) == []


def test_validate_pair_rejects_small_gap():
    """RULE 1: gap < 0.15 is too ambiguous."""
    pair = pair_from_wire(_human_pair_wire(gap=0.10, chosen_total=0.95))
    problems = validate_pair(pair)
    assert any("gap" in p for p in problems)


def test_validate_pair_rejects_chosen_failing_too_many_criteria():
    """RULE 2: chosen must pass ≥4 of 5 criteria at ≥0.70."""
    wire = _human_pair_wire(gap=0.30, chosen_total=0.95)
    # tank chosen on 3 of 5 criteria → only 2 pass
    for c in ("tripartite", "logic_compress", "source_aligned"):
        wire["chosen"]["scores"][c] = 0.40
    wire["chosen"]["scores"]["total"] = 0.50
    pair = pair_from_wire(wire)
    problems = validate_pair(pair)
    assert any("chosen passes" in p for p in problems)


def test_validate_pair_rejects_apeiron_out_of_band():
    """RULE 6: apeiron pairs must have both scores in 0.55–0.71."""
    wire = _human_pair_wire(gap=0.30, chosen_total=0.95)
    wire["apeiron"] = True
    pair = pair_from_wire(wire)
    problems = validate_pair(pair)
    assert any("apeiron" in p for p in problems)


def test_load_human_pairs_raises_on_bootstrap_pair(tmp_path):
    """The reward model trains on HUMAN-judged pairs (spec line 478); a
    bootstrap worksheet pair must NOT silently enter RM training."""
    worksheet = build_bootstrap_worksheet([_sample_event()], seed=42)
    p = tmp_path / "pairs.jsonl"
    p.write_text(serialize_pairs_jsonl(worksheet), encoding="utf-8")
    with pytest.raises(ValueError, match="bootstrap"):
        load_human_pairs(p)


def test_load_human_pairs_loads_valid_pairs(tmp_path):
    """A file of valid human pairs loads cleanly."""
    wire = _human_pair_wire(gap=0.30, chosen_total=0.95)
    p = tmp_path / "pairs.jsonl"
    p.write_text(serialize_pairs_jsonl([pair_from_wire(wire)]) , encoding="utf-8")
    pairs = load_human_pairs(p)
    assert len(pairs) == 1
    assert pairs[0].pair_id == "PP-001"